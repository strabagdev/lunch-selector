import { createHash } from "node:crypto";

export const ADMIN_ACCESS_COOKIE = "admin_access";

export function hashAdminAccessPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

export function getAdminAccessToken() {
  const password = process.env.ADMIN_ACCESS_PASSWORD;

  if (!password) {
    return null;
  }

  return hashAdminAccessPassword(password);
}

export function isSafeAdminRedirectPath(value: string | null | undefined) {
  return Boolean(value && value.startsWith("/admin"));
}
