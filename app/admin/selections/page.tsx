import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  buildSelectionAuditWhere,
  describeSelectionDevice,
  formatAuditDateTime,
  formatAuditMenuDate,
  formatTraceValue,
  getSelectionSourceLabel,
  parseSelectionAuditFilters,
  SELECTION_AUDIT_PAGE_SIZE,
} from "@/lib/selection-audit";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    date?: string | string[];
    person?: string | string[];
    source?: string | string[];
    shared?: string | string[];
    page?: string | string[];
  }>;
};

type SharedSessionRow = {
  sessionId: string;
  personCount: number;
};

function getPageHref(
  filters: ReturnType<typeof parseSelectionAuditFilters>,
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.personId) params.set("person", filters.personId);
  if (filters.source) params.set("source", filters.source);
  if (filters.sharedOnly) params.set("shared", "1");
  if (page > 1) params.set("page", String(page));
  return params.size ? "/admin/selections?" + params.toString() : "/admin/selections";
}

export default async function AdminSelectionsPage({ searchParams }: PageProps) {
  const filters = parseSelectionAuditFilters(await searchParams);
  const [people, sharedSessionRows] = await Promise.all([
    prisma.person.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.$queryRaw<SharedSessionRow[]>`
      SELECT "sessionId", COUNT(DISTINCT "personId")::int AS "personCount"
      FROM "LunchSelection"
      WHERE "sessionId" IS NOT NULL AND "sessionId" <> ''
      GROUP BY "sessionId"
      HAVING COUNT(DISTINCT "personId") > 1
    `,
  ]);
  const sharedPersonCountBySession = new Map(
    sharedSessionRows.map((row) => [row.sessionId, row.personCount]),
  );
  const where = buildSelectionAuditWhere(
    filters,
    sharedSessionRows.map((row) => row.sessionId),
  );
  const totalSelections = await prisma.lunchSelection.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalSelections / SELECTION_AUDIT_PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);
  const selections = await prisma.lunchSelection.findMany({
    where,
    orderBy: [{ menuDay: { date: "desc" } }, { selectedAt: "desc" }],
    skip: (currentPage - 1) * SELECTION_AUDIT_PAGE_SIZE,
    take: SELECTION_AUDIT_PAGE_SIZE,
    select: {
      id: true,
      personId: true,
      selectedAt: true,
      updatedAt: true,
      source: true,
      ipAddress: true,
      userAgent: true,
      sessionId: true,
      person: { select: { name: true } },
      menuDay: { select: { date: true } },
      menuOption: { select: { name: true } },
    },
  });
  const visibleSharedSessionIds = Array.from(
    new Set(
      selections.flatMap((selection) =>
        selection.sessionId && sharedPersonCountBySession.has(selection.sessionId)
          ? [selection.sessionId]
          : [],
      ),
    ),
  );
  const relatedSelections = visibleSharedSessionIds.length
    ? await prisma.lunchSelection.findMany({
        where: { sessionId: { in: visibleSharedSessionIds } },
        orderBy: [{ menuDay: { date: "desc" } }, { selectedAt: "desc" }],
        select: {
          id: true,
          sessionId: true,
          selectedAt: true,
          person: { select: { name: true } },
          menuDay: { select: { date: true } },
          menuOption: { select: { name: true } },
        },
      })
    : [];
  const relatedBySession = new Map<string, typeof relatedSelections>();

  for (const relatedSelection of relatedSelections) {
    if (!relatedSelection.sessionId) continue;
    const current = relatedBySession.get(relatedSelection.sessionId) ?? [];
    current.push(relatedSelection);
    relatedBySession.set(relatedSelection.sessionId, current);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border bg-[var(--card)] p-5 shadow-[var(--shadow-card)] sm:p-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          Auditoría
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          Trazabilidad de selecciones
        </h2>

        <form
          method="get"
          className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(150px,0.8fr)_minmax(190px,1fr)_minmax(160px,0.8fr)_auto_auto]"
        >
          <label className="space-y-2">
            <span className="block text-xs font-medium text-muted">Fecha</span>
            <input
              type="date"
              name="date"
              defaultValue={filters.date ?? ""}
              className="h-11 w-full rounded-[12px] border border-border bg-background px-3 text-sm outline-none focus:border-[var(--accent-border)]"
            />
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-medium text-muted">Persona</span>
            <select
              name="person"
              defaultValue={filters.personId ?? ""}
              className="h-11 w-full rounded-[12px] border border-border bg-background px-3 text-sm outline-none focus:border-[var(--accent-border)]"
            >
              <option value="">Todas</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-medium text-muted">Origen</span>
            <select
              name="source"
              defaultValue={filters.source ?? ""}
              className="h-11 w-full rounded-[12px] border border-border bg-background px-3 text-sm outline-none focus:border-[var(--accent-border)]"
            >
              <option value="">Todos</option>
              <option value="PUBLIC_WEB">Web pública</option>
              <option value="ADMIN">Administración</option>
              <option value="API">API</option>
            </select>
          </label>
          <label className="flex h-11 items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              name="shared"
              value="1"
              defaultChecked={filters.sharedOnly}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Solo sesiones compartidas
          </label>
          <div className="flex h-11 items-center gap-2 self-end">
            <button
              type="submit"
              className="h-11 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Filtrar
            </button>
            <Link href="/admin/selections" className="px-2 text-sm font-medium text-muted hover:text-foreground">
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-border bg-[var(--card)] p-4 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1 pb-4">
          <div>
            <h3 className="text-lg font-semibold">Selecciones</h3>
            <p className="mt-1 text-sm text-muted">
              {totalSelections} resultado{totalSelections === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {selections.length === 0 ? (
          <div className="border-t border-border px-2 py-10 text-center text-sm text-muted">
            No hay selecciones que coincidan con los filtros.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[16px] border border-border">
            <div className="hidden grid-cols-[1.1fr_1.2fr_0.8fr_1fr_1fr_0.8fr_1fr] gap-3 border-b border-border bg-background px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted lg:grid">
              <span>Persona</span><span>Opción</span><span>Día</span>
              <span>Selección</span><span>Modificación</span><span>Origen</span>
              <span>Dispositivo</span>
            </div>
            <div className="divide-y divide-border">
              {selections.map((selection) => {
                const sharedPersonCount = selection.sessionId
                  ? sharedPersonCountBySession.get(selection.sessionId)
                  : undefined;
                const sessionSelections = selection.sessionId
                  ? relatedBySession.get(selection.sessionId) ?? []
                  : [];
                const sharedPeople = Array.from(
                  new Set(sessionSelections.map((item) => item.person.name)),
                );

                return (
                  <details key={selection.id} className="group bg-[var(--card)]">
                    <summary className="cursor-pointer list-none px-4 py-4 transition-colors hover:bg-[var(--surface-strong)]">
                      <div className="grid gap-3 lg:grid-cols-[1.1fr_1.2fr_0.8fr_1fr_1fr_0.8fr_1fr] lg:items-center">
                        <div className="min-w-0">
                          <span className="text-[10px] font-semibold uppercase text-muted lg:hidden">Persona</span>
                          <p className="truncate text-sm font-semibold">{selection.person.name}</p>
                          {sharedPersonCount ? (
                            <span className="mt-1 inline-flex rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                              {sharedPersonCount} personas desde esta sesión
                            </span>
                          ) : null}
                        </div>
                        <AuditCell label="Opción" value={selection.menuOption.name} />
                        <AuditCell label="Día" value={formatAuditMenuDate(selection.menuDay.date)} />
                        <AuditCell label="Selección" value={formatAuditDateTime(selection.selectedAt)} compact />
                        <AuditCell label="Última modificación" value={formatAuditDateTime(selection.updatedAt)} compact />
                        <AuditCell label="Origen" value={getSelectionSourceLabel(selection.source)} />
                        <div className="flex items-center justify-between gap-3">
                          <AuditCell label="Dispositivo" value={describeSelectionDevice(selection.userAgent)} />
                          <span aria-hidden="true" className="text-lg text-muted transition-transform group-open:rotate-90">›</span>
                        </div>
                      </div>
                    </summary>

                    <div className="border-t border-border bg-background px-4 py-5">
                      <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                        <TraceItem label="source" value={formatTraceValue(selection.source)} />
                        <TraceItem label="IP" value={formatTraceValue(selection.ipAddress)} />
                        <TraceItem label="sessionId" value={formatTraceValue(selection.sessionId)} mono />
                        <TraceItem label="selectedAt" value={formatAuditDateTime(selection.selectedAt)} />
                        <TraceItem label="updatedAt" value={formatAuditDateTime(selection.updatedAt)} />
                        <TraceItem label="User-Agent" value={formatTraceValue(selection.userAgent)} mono wide />
                      </dl>

                      {sharedPersonCount ? (
                        <div className="mt-5 border-t border-border pt-5">
                          <p className="text-sm font-semibold">
                            Sesión compartida: {sharedPeople.join(", ")}
                          </p>
                          <div className="mt-3 grid gap-2">
                            {sessionSelections.map((item) => (
                              <div key={item.id} className="grid gap-1 text-xs text-muted sm:grid-cols-[1fr_1fr_0.8fr_1fr]">
                                <span className="font-medium text-foreground">{item.person.name}</span>
                                <span>{item.menuOption.name}</span>
                                <span>{formatAuditMenuDate(item.menuDay.date)}</span>
                                <span>{formatAuditDateTime(item.selectedAt)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        )}

        {totalPages > 1 ? (
          <nav className="mt-5 flex items-center justify-between gap-3 px-1">
            <Link
              href={getPageHref(filters, Math.max(1, currentPage - 1))}
              aria-disabled={currentPage === 1}
              className={currentPage === 1 ? "pointer-events-none text-sm text-muted opacity-40" : "text-sm font-medium text-[var(--accent-strong)]"}
            >
              Anterior
            </Link>
            <span className="text-xs text-muted">Página {currentPage} de {totalPages}</span>
            <Link
              href={getPageHref(filters, Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage === totalPages}
              className={currentPage === totalPages ? "pointer-events-none text-sm text-muted opacity-40" : "text-sm font-medium text-[var(--accent-strong)]"}
            >
              Siguiente
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function AuditCell({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] font-semibold uppercase text-muted lg:hidden">{label}</span>
      <p className={compact ? "text-xs text-muted" : "truncate text-sm text-muted"}>{value}</p>
    </div>
  );
}

function TraceItem({
  label,
  value,
  mono = false,
  wide = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2 xl:col-span-3" : ""}>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className={(mono ? "font-mono text-xs leading-5 " : "") + "mt-1 break-all"}>{value}</dd>
    </div>
  );
}
