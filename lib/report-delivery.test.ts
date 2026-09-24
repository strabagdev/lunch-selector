import assert from "node:assert/strict";
import test from "node:test";
import type {
  ReportDeliveryRecord,
  ReportDeliveryStore,
} from "./report-delivery";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
const { executeReportDelivery } = await import("./report-delivery");

type StoredDelivery = ReportDeliveryRecord & {
  attemptCount: number;
  lastAttemptAt: Date | null;
  lastError: string | null;
  leaseToken: string | null;
  providerDeliveryId: string | null;
};

class MemoryReportDeliveryStore implements ReportDeliveryStore {
  records = new Map<string, StoredDelivery>();

  async ensure(input: {
    menuDayId: string;
    channel: "EMAIL" | "WHATSAPP";
    recipientKey: string;
    destination: string;
  }) {
    const key = `${input.menuDayId}:${input.channel}:${input.recipientKey}`;
    const existing = this.records.get(key);

    if (existing) {
      return existing;
    }

    const created: StoredDelivery = {
      id: key,
      ...input,
      status: "PENDING",
      attemptCount: 0,
      lastAttemptAt: null,
      sentAt: null,
      lastError: null,
      leaseToken: null,
      leaseExpiresAt: null,
      providerDeliveryId: null,
    };
    this.records.set(key, created);
    return created;
  }

  async claim({
    id,
    leaseToken,
    attemptedAt,
    leaseExpiresAt,
  }: {
    id: string;
    leaseToken: string;
    attemptedAt: Date;
    leaseExpiresAt: Date;
  }) {
    const delivery = this.records.get(id);

    if (
      !delivery ||
      delivery.sentAt ||
      !(
        delivery.status === "PENDING" ||
        delivery.status === "FAILED" ||
        (delivery.status === "PROCESSING" &&
          delivery.leaseExpiresAt !== null &&
          delivery.leaseExpiresAt < attemptedAt)
      )
    ) {
      return false;
    }

    delivery.status = "PROCESSING";
    delivery.attemptCount += 1;
    delivery.lastAttemptAt = attemptedAt;
    delivery.lastError = null;
    delivery.leaseToken = leaseToken;
    delivery.leaseExpiresAt = leaseExpiresAt;
    return true;
  }

  async find(id: string) {
    const delivery = this.records.get(id);

    if (!delivery) {
      throw new Error("Delivery not found");
    }

    return delivery;
  }

  async markSent({
    id,
    leaseToken,
    sentAt,
    providerDeliveryId,
  }: {
    id: string;
    leaseToken: string;
    sentAt: Date;
    providerDeliveryId: string | null;
  }) {
    const delivery = await this.find(id);

    if (delivery.status !== "PROCESSING" || delivery.leaseToken !== leaseToken) {
      return;
    }

    delivery.status = "SENT";
    delivery.sentAt = sentAt;
    delivery.lastError = null;
    delivery.leaseToken = null;
    delivery.leaseExpiresAt = null;
    delivery.providerDeliveryId = providerDeliveryId;
  }

  async markFailed({
    id,
    leaseToken,
    error,
  }: {
    id: string;
    leaseToken: string;
    error: string;
  }) {
    const delivery = await this.find(id);

    if (delivery.status !== "PROCESSING" || delivery.leaseToken !== leaseToken) {
      return;
    }

    delivery.status = "FAILED";
    delivery.lastError = error;
    delivery.leaseToken = null;
    delivery.leaseExpiresAt = null;
  }
}

const EMAIL_DELIVERY = {
  menuDayId: "menu-day-1",
  channel: "EMAIL" as const,
  recipientKey: "daily-report",
  destination: JSON.stringify(["ops@example.com"]),
};

test("first execution sends and second execution does not duplicate", async () => {
  const store = new MemoryReportDeliveryStore();
  let sendCount = 0;
  const send = async () => {
    sendCount += 1;
    return "provider-1";
  };

  const first = await executeReportDelivery(EMAIL_DELIVERY, send, store);
  const second = await executeReportDelivery(EMAIL_DELIVERY, send, store);

  assert.equal(first.status, "sent");
  assert.equal(second.status, "already_sent");
  assert.equal(sendCount, 1);
});

test("failed delivery is persisted and can be retried", async () => {
  const store = new MemoryReportDeliveryStore();
  let sendCount = 0;

  await assert.rejects(
    executeReportDelivery(
      EMAIL_DELIVERY,
      async () => {
        sendCount += 1;
        throw new Error("provider unavailable");
      },
      store,
    ),
    /provider unavailable/,
  );

  const failed = Array.from(store.records.values())[0];
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.lastError, "provider unavailable");

  const retry = await executeReportDelivery(
    EMAIL_DELIVERY,
    async () => {
      sendCount += 1;
      return "provider-2";
    },
    store,
  );

  assert.equal(retry.status, "sent");
  assert.equal(sendCount, 2);
  assert.equal(failed.status, "SENT");
  assert.equal(failed.attemptCount, 2);
});

test("concurrent attempts claim a delivery only once", async () => {
  const store = new MemoryReportDeliveryStore();
  let sendCount = 0;
  let releaseSend: (() => void) | undefined;
  let markSendStarted: (() => void) | undefined;
  const sendStarted = new Promise<void>((resolve) => {
    markSendStarted = resolve;
  });
  const sendCanFinish = new Promise<void>((resolve) => {
    releaseSend = resolve;
  });

  const firstPromise = executeReportDelivery(
    EMAIL_DELIVERY,
    async () => {
      sendCount += 1;
      markSendStarted?.();
      await sendCanFinish;
      return "provider-1";
    },
    store,
  );

  await sendStarted;
  const second = await executeReportDelivery(
    EMAIL_DELIVERY,
    async () => {
      sendCount += 1;
      return "provider-2";
    },
    store,
  );
  releaseSend?.();
  const first = await firstPromise;

  assert.equal(first.status, "sent");
  assert.equal(second.status, "in_progress");
  assert.equal(sendCount, 1);
});

test("successful email is not repeated when WhatsApp fails and retries", async () => {
  const store = new MemoryReportDeliveryStore();
  let emailSendCount = 0;
  let whatsappSendCount = 0;
  const whatsappDelivery = {
    menuDayId: "menu-day-1",
    channel: "WHATSAPP" as const,
    recipientKey: "56911111111",
    destination: "56911111111",
  };

  await executeReportDelivery(
    EMAIL_DELIVERY,
    async () => {
      emailSendCount += 1;
      return "email-1";
    },
    store,
  );

  await assert.rejects(
    executeReportDelivery(
      whatsappDelivery,
      async () => {
        whatsappSendCount += 1;
        throw new Error("whatsapp unavailable");
      },
      store,
    ),
  );

  const emailRetry = await executeReportDelivery(
    EMAIL_DELIVERY,
    async () => {
      emailSendCount += 1;
      return "email-2";
    },
    store,
  );
  const whatsappRetry = await executeReportDelivery(
    whatsappDelivery,
    async () => {
      whatsappSendCount += 1;
      return "whatsapp-1";
    },
    store,
  );

  assert.equal(emailRetry.status, "already_sent");
  assert.equal(whatsappRetry.status, "sent");
  assert.equal(emailSendCount, 1);
  assert.equal(whatsappSendCount, 2);
});
