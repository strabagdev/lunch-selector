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

  async function deleteMenuOption(formData: FormData) {
    "use server";

    const optionId = String(formData.get("optionId") ?? "");

    if (!optionId) {
      return;
    }

    const selectionCount = await prisma.lunchSelection.count({
      where: { menuOptionId: optionId },
    });

    if (selectionCount > 0) {
      return;
    }

    await prisma.menuOption.delete({
      where: { id: optionId },
      select: { id: true },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/menu-config");
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
      <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
        {menuDays.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
            A&uacute;n no hay d&iacute;as de men&uacute; con opciones cargadas.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {menuDays.map((availableMenuDay) => {
              const isSelected = availableMenuDay.id === menuDay?.id;

              return (
                <Link
                  key={availableMenuDay.id}
                  href={`/admin?menuDay=${availableMenuDay.id}`}
                  className={`min-w-[92px] rounded-[1.5rem] border px-4 py-3 text-sm transition-colors ${
                    isSelected
                      ? "border-[var(--accent)] bg-[rgba(180,83,9,0.12)] text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(180,83,9,0.14)]"
                      : "border-border bg-background text-foreground hover:bg-surface"
                  }`}
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {formatShortMenuDate(availableMenuDay.date)}
                  </span>
                  <span className="mt-2 block text-lg font-semibold tracking-tight">
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight">
                {formatMenuDate(menuDay.date)}
              </h3>
            </div>

            <div className="mt-6 space-y-3">
              {menuDay.options.map((option, index) => (
                <div
                  key={option.id}
                  className="rounded-2xl border border-border bg-background px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        Menu {index + 1}
                      </p>
                      <h4 className="text-sm font-semibold">{option.name}</h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
                        {selectionsByOption.get(option.id) ?? 0}
                      </span>
                      <form action={deleteMenuOption}>
                        <input type="hidden" name="optionId" value={option.id} />
                        <ConfirmSubmitButton
                          confirmMessage="Se eliminará esta opción del menú. ¿Quieres continuar?"
                          disabled={(selectionsByOption.get(option.id) ?? 0) > 0}
                          className={`rounded-2xl border px-3 py-2 text-xs font-medium transition-colors ${
                            (selectionsByOption.get(option.id) ?? 0) > 0
                              ? "cursor-not-allowed border-border bg-surface text-muted opacity-60"
                              : "border-[rgba(154,52,18,0.18)] bg-[rgba(154,52,18,0.06)] text-[rgb(154,52,18)] hover:bg-[rgba(154,52,18,0.1)]"
                          }`}
                        >
                          Eliminar
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
            <h3 className="text-xl font-semibold tracking-tight">
              Personas que ya eligieron
            </h3>

            {menuDay.selections.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-muted">
                A&uacute;n no hay selecciones registradas para esta fecha.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {menuDay.selections.map((selection) => (
                  <li
                    key={selection.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3"
                  >
                    <span className="text-sm font-medium">{selection.person.name}</span>
                    <span className="text-sm text-muted">
                      {selection.menuOption.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
