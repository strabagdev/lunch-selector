import Link from "next/link";

const adminLinks = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/people", label: "Personas" },
  { href: "/admin/menu-days", label: "D\u00edas de men\u00fa" },
  { href: "/admin/reports", label: "Reportes" },
];

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
        <div className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Administraci&oacute;n
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Lunch Selector
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Espacio base para administrar personas, men&uacute;s diarios y reportes
            del sistema.
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-3">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-surface"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {children}
    </main>
  );
}
