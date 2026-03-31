import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdminMenuDaysPageProps = {
  searchParams: Promise<{
    month?: string | string[] | undefined;
  }>;
};

function formatMenuDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getMonthParam(value: string | string[] | undefined) {
  const month = Array.isArray(value) ? value[0] : value;
  return month && /^\d{4}-\d{2}$/.test(month) ? month : undefined;
}

function getMonthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function getMonthStart(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00.000Z`);
}

function addMonths(monthKey: string, amount: number) {
  const date = getMonthStart(monthKey);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return getMonthKey(date);
}

function formatMonthHeading(monthKey: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(getMonthStart(monthKey));
}

export default async function AdminMenuDaysPage({
  searchParams,
}: AdminMenuDaysPageProps) {
  const resolvedSearchParams = await searchParams;
  const today = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);
  const requestedMonth = getMonthParam(resolvedSearchParams.month);

  const [oldestPastMenuDay, latestPastMenuDay] = await Promise.all([
    prisma.menuDay.findFirst({
      where: {
        date: {
          lt: todayDate,
        },
      },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.menuDay.findFirst({
      where: {
        date: {
          lt: todayDate,
        },
      },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);

  const latestMonthKey = latestPastMenuDay ? getMonthKey(latestPastMenuDay.date) : null;
  const oldestMonthKey = oldestPastMenuDay ? getMonthKey(oldestPastMenuDay.date) : null;
  const selectedMonthKey =
    requestedMonth &&
    oldestMonthKey &&
    latestMonthKey &&
    requestedMonth >= oldestMonthKey &&
    requestedMonth <= latestMonthKey
      ? requestedMonth
      : latestMonthKey;

  const monthStart = selectedMonthKey ? getMonthStart(selectedMonthKey) : null;
  const nextMonthStart =
    selectedMonthKey && monthStart ? getMonthStart(addMonths(selectedMonthKey, 1)) : null;
  const historyMonthEnd =
    nextMonthStart && nextMonthStart < todayDate ? nextMonthStart : todayDate;

  const pastMenuDays = !selectedMonthKey || !monthStart || !nextMonthStart || !historyMonthEnd
    ? []
    : await prisma.menuDay.findMany({
        where: {
          date: {
            gte: monthStart,
            lt: historyMonthEnd,
          },
        },
        orderBy: { date: "desc" },
        include: {
          options: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
            },
          },
          selections: {
            select: {
              personId: true,
              menuOptionId: true,
            },
          },
        },
      });

  const previousMonthKey =
    selectedMonthKey && oldestMonthKey && selectedMonthKey > oldestMonthKey
      ? addMonths(selectedMonthKey, -1)
      : null;
  const nextMonthKey =
    selectedMonthKey && latestMonthKey && selectedMonthKey < latestMonthKey
      ? addMonths(selectedMonthKey, 1)
      : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">Hist&oacute;rico</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Revisi&oacute;n simple por mes de d&iacute;as pasados con su actividad registrada.
        </p>
      </section>

      <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
        {!selectedMonthKey ? (
          <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
            Todav&iacute;a no hay d&iacute;as pasados para mostrar.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold capitalize">
                {formatMonthHeading(selectedMonthKey)}
              </div>

              <div className="flex gap-3">
                {previousMonthKey ? (
                  <Link
                    href={`/admin/menu-days?month=${previousMonthKey}`}
                    className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
                  >
                    Mes anterior
                  </Link>
                ) : null}
                {nextMonthKey ? (
                  <Link
                    href={`/admin/menu-days?month=${nextMonthKey}`}
                    className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
                  >
                    Mes siguiente
                  </Link>
                ) : null}
              </div>
            </div>

            {pastMenuDays.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
                No hay d&iacute;as hist&oacute;ricos registrados en este mes.
              </div>
            ) : (
              <>
                <div className="space-y-4 sm:hidden">
                  {pastMenuDays.map((menuDay) => (
                    <article
                      key={menuDay.id}
                      className="rounded-[20px] border border-border bg-background px-4 py-4"
                    >
                      <h3 className="text-sm font-semibold leading-5 text-foreground">
                        {formatMenuDate(menuDay.date)}
                      </h3>
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
                        Total pedidos: {menuDay.selections.length}
                      </p>

                      <div className="mt-4 space-y-2">
                        {menuDay.options.map((option) => {
                          const selectionCount = menuDay.selections.filter(
                            (selection) => selection.menuOptionId === option.id,
                          ).length;

                          return (
                            <div
                              key={option.id}
                              className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-white px-3 py-2 text-sm"
                            >
                              <span className="min-w-0 flex-1">{option.name}</span>
                              <span className="font-medium text-muted">{selectionCount}</span>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-muted">
                      <th className="border-b border-border px-4 py-3 font-semibold">
                        Fecha
                      </th>
                      <th className="border-b border-border px-4 py-3 font-semibold">
                        Almuerzos
                      </th>
                      <th className="border-b border-border px-4 py-3 font-semibold">
                        Total pedidos
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastMenuDays.map((menuDay) => (
                      <tr key={menuDay.id} className="text-sm">
                        <td className="border-b border-[rgba(107,102,93,0.12)] px-4 py-4 font-medium">
                          {formatMenuDate(menuDay.date)}
                        </td>
                        <td className="border-b border-[rgba(107,102,93,0.12)] px-4 py-4 text-muted">
                          <div className="min-w-[260px] space-y-2">
                            {menuDay.options.map((option) => {
                              const selectionCount = menuDay.selections.filter(
                                (selection) => selection.menuOptionId === option.id,
                              ).length;

                              return (
                                <div
                                  key={option.id}
                                  className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                                >
                                  <span className="min-w-0 flex-1">{option.name}</span>
                                  <span className="text-muted">{selectionCount}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="border-b border-[rgba(107,102,93,0.12)] px-4 py-4 text-muted">
                          {menuDay.selections.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
