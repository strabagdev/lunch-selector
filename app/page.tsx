import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HomeFlow } from "./home-flow";
import { QrLauncher } from "./qr-launcher";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    menuDay?: string | string[] | undefined;
    success?: string | string[] | undefined;
    person?: string | string[] | undefined;
    option?: string | string[] | undefined;
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

function formatShortMenuDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
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

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  const weekDay = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - weekDay);
  return weekStart;
}

export default async function Home({ searchParams }: HomePageProps) {
  const shareUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://lunch-selector-production.up.railway.app/";
  const resolvedSearchParams = await searchParams;
  const requestedMenuDayId = getMenuDayParam(resolvedSearchParams.menuDay);
  const successParam = getMenuDayParam(resolvedSearchParams.success);
  const initialPersonId = getMenuDayParam(resolvedSearchParams.person);
  const initialOptionId = getMenuDayParam(resolvedSearchParams.option);
  const todayKey = getTodayKey();
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);
  const visibleRangeStart = getWeekStart(todayDate);
  const visibleRangeEnd = addUtcDays(visibleRangeStart, 13);
  const visibleRangeEndKey = getDateKey(visibleRangeEnd);
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
            menuOption: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const selectableMenuDays = availableMenuDays.filter(
    (availableMenuDay) =>
      availableMenuDay.options.length > 0 &&
      getDateKey(availableMenuDay.date) <= visibleRangeEndKey,
  );

  const requestedMenuDaySummary =
    selectableMenuDays.find((menuDay) => menuDay.id === requestedMenuDayId) ?? null;
  const initialMenuDayId =
    requestedMenuDaySummary?.id ??
    selectableMenuDays.find((availableMenuDay) => getDateKey(availableMenuDay.date) === todayKey)
      ?.id ??
    selectableMenuDays[0]?.id ??
    null;

  const calendarWeekdays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const menuDayByDateKey = new Map(
    selectableMenuDays.map((availableMenuDay) => [
      getDateKey(availableMenuDay.date),
      availableMenuDay,
    ]),
  );
  const calendarDays = Array.from({ length: 14 }, (_, index) => {
    const date = addUtcDays(visibleRangeStart, index);
    const dateKey = getDateKey(date);
    const availableMenuDay = menuDayByDateKey.get(dateKey);

    return {
      kind: "day" as const,
      key: dateKey,
      dateKey,
      dayNumber: date.getUTCDate(),
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
    redirect(
      `/?success=1&person=${encodeURIComponent(personId)}&menuDay=${encodeURIComponent(menuDayId)}&option=${encodeURIComponent(menuOptionId)}`,
    );
  }

  return (
    <>
      <QrLauncher shareUrl={shareUrl} />
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
              shortDateLabel: formatShortMenuDate(menuDay.date),
              dayNumber: menuDay.date.getUTCDate(),
              selectedPersonIds: menuDay.selections.map((selection) => selection.personId),
              selections: menuDay.selections.map((selection) => ({
                personId: selection.personId,
                menuOptionName: selection.menuOption.name,
              })),
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
        initialPersonId={initialPersonId ?? null}
        initialOptionId={initialOptionId ?? null}
        initialSuccess={successParam === "1"}
        submitSelection={submitSelection}
      />
      </main>
    </>
  );
}
