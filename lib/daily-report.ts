import { prisma } from "@/lib/prisma";

export const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE ?? "America/Santiago";

export type DailyReportSummary = {
  dateKey: string;
  dateLabel: string;
  totalSelections: number;
  items: Array<{
    id: string;
    name: string;
    count: number;
  }>;
};

export type DailyReportSendResult =
  | {
      status: "sent";
      summary: DailyReportSummary;
      recipientCount: number;
      deliveryId: string | null;
    }
  | {
      status: "skipped";
      reason: "no_menu_day" | "no_available_options";
      dateKey: string;
    }
  | {
      status: "not_configured";
      missing: string[];
    };

function getCurrentDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatReportDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function getRecipientsFromEnv() {
  return (process.env.REPORT_RECIPIENTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getDailyReportConfigStatus() {
  const missing: string[] = [];

  if (!process.env.RESEND_API_KEY) {
    missing.push("RESEND_API_KEY");
  }

  if (!process.env.REPORT_FROM_EMAIL) {
    missing.push("REPORT_FROM_EMAIL");
  }

  if (getRecipientsFromEnv().length === 0) {
    missing.push("REPORT_RECIPIENTS");
  }

  if (!process.env.REPORT_CRON_SECRET) {
    missing.push("REPORT_CRON_SECRET");
  }

  return {
    isReady: missing.length === 0,
    missing,
    recipients: getRecipientsFromEnv(),
  };
}

export async function getDailyReportSummary(): Promise<DailyReportSummary | null> {
  const dateKey = getCurrentDateKey();
  const todayDate = new Date(`${dateKey}T00:00:00.000Z`);

  const menuDay = await prisma.menuDay.findUnique({
    where: { date: todayDate },
    select: {
      date: true,
      options: {
        where: { isAvailable: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
        },
      },
      selections: {
        select: {
          menuOptionId: true,
        },
      },
    },
  });

  if (!menuDay || menuDay.options.length === 0) {
    return null;
  }

  const countsByOptionId = new Map(menuDay.options.map((option) => [option.id, 0]));

  for (const selection of menuDay.selections) {
    countsByOptionId.set(
      selection.menuOptionId,
      (countsByOptionId.get(selection.menuOptionId) ?? 0) + 1,
    );
  }

  const items = menuDay.options.map((option) => ({
    id: option.id,
    name: option.name,
    count: countsByOptionId.get(option.id) ?? 0,
  }));
  const totalSelections = menuDay.selections.length;

  return {
    dateKey,
    dateLabel: formatReportDate(menuDay.date),
    totalSelections,
    items,
  };
}
