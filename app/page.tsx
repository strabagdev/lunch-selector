import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16 sm:px-10">
      <div className="rounded-[2rem] border border-border bg-surface p-8 shadow-[0_24px_80px_rgba(29,29,27,0.08)] sm:p-12">
        <div className="max-w-2xl space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            MVP
          </p>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Lunch Selector
            </h1>
            <p className="text-lg leading-8 text-muted">
              Base inicial para seleccionar almuerzos por persona y administrar
              personas, d&iacute;as de men&uacute; y reportes.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin"
            className="rounded-2xl bg-foreground px-5 py-4 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
          >
            Ir a administraci&oacute;n
          </Link>
          <Link
            href="/admin/menu-days"
            className="rounded-2xl border border-border px-5 py-4 text-sm font-medium transition-colors hover:bg-background"
          >
            Ver d&iacute;as de men&uacute;
          </Link>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-border bg-background px-5 py-4">
            <h2 className="text-base font-semibold">Selecci&oacute;n diaria</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              La persona elegir&aacute; su nombre y una sola opci&oacute;n de almuerzo por
              d&iacute;a.
            </p>
          </section>
          <section className="rounded-2xl border border-border bg-background px-5 py-4">
            <h2 className="text-base font-semibold">Administraci&oacute;n</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Secciones listas para crecer con personas, men&uacute;s diarios y
              reportes.
            </p>
          </section>
          <section className="rounded-2xl border border-border bg-background px-5 py-4">
            <h2 className="text-base font-semibold">Siguiente etapa</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Luego podremos conectar PostgreSQL y preparar despliegue en
              Railway.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
