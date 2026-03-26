import Link from "next/link";
import AdminNav from "@/app/admin/admin-nav";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-4">
        <Link href="/" className="text-sm font-medium text-muted hover:text-foreground">
          Volver al inicio
        </Link>
      </header>

      <AdminNav />

      {children}
    </main>
  );
}
