import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    menuDay?: string | string[] | undefined;
  }>;
};

function formatMenuDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getMenuDayParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMonthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function getMonthStart(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00.000Z`);
}

function formatMonthHeading(monthKey: string) {
  return new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
  }).format(getMonthStart(monthKey));
}

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedMenuDayId = getMenuDayParam(resolvedSearchParams.menuDay);
  const todayKey = getTodayKey();
  const currentMonthKey = todayKey.slice(0, 7);
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);

  const [people, availableMenuDays] = await Promise.all([
    prisma.person.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.menuDay.findMany({
      where: {
        isOpen: true,
        date: {
          gte: todayDate,
        },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        label: true,
        _count: {
          select: {
            options: {
              where: {
                isAvailable: true,
              },
            },
            selections: true,
          },
        },
      },
    }),
  ]);

  const selectableMenuDays = availableMenuDays.filter(
    (availableMenuDay) => availableMenuDay._count.options > 0,
  );

  const requestedMenuDaySummary =
    selectableMenuDays.find((menuDay) => menuDay.id === requestedMenuDayId) ?? null;
  const selectedMonthKey = currentMonthKey;
  const selectedMonthStart = getMonthStart(currentMonthKey);
  const daysInSelectedMonth = new Date(
    Date.UTC(
      selectedMonthStart.getUTCFullYear(),
      selectedMonthStart.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  const calendarWeekdays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const menuDayByDateKey = new Map(
    availableMenuDays.map((availableMenuDay) => [
      getDateKey(availableMenuDay.date),
      availableMenuDay,
    ]),
  );
  const visibleSelectableMenuDays = selectableMenuDays.filter(
    (availableMenuDay) => getMonthKey(availableMenuDay.date) === selectedMonthKey,
  );
  const selectedMenuDaySummary =
    requestedMenuDaySummary &&
    getMonthKey(requestedMenuDaySummary.date) === currentMonthKey
      ? requestedMenuDaySummary
      : visibleSelectableMenuDays.find(
          (availableMenuDay) => getDateKey(availableMenuDay.date) === todayKey,
        ) ??
        visibleSelectableMenuDays[0] ??
        null;
  const calendarDays = Array.from({ length: daysInSelectedMonth }, (_, index) => {
    const date = new Date(
      Date.UTC(
        selectedMonthStart.getUTCFullYear(),
        selectedMonthStart.getUTCMonth(),
        index + 1,
      ),
    );
    const dateKey = getDateKey(date);
    const availableMenuDay = menuDayByDateKey.get(dateKey);
    const hasOptions = (availableMenuDay?._count.options ?? 0) > 0;
    const isPast = dateKey < todayKey;

    return {
      date,
      dateKey,
      dayNumber: index + 1,
      availableMenuDay,
      hasOptions,
      isPast,
    };
  });

  const menuDay = selectedMenuDaySummary
    ? await prisma.menuDay.findUnique({
        where: { id: selectedMenuDaySummary.id },
        include: {
          options: {
            where: { isAvailable: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
          selections: {
            include: {
              person: true,
              menuOption: true,
            },
            orderBy: { selectedAt: "asc" },
          },
        },
      })
    : null;

  async function submitSelection(formData: FormData) {
    "use server";

    const personId = String(formData.get("personId") ?? "");
    const menuDayId = String(formData.get("menuDayId") ?? "");
    const menuOptionId = String(formData.get("menuOptionId") ?? "");

    if (!personId || !menuDayId || !menuOptionId) {
      return;
    }

    const [person, selectedMenuDay, option] = await Promise.all([
      prisma.person.findUnique({
        where: { id: personId },
        select: { id: true, isActive: true },
      }),
      prisma.menuDay.findUnique({
        where: { id: menuDayId },
        select: { id: true, isOpen: true },
      }),
      prisma.menuOption.findFirst({
        where: {
          id: menuOptionId,
          menuDayId,
          isAvailable: true,
        },
        select: { id: true },
      }),
    ]);

    if (!person?.isActive || !selectedMenuDay?.isOpen || !option) {
      return;
    }

    await prisma.lunchSelection.upsert({
      where: {
        personId_menuDayId: {
          personId,
          menuDayId,
        },
      },
      update: {
        menuOptionId,
      },
      create: {
        personId,
        menuDayId,
        menuOptionId,
      },
    });

    revalidatePath("/");
  }

  const selectionsByOption = new Map(
    menuDay?.options.map((option) => [option.id, 0]) ?? [],
  );
  const selectedPersonIds = new Set(
    menuDay?.selections.map((selection) => selection.personId) ?? [],
  );
  const availablePeople = people.filter((person) => !selectedPersonIds.has(person.id));

  for (const selection of menuDay?.selections ?? []) {
    selectionsByOption.set(
      selection.menuOptionId,
      (selectionsByOption.get(selection.menuOptionId) ?? 0) + 1,
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
      <section className="rounded-[26px] border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(29,29,27,0.08)] sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:gap-8">
          <div className="max-w-xl space-y-2.5 xl:pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Seleccion diaria
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold leading-none tracking-tight sm:text-4xl xl:text-[2.35rem]">
                Almuerzos Nogales
              </h1>
              <p className="text-[15px] leading-6 text-muted">
                Selecciona una fecha disponible, identificate y confirma tu
                almuerzo.
              </p>
            </div>
          </div>

          <section className="flex min-h-[92px] items-center justify-center rounded-[22px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(251,248,242,0.9))] px-5 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            {menuDay ? (
              <p className="whitespace-nowrap text-lg font-semibold leading-tight tracking-tight sm:text-[1.35rem]">
                {formatMenuDate(menuDay.date)}
              </p>
            ) : (
              <p className="text-sm leading-6 text-muted">
                Todavia no hay fechas de menu disponibles.
              </p>
            )}
          </section>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-6">
          <section className="rounded-[20px] border border-border bg-surface p-5 sm:p-6">
            <div className="flex justify-start">
              <div className="rounded-[10px] border border-border bg-background px-3 py-1.5 text-[13px] font-semibold capitalize text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                {formatMonthHeading(selectedMonthKey)}
              </div>
            </div>

            {availableMenuDays.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
                No hay dias de menu disponibles para elegir.
              </div>
            ) : (
              <div className="mt-5 rounded-[16px] border border-border bg-background px-3 py-3">
                <div className="mb-2 grid grid-cols-7 gap-px text-center text-[7px] font-semibold uppercase tracking-[0.05em] text-muted sm:text-[8px]">
                  {calendarWeekdays.map((weekday) => (
                    <div key={weekday}>{weekday}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-px">
                  {calendarDays.map((day) => {
                    const isSelected = day.availableMenuDay?.id === menuDay?.id;
                    const isToday = day.dateKey === todayKey;

                    if (day.isPast) {
                      return null;
                    }

                    if (day.availableMenuDay && day.hasOptions) {
                      return (
                        <Link
                          key={day.dateKey}
                          href={`/?menuDay=${day.availableMenuDay.id}`}
                          title={`${formatMenuDate(day.date)} · ${day.availableMenuDay._count.options} opciones`}
                          className={`flex h-3.5 w-full items-center justify-center rounded-[3px] border text-[7px] font-semibold leading-none transition hover:bg-surface sm:h-4 sm:text-[8px] ${
                            isSelected
                              ? "border-[var(--accent)] bg-[rgba(180,83,9,0.14)] text-[var(--accent)] ring-1 ring-[rgba(180,83,9,0.2)]"
                              : isToday
                                ? "border-[rgba(180,83,9,0.4)] bg-[rgba(180,83,9,0.08)] text-foreground"
                                : "border-border bg-white text-foreground"
                          }`}
                        >
                          {day.dayNumber}
                        </Link>
                      );
                    }

                    if (day.availableMenuDay && !day.hasOptions) {
                      return (
                        <div
                          key={day.dateKey}
                          title={`${formatMenuDate(day.date)} · Sin opciones cargadas`}
                          className="flex h-3.5 w-full items-center justify-center rounded-[3px] border border-dashed border-border bg-[rgba(255,253,248,0.7)] text-[7px] font-medium leading-none text-muted sm:h-4 sm:text-[8px]"
                        >
                          {day.dayNumber}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={day.dateKey}
                        className="flex h-3.5 w-full items-center justify-center rounded-[3px] border border-transparent bg-transparent text-[7px] font-medium leading-none text-muted sm:h-4 sm:text-[8px]"
                      >
                        {day.dayNumber}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-[3px] border border-border bg-white" />
                    Fecha con menu
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-[3px] border border-[rgba(180,83,9,0.4)] bg-[rgba(180,83,9,0.08)]" />
                    Hoy
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              Identificacion
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Selecciona tu nombre antes de elegir tu almuerzo del dia.
            </p>

            {people.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
                No hay personas activas disponibles. Agregalas desde
                administracion para poder usar el selector.
              </div>
            ) : menuDay && availablePeople.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
                Todas las personas activas ya registraron su eleccion para esta
                fecha.
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-border bg-background px-5 py-5">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Persona</span>
                  <select
                    form="lunch-selection-form"
                    name="personId"
                    required
                    defaultValue=""
                    className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                  >
                    <option value="" disabled>
                      Selecciona tu nombre
                    </option>
                    {availablePeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              Elegir almuerzo
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Cada persona puede dejar una sola seleccion por fecha. Si vuelve a
              enviar el formulario, su opcion anterior se actualiza.
            </p>

            {!menuDay ||
            menuDay.options.length === 0 ||
            people.length === 0 ||
            availablePeople.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
                No hay suficientes datos para registrar selecciones. Revisa que
                existan personas activas, fechas disponibles y opciones cargadas
                para el menu seleccionado.
              </div>
            ) : (
              <form
                id="lunch-selection-form"
                action={submitSelection}
                className="mt-6 space-y-6"
              >
                <input type="hidden" name="menuDayId" value={menuDay.id} />

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Opciones del menu</legend>
                  <div className="rounded-[18px] border border-border bg-background px-4 py-4">
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-[rgba(107,102,93,0.12)] pb-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                        Mosaico del dia
                      </div>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted">
                        {menuDay.options.length} opciones
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {menuDay.options.map((option) => (
                        <label key={option.id} className="block cursor-pointer">
                          <input
                            type="radio"
                            name="menuOptionId"
                            value={option.id}
                            required
                            className="peer sr-only"
                          />
                          <span className="block rounded-[18px] border border-border bg-white px-4 py-4 shadow-[0_10px_30px_-26px_rgba(29,29,27,0.28)] transition duration-150 hover:-translate-y-0.5 hover:bg-surface hover:shadow-[0_16px_28px_-24px_rgba(29,29,27,0.35)] peer-checked:border-[var(--accent)] peer-checked:ring-2 peer-checked:ring-[rgba(180,83,9,0.18)]">
                            <span className="flex items-start justify-between gap-3">
                              <span className="block min-w-0">
                                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                                  Opcion
                                </span>
                                <span className="mt-2 block text-sm font-semibold leading-5">
                                  {option.name}
                                </span>
                              </span>
                              <span className="rounded-[10px] border border-[rgba(107,102,93,0.16)] bg-surface px-2 py-1 text-[11px] font-semibold text-muted peer-checked:border-[rgba(180,83,9,0.2)] peer-checked:text-accent">
                                {selectionsByOption.get(option.id) ?? 0}
                              </span>
                            </span>
                            {option.description ? (
                              <span className="mt-3 block text-sm leading-6 text-muted">
                                {option.description}
                              </span>
                            ) : null}
                            <span className="mt-4 block text-[11px] font-medium text-muted peer-checked:text-accent">
                              Seleccionar esta opcion
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </fieldset>

                <button
                  type="submit"
                  className="rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
                >
                  Confirmar seleccion
                </button>
              </form>
            )}
          </section>
        </div>

        <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            Resumen
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Vista rapida de las selecciones registradas para la fecha elegida.
          </p>

          {!menuDay ? (
            <p className="mt-6 text-sm leading-6 text-muted">
              Cuando exista una fecha disponible, aqui veras el conteo por
              opcion y las personas que ya eligieron.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="space-y-3">
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
                        <h3 className="text-sm font-semibold">{option.name}</h3>
                      </div>
                      <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
                        {selectionsByOption.get(option.id) ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-semibold">Personas que ya eligieron</h3>
                {menuDay.selections.length === 0 ? (
                  <p className="mt-3 text-sm leading-6 text-muted">
                    Aun no hay selecciones registradas.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {menuDay.selections.map((selection) => (
                      <li
                        key={selection.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3"
                      >
                        <span className="text-sm font-medium">
                          {selection.person.name}
                        </span>
                        <span className="text-sm text-muted">
                          {selection.menuOption.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
