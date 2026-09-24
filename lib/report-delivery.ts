import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const REPORT_DELIVERY_LEASE_MINUTES = 15;

export type ReportDeliveryChannel = "EMAIL" | "WHATSAPP";
export type ReportDeliveryStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

export type ReportDeliveryRecord = {
  id: string;
  menuDayId: string;
  channel: ReportDeliveryChannel;
  recipientKey: string;
  destination: string;
  status: ReportDeliveryStatus;
  sentAt: Date | null;
  leaseExpiresAt: Date | null;
};

type EnsureReportDeliveryInput = {
  menuDayId: string;
  channel: ReportDeliveryChannel;
  recipientKey: string;
  destination: string;
};

export type ReportDeliveryStore = {
  ensure: (input: EnsureReportDeliveryInput) => Promise<ReportDeliveryRecord>;
  claim: (input: {
    id: string;
    leaseToken: string;
    attemptedAt: Date;
    leaseExpiresAt: Date;
  }) => Promise<boolean>;
  find: (id: string) => Promise<ReportDeliveryRecord>;
  markSent: (input: {
    id: string;
    leaseToken: string;
    sentAt: Date;
    providerDeliveryId: string | null;
  }) => Promise<void>;
  markFailed: (input: {
    id: string;
    leaseToken: string;
    error: string;
  }) => Promise<void>;
};

export type ExecuteReportDeliveryResult =
  | {
      status: "sent";
      deliveryId: string;
      providerDeliveryId: string | null;
    }
  | {
      status: "already_sent" | "in_progress";
      deliveryId: string;
      providerDeliveryId: null;
    };

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function normalizeDeliveryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 2000) || "Unknown delivery error";
}

const prismaReportDeliveryStore: ReportDeliveryStore = {
  async ensure(input) {
    return prisma.dailyReportDelivery.upsert({
      where: {
        menuDayId_channel_recipientKey: {
          menuDayId: input.menuDayId,
          channel: input.channel,
          recipientKey: input.recipientKey,
        },
      },
      update: {},
      create: input,
      select: {
        id: true,
        menuDayId: true,
        channel: true,
        recipientKey: true,
        destination: true,
        status: true,
        sentAt: true,
        leaseExpiresAt: true,
      },
    });
  },

  async claim({ id, leaseToken, attemptedAt, leaseExpiresAt }) {
    const result = await prisma.dailyReportDelivery.updateMany({
      where: {
        id,
        sentAt: null,
        OR: [
          { status: { in: ["PENDING", "FAILED"] } },
          {
            status: "PROCESSING",
            leaseExpiresAt: { lt: attemptedAt },
          },
        ],
      },
      data: {
        status: "PROCESSING",
        attemptCount: { increment: 1 },
        lastAttemptAt: attemptedAt,
        lastError: null,
        leaseToken,
        leaseExpiresAt,
      },
    });

    return result.count === 1;
  },

  async find(id) {
    return prisma.dailyReportDelivery.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        menuDayId: true,
        channel: true,
        recipientKey: true,
        destination: true,
        status: true,
        sentAt: true,
        leaseExpiresAt: true,
      },
    });
  },

  async markSent({ id, leaseToken, sentAt, providerDeliveryId }) {
    await prisma.dailyReportDelivery.updateMany({
      where: {
        id,
        status: "PROCESSING",
        leaseToken,
      },
      data: {
        status: "SENT",
        sentAt,
        lastError: null,
        leaseToken: null,
        leaseExpiresAt: null,
        providerDeliveryId,
      },
    });
  },

  async markFailed({ id, leaseToken, error }) {
    await prisma.dailyReportDelivery.updateMany({
      where: {
        id,
        status: "PROCESSING",
        leaseToken,
      },
      data: {
        status: "FAILED",
        lastError: error,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
  },
};

export async function executeReportDelivery(
  input: EnsureReportDeliveryInput,
  send: (delivery: ReportDeliveryRecord) => Promise<string | null>,
  store: ReportDeliveryStore = prismaReportDeliveryStore,
  now = () => new Date(),
): Promise<ExecuteReportDeliveryResult> {
  const delivery = await store.ensure(input);

  if (delivery.sentAt || delivery.status === "SENT") {
    return {
      status: "already_sent",
      deliveryId: delivery.id,
      providerDeliveryId: null,
    };
  }

  const attemptedAt = now();
  const leaseToken = randomUUID();
  const claimed = await store.claim({
    id: delivery.id,
    leaseToken,
    attemptedAt,
    leaseExpiresAt: addMinutes(attemptedAt, REPORT_DELIVERY_LEASE_MINUTES),
  });

  if (!claimed) {
    const currentDelivery = await store.find(delivery.id);

    return {
      status:
        currentDelivery.sentAt || currentDelivery.status === "SENT"
          ? "already_sent"
          : "in_progress",
      deliveryId: delivery.id,
      providerDeliveryId: null,
    };
  }

  try {
    const providerDeliveryId = await send(delivery);

    await store.markSent({
      id: delivery.id,
      leaseToken,
      sentAt: now(),
      providerDeliveryId,
    });

    return {
      status: "sent",
      deliveryId: delivery.id,
      providerDeliveryId,
    };
  } catch (error) {
    await store.markFailed({
      id: delivery.id,
      leaseToken,
      error: normalizeDeliveryError(error),
    });

    throw error;
  }
}
