import { isIP } from "node:net";

export const selectionSources = {
  publicWeb: "PUBLIC_WEB",
  admin: "ADMIN",
  api: "API",
} as const;

export type SelectionSource =
  (typeof selectionSources)[keyof typeof selectionSources];

export type SelectionTrace = {
  source: SelectionSource | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeText(value: string | null, maxLength: number) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function normalizeIpAddress(value: string | null) {
  const normalized = value?.trim() ?? "";
  return isIP(normalized) === 0 ? null : normalized;
}

function normalizeSessionId(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function isRailwayEnvironment() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT_ID ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID,
  );
}

export function getPublicSelectionTrace(
  requestHeaders: Headers,
  formData: FormData,
  { trustRailwayProxy = isRailwayEnvironment() } = {},
): SelectionTrace {
  return {
    source: selectionSources.publicWeb,
    ipAddress: trustRailwayProxy
      ? normalizeIpAddress(requestHeaders.get("x-real-ip"))
      : null,
    userAgent: normalizeText(requestHeaders.get("user-agent"), 512),
    sessionId: normalizeSessionId(formData.get("sessionId")),
  };
}
