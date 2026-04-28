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

export type DailyRequestsCloseResult =
  | {
      status: "closed" | "already_closed";
      dateKey: string;
      menuDayId: string;
    }
  | {
      status: "skipped";
      reason: "no_menu_day" | "not_configured";
      dateKey: string;
    };

export function getReportCronSecrets() {
  return [process.env.REPORT_CRON_SECRET, process.env.CRON_SECRET]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

export function getReportCronSecret() {
  return getReportCronSecrets()[0] ?? "";
}

export function isAuthorizedDailyReportRequest(request: Request) {
  const secrets = getReportCronSecrets();

  if (secrets.length === 0) {
    return false;
  }

  const authorizationHeader = request.headers.get("authorization");
  const requestUrl = new URL(request.url);
  const querySecret = requestUrl.searchParams.get("secret");

  return secrets.some(
    (secret) =>
      authorizationHeader === `Bearer ${secret}` || querySecret === secret,
  );
}

export function getCurrentDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getCurrentReportLocalTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return { hour, minute };
}

export function getCurrentReportLocalHour(date = new Date()) {
  return getCurrentReportLocalTime(date).hour;
}

export function getScheduledReportLocalHour() {
  const configuredHour = Number(process.env.REPORT_SCHEDULED_LOCAL_HOUR ?? 9);

  if (!Number.isInteger(configuredHour) || configuredHour < 0 || configuredHour > 23) {
    return 9;
  }

  return configuredHour;
}

export function getScheduledReportLocalMinute() {
  const configuredMinute = Number(process.env.REPORT_SCHEDULED_LOCAL_MINUTE ?? 55);

  if (
    !Number.isInteger(configuredMinute) ||
    configuredMinute < 0 ||
    configuredMinute > 59
  ) {
    return 55;
  }

  return configuredMinute;
}

export function getScheduledReportWindowMinutes() {
  const configuredWindow = Number(process.env.REPORT_SCHEDULED_WINDOW_MINUTES ?? 5);

  if (!Number.isInteger(configuredWindow) || configuredWindow < 1 || configuredWindow > 30) {
    return 5;
  }

  return configuredWindow;
}

export function isWithinScheduledReportWindow() {
  const currentTime = getCurrentReportLocalTime();
  const scheduledHour = getScheduledReportLocalHour();
  const scheduledMinute = getScheduledReportLocalMinute();
  const windowMinutes = getScheduledReportWindowMinutes();
  const currentMinuteOfDay = currentTime.hour * 60 + currentTime.minute;
  const scheduledMinuteOfDay = scheduledHour * 60 + scheduledMinute;

  return {
    isWithinWindow:
      currentMinuteOfDay >= scheduledMinuteOfDay &&
      currentMinuteOfDay < scheduledMinuteOfDay + windowMinutes,
    currentHour: currentTime.hour,
    currentMinute: currentTime.minute,
    scheduledHour,
    scheduledMinute,
    windowMinutes,
  };
}

function formatReportDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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

  return {
    isReady: missing.length === 0,
    missing,
    recipients: getRecipientsFromEnv(),
    hasCronSecret: getReportCronSecrets().length > 0,
  };
}

export async function closeTodayMenuDayRequests(): Promise<DailyRequestsCloseResult> {
  const dateKey = getCurrentDateKey();
  const todayDate = new Date(`${dateKey}T00:00:00.000Z`);

  const menuDay = await prisma.menuDay.findUnique({
    where: { date: todayDate },
    select: {
      id: true,
      isClosed: true,
    },
  });

  if (!menuDay) {
    return {
      status: "skipped",
      reason: "no_menu_day",
      dateKey,
    };
  }

  if (menuDay.isClosed) {
    return {
      status: "already_closed",
      dateKey,
      menuDayId: menuDay.id,
    };
  }

  await prisma.menuDay.update({
    where: { id: menuDay.id },
    data: { isClosed: true },
    select: { id: true },
  });

  return {
    status: "closed",
    dateKey,
    menuDayId: menuDay.id,
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
