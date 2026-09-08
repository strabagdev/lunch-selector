import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AdminNav from "@/app/admin/admin-nav";
import { ADMIN_ACCESS_COOKIE } from "@/lib/admin-access";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  async function closeAdminAccess() {
    "use server";

    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_ACCESS_COOKIE);
    redirect("/admin-access");
  }

  return (
    <main className="h-dvh min-h-dvh w-full flex-1 overflow-hidden">
      <div className="mx-auto grid h-full min-h-0 w-full max-w-7xl grid-rows-[minmax(0,1fr)_auto] gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6 sm:pt-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-1 lg:gap-6 lg:px-8 lg:py-8">
        <aside className="hidden h-full min-h-0 flex-col rounded-[32px] border border-border bg-[rgba(18,21,27,0.88)] p-5 shadow-[var(--shadow-card)] backdrop-blur lg:flex">
          <div className="mb-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Lunch Selector
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Administraci&oacute;n
            </h1>
          </div>

          <AdminNav />

          <div className="mt-auto space-y-3 border-t border-border pt-5">
            <Link
              href="/"
              className="block rounded-[18px] border border-border px-4 py-3 text-sm font-semibold text-muted transition-colors hover:bg-[var(--surface-strong)] hover:text-foreground"
            >
              Volver al inicio
            </Link>
            <form action={closeAdminAccess}>
              <button
                type="submit"
                className="w-full rounded-[18px] border border-border bg-[var(--surface-strong)] px-4 py-3 text-left text-sm font-semibold transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--card)]"
              >
                Cerrar acceso
              </button>
            </form>
          </div>
        </aside>

        <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden lg:grid-rows-[minmax(0,1fr)]">
          <header className="flex items-center justify-between gap-3 rounded-[24px] border border-border bg-[rgba(18,21,27,0.86)] px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur lg:hidden">
            <Link href="/" className="text-sm font-semibold text-muted hover:text-foreground">
              Volver
            </Link>
            <form action={closeAdminAccess}>
              <button
                type="submit"
                className="rounded-[16px] border border-border bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--card)]"
              >
                Cerrar acceso
              </button>
            </form>
          </header>

          <div className="min-h-0 overflow-y-auto overscroll-contain pb-1 pr-0.5">
            {children}
          </div>
        </div>

        <AdminNav variant="bottom" />
      </div>
    </main>
  );
}
