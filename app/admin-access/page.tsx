import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  ADMIN_ACCESS_COOKIE,
  getAdminAccessToken,
  isSafeAdminRedirectPath,
} from "@/lib/admin-access";

type AdminAccessPageProps = {
  searchParams: Promise<{
    error?: string | string[] | undefined;
    next?: string | string[] | undefined;
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAccessPage({
  searchParams,
}: AdminAccessPageProps) {
  const resolvedSearchParams = await searchParams;
  const errorParam = getParam(resolvedSearchParams.error);
  const nextParam = getParam(resolvedSearchParams.next);
  const nextPath =
    isSafeAdminRedirectPath(nextParam) && nextParam ? nextParam : "/admin";
  const token = getAdminAccessToken();

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;

  if (token && currentToken === token) {
    redirect(nextPath);
  }

  async function unlockAdmin(formData: FormData) {
    "use server";

    const password = String(formData.get("password") ?? "");
    const requestedNext = String(formData.get("next") ?? "");
    const safeNext = isSafeAdminRedirectPath(requestedNext) ? requestedNext : "/admin";
    const expectedToken = getAdminAccessToken();

    if (!expectedToken || password !== process.env.ADMIN_ACCESS_PASSWORD) {
      redirect(`/admin-access?error=1&next=${encodeURIComponent(safeNext)}`);
    }

    const actionCookies = await cookies();
    actionCookies.set(ADMIN_ACCESS_COOKIE, expectedToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    redirect(safeNext);
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          Acceso privado
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Ingresar a administraci&oacute;n
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Introduce la clave compartida para entrar a la zona administrativa.
        </p>

        <form action={unlockAdmin} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={nextPath} />

          <label className="block space-y-2">
            <span className="text-sm font-medium">Clave</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none transition-colors focus:border-accent sm:text-sm"
            />
          </label>

          {errorParam === "1" ? (
            <p className="text-sm text-[var(--danger)]">La clave no coincide.</p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-[var(--surface-strong)]"
            >
              Volver
            </Link>

            <button
              type="submit"
              className="rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
            >
              Entrar
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
