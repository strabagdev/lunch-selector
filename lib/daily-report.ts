import { prisma } from "@/lib/prisma";
import {
  generateDailyReportNarrative,
  isLunchAiEnabled,
} from "@/lib/lunch-ai";

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
  narrative: {
    text: string | null;
    model: string | null;
  };
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
    openAiEnabled: isLunchAiEnabled(),
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
  const sortedItems = [...items].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.name.localeCompare(right.name, "es");
  });
  const lowestCount = sortedItems.at(-1)?.count ?? 0;
  let narrative: DailyReportSummary["narrative"] = {
    text: null,
    model: null,
  };

  if (totalSelections > 0) {
    try {
      const generatedNarrative = await generateDailyReportNarrative({
        dateLabel: formatReportDate(menuDay.date),
        totalSelections,
        topChoice: sortedItems[0]
          ? {
              name: sortedItems[0].name,
              count: sortedItems[0].count,
            }
          : null,
        leastChosenOptions: sortedItems
          .filter((item) => item.count === lowestCount)
          .slice(0, 2)
          .map((item) => ({ name: item.name, count: item.count })),
        items: items.map((item) => ({ name: item.name, count: item.count })),
      });

      if (generatedNarrative) {
        narrative = generatedNarrative;
      }
    } catch (error) {
      console.error("Daily report AI narrative failed", error);
    }
  }

  return {
    dateKey,
    dateLabel: formatReportDate(menuDay.date),
    totalSelections,
    items,
    narrative,
  };
}
