import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import ConfirmSubmitButton from "@/app/admin/confirm-submit-button";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    menuDay?: string | string[] | undefined;
  }>;
};

function getMenuDayParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatMenuDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortMenuDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
  }).format(date);
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedMenuDayId = getMenuDayParam(resolvedSearchParams.menuDay);

  async function deleteSelection(formData: FormData) {
    "use server";

    const selectionId = String(formData.get("selectionId") ?? "");

    if (!selectionId) {
      return;
    }

    await prisma.lunchSelection.delete({
      where: { id: selectionId },
      select: { id: true },
    });

    revalidatePath("/admin");
    revalidatePath("/");
  }

  const menuDays = await prisma.menuDay.findMany({
    where: {
      options: {
        some: {
          isAvailable: true,
        },
      },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      _count: {
        select: {
          selections: true,
          options: {
            where: {
              isAvailable: true,
            },
          },
        },
      },
    },
  });

  const selectedMenuDaySummary =
    menuDays.find((menuDay) => menuDay.id === requestedMenuDayId) ?? menuDays[0] ?? null;

  const menuDay = selectedMenuDaySummary
    ? await prisma.menuDay.findUnique({
        where: { id: selectedMenuDaySummary.id },
        select: {
          id: true,
          date: true,
          options: {
            where: { isAvailable: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              sortOrder: true,
            },
          },
          selections: {
            select: {
              id: true,
              personId: true,
              menuOptionId: true,
              person: {
                select: {
                  id: true,
                  name: true,
                },
              },
              menuOption: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: [{ menuOption: { sortOrder: "asc" } }, { person: { name: "asc" } }],
          },
        },
      })
    : null;

  const selectionsByOption = new Map(
    menuDay?.options.map((option) => [option.id, 0]) ?? [],
  );

  for (const selection of menuDay?.selections ?? []) {
    selectionsByOption.set(
      selection.menuOptionId,
      (selectionsByOption.get(selection.menuOptionId) ?? 0) + 1,
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
        {menuDays.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
            A&uacute;n no hay d&iacute;as de men&uacute; con opciones cargadas.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {menuDays.map((availableMenuDay) => {
              const isSelected = availableMenuDay.id === menuDay?.id;

              return (
                <Link
                  key={availableMenuDay.id}
                  href={`/admin?menuDay=${availableMenuDay.id}`}
                  className={`min-w-[76px] rounded-[16px] border px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-border)]"
                      : "border-border bg-[var(--card)] text-foreground hover:bg-[var(--surface-strong)]"
                  }`}
                >
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {formatShortMenuDate(availableMenuDay.date)}
                  </span>
                  <span className="mt-1.5 block text-base font-semibold tracking-tight">
                    {new Intl.DateTimeFormat("es-CL", {
                      timeZone: "UTC",
                      day: "2-digit",
                    }).format(availableMenuDay.date)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {!menuDay ? null : (
        <div className="space-y-6">
          <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                  Resumen
                </p>
                <h3 className="text-2xl font-semibold tracking-tight">
                  {formatMenuDate(menuDay.date)}
                </h3>
              </div>
              <p className="text-sm font-medium text-muted">
                {menuDay.selections.length} selecciones totales
              </p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
              {menuDay.options.map((option, index) => (
                <div
                  key={option.id}
                  className="rounded-[20px] border border-border bg-[var(--card)] px-3 py-4 text-center shadow-[var(--shadow-soft)] sm:px-5 sm:py-6"
                >
                  <div className="flex items-center justify-center">
                    <span className="text-3xl font-semibold leading-none tracking-tight text-accent sm:text-6xl">
                      {selectionsByOption.get(option.id) ?? 0}
                    </span>
                  </div>
                  <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted sm:text-[11px] sm:tracking-[0.16em]">
                    Menu {index + 1}
                  </p>
                  <h4 className="mt-2 text-xs font-semibold leading-4 sm:mt-3 sm:text-base sm:leading-5">
                    {option.name}
                  </h4>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <h3 className="text-xl font-semibold tracking-tight">
              Personas que ya eligieron
            </h3>

            {menuDay.selections.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-muted">
                A&uacute;n no hay selecciones registradas para esta fecha.
              </p>
            ) : (
              <div className="mt-6 overflow-hidden rounded-[20px] border border-border bg-[var(--card)] shadow-[var(--shadow-soft)]">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <span>Persona</span>
                  <span>Men&uacute;</span>
                  <span>Acci&oacute;n</span>
                </div>

                <div className="divide-y divide-border">
                  {menuDay.selections.map((selection) => (
                    <div
                      key={selection.id}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                    >
                      <span className="truncate text-sm font-medium">
                        {selection.person.name}
                      </span>
                      <span className="truncate text-sm text-muted">
                        {selection.menuOption.name}
                      </span>
                      <form action={deleteSelection}>
                        <input type="hidden" name="selectionId" value={selection.id} />
                        <ConfirmSubmitButton
                          confirmMessage="Se eliminará esta selección para corregirla. ¿Quieres continuar?"
                          className="group inline-flex h-9 w-9 items-center justify-center rounded-[14px] border border-[var(--danger-border)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(255,239,243,0.98))] text-[var(--danger)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-18px_rgba(220,63,97,0.55)] ring-1 ring-[rgba(255,255,255,0.7)] transition hover:-translate-y-0.5 hover:border-[rgba(220,63,97,0.28)] hover:bg-[linear-gradient(180deg,rgba(255,250,251,1),rgba(255,232,238,1))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_16px_28px_-18px_rgba(220,63,97,0.52)]"
                        >
                          <span className="sr-only">Eliminar selección</span>
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(220,63,97,0.1)] text-[15px] font-bold leading-none transition group-hover:bg-[rgba(220,63,97,0.16)]"
                          >
                            ×
                          </span>
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
