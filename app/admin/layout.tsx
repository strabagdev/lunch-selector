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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-sm font-medium text-muted hover:text-foreground">
          Volver al inicio
        </Link>
        <form action={closeAdminAccess}>
          <button
            type="submit"
            className="rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-surface"
          >
            Cerrar acceso
          </button>
        </form>
      </header>

      <AdminNav />

      {children}
    </main>
  );
}
