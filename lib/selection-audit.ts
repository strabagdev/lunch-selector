import type { Prisma, SelectionSource } from "@/generated/prisma/client";

export const SELECTION_AUDIT_TIMEZONE = "America/Santiago";
export const SELECTION_AUDIT_PAGE_SIZE = 25;

const SELECTION_SOURCES: SelectionSource[] = ["PUBLIC_WEB", "ADMIN", "API"];

export type SelectionAuditFilters = {
  date: string | null;
  personId: string | null;
  source: SelectionSource | null;
  sharedOnly: boolean;
  page: number;
};

type SearchParamValue = string | string[] | undefined;

export type SessionSelection = {
  sessionId: string | null;
  personId: string;
};

function getSingleParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseSelectionAuditFilters(params: {
  date?: SearchParamValue;
  person?: SearchParamValue;
  source?: SearchParamValue;
  shared?: SearchParamValue;
  page?: SearchParamValue;
}): SelectionAuditFilters {
  const dateParam = getSingleParam(params.date);
  const personParam = getSingleParam(params.person);
  const sourceParam = getSingleParam(params.source);
  const sharedParam = getSingleParam(params.shared);
  const pageParam = Number(getSingleParam(params.page));
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  return {
    date,
    personId: personParam?.trim() || null,
    source: SELECTION_SOURCES.includes(sourceParam as SelectionSource)
      ? (sourceParam as SelectionSource)
      : null,
    sharedOnly: sharedParam === "1",
    page: Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1,
  };
}

export function buildSelectionAuditWhere(
  filters: SelectionAuditFilters,
  sharedSessionIds: string[],
): Prisma.LunchSelectionWhereInput {
  return {
    ...(filters.date
      ? {
          menuDay: {
            date: new Date(`${filters.date}T00:00:00.000Z`),
          },
        }
      : {}),
    ...(filters.personId ? { personId: filters.personId } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.sharedOnly ? { sessionId: { in: sharedSessionIds } } : {}),
  };
}

export function getSharedSessionPersonCounts(selections: SessionSelection[]) {
  const peopleBySession = new Map<string, Set<string>>();

  for (const selection of selections) {
    if (!selection.sessionId) {
      continue;
    }

    const people = peopleBySession.get(selection.sessionId) ?? new Set<string>();
    people.add(selection.personId);
    peopleBySession.set(selection.sessionId, people);
  }

  return new Map(
    Array.from(peopleBySession.entries())
      .filter(([, people]) => people.size > 1)
      .map(([sessionId, people]) => [sessionId, people.size]),
  );
}

export function formatAuditDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SELECTION_AUDIT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("day")}-${getPart("month")}-${getPart("year")} ${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
}

export function formatAuditMenuDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTraceValue(value: string | null) {
  return value || "Sin información";
}

export function getSelectionSourceLabel(source: SelectionSource | null) {
  switch (source) {
    case "PUBLIC_WEB":
      return "Web pública";
    case "ADMIN":
      return "Administración";
    case "API":
      return "API";
    default:
      return "Sin información";
  }
}

export function describeSelectionDevice(userAgent: string | null) {
  if (!userAgent) {
    return "Sin información";
  }

  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /CriOS\//i.test(userAgent)
      ? "Chrome"
      : /Chrome\//i.test(userAgent)
        ? "Chrome"
        : /Version\//i.test(userAgent) && /Safari\//i.test(userAgent)
          ? "Safari"
          : /Firefox\//i.test(userAgent)
            ? "Firefox"
            : "Desconocido";

  const platform = /iPhone/i.test(userAgent)
    ? "iPhone"
    : /Android/i.test(userAgent)
      ? "Android"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(userAgent)
          ? "macOS"
          : null;

  return platform ? `${browser} · ${platform}` : browser;
}
