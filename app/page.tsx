import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HomeFlow } from "./home-flow";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    menuDay?: string | string[] | undefined;
    success?: string | string[] | undefined;
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

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedMenuDayId = getMenuDayParam(resolvedSearchParams.menuDay);
  const successParam = getMenuDayParam(resolvedSearchParams.success);
  const todayKey = getTodayKey();
  const currentMonthKey = todayKey.slice(0, 7);
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);
  const monthStart = new Date(`${currentMonthKey}-01T00:00:00.000Z`);
  const todayLabel = formatMenuDate(todayDate);

  const [people, availableMenuDays] = await Promise.all([
    prisma.person.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.menuDay.findMany({
      where: {
        date: {
          gte: todayDate,
        },
      },
      orderBy: { date: "asc" },
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
            personId: true,
            menuOptionId: true,
          },
        },
      },
    }),
  ]);

  const selectableMenuDays = availableMenuDays.filter(
    (availableMenuDay) =>
      getMonthKey(availableMenuDay.date) === currentMonthKey &&
      availableMenuDay.options.length > 0,
  );

  const requestedMenuDaySummary =
    selectableMenuDays.find((menuDay) => menuDay.id === requestedMenuDayId) ?? null;
  const initialMenuDayId =
    requestedMenuDaySummary?.id ??
    selectableMenuDays.find((availableMenuDay) => getDateKey(availableMenuDay.date) === todayKey)
      ?.id ??
    selectableMenuDays[0]?.id ??
    null;

  const daysInSelectedMonth = new Date(
    Date.UTC(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  const calendarWeekdays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const menuDayByDateKey = new Map(
    selectableMenuDays.map((availableMenuDay) => [
      getDateKey(availableMenuDay.date),
      availableMenuDay,
    ]),
  );
  const calendarDays = Array.from({ length: daysInSelectedMonth }, (_, index) => {
    const date = new Date(
      Date.UTC(
        monthStart.getUTCFullYear(),
        monthStart.getUTCMonth(),
        index + 1,
      ),
    );
    const dateKey = getDateKey(date);
    const availableMenuDay = menuDayByDateKey.get(dateKey);

    return {
      dateKey,
      dayNumber: index + 1,
      isPast: dateKey < todayKey,
      menuDayId: availableMenuDay?.id ?? null,
      hasOptions: availableMenuDay ? availableMenuDay.options.length > 0 : false,
    };
  });

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
        select: { id: true, date: true },
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

    if (
      !person?.isActive ||
      !selectedMenuDay ||
      !option ||
      getDateKey(selectedMenuDay.date) < todayKey
    ) {
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
      select: {
        id: true,
      },
    });

    revalidatePath("/");
    revalidatePath("/admin");
    redirect("/?success=1");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
      <HomeFlow
        people={people}
        todayLabel={todayLabel}
        menuDays={selectableMenuDays.map((menuDay) => {
          const selectionCountByOption = new Map(
            menuDay.options.map((option) => [option.id, 0]),
          );

          for (const selection of menuDay.selections) {
            selectionCountByOption.set(
              selection.menuOptionId,
              (selectionCountByOption.get(selection.menuOptionId) ?? 0) + 1,
            );
          }

          return {
            id: menuDay.id,
            dateKey: getDateKey(menuDay.date),
            fullDateLabel: formatMenuDate(menuDay.date),
            dayNumber: menuDay.date.getUTCDate(),
            selectedPersonIds: menuDay.selections.map((selection) => selection.personId),
            options: menuDay.options.map((option) => ({
              id: option.id,
              name: option.name,
              selectionCount: selectionCountByOption.get(option.id) ?? 0,
            })),
          };
        })}
        calendarWeekdays={calendarWeekdays}
        calendarDays={calendarDays}
        initialMenuDayId={initialMenuDayId}
        initialSuccess={successParam === "1"}
        submitSelection={submitSelection}
      />
    </main>
  );
}
