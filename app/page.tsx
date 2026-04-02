import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buildHomeMenuNarrativeFallback,
  generateHomeMenuNarrative,
} from "@/lib/lunch-ai";
import { prisma } from "@/lib/prisma";
import { HomeFlow } from "./home-flow";
import { QrLauncher } from "./qr-launcher";

export const dynamic = "force-dynamic";
const CUTOFF_NOTICE = "Hora de corte 09:00 AM";

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

function mapMenuDayForHome(menuDay: {
  id: string;
  date: Date;
  options: Array<{
    id: string;
    name: string;
  }>;
  selections: Array<{
    personId: string;
    menuOptionId: string;
    menuOption: {
      name: string;
    };
  }>;
}) {
  const selectionCountByOption = new Map(menuDay.options.map((option) => [option.id, 0]));

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
  const todayMonthKey = todayKey.slice(0, 7);
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);
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
        isClosed: true,
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
      !(getDateKey(availableMenuDay.date) === todayKey && availableMenuDay.isClosed),
  );
  const todayMenuDay =
    availableMenuDays.find((availableMenuDay) => getDateKey(availableMenuDay.date) === todayKey) ??
    null;
  const todayMenuSummary = todayMenuDay ? mapMenuDayForHome(todayMenuDay) : null;
  const isTodayClosed = todayMenuDay?.isClosed ?? false;
  const todayMenuNarrative = todayMenuSummary
    ? await (async () => {
        const items = todayMenuSummary.options.map((option) => ({
          name: option.name,
          count: option.selectionCount,
        }));
        const sortedItems = [...items].sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count;
          }

          return left.name.localeCompare(right.name, "es");
        });
        const topChoice = sortedItems[0] ?? null;

        try {
          const generated = await generateHomeMenuNarrative({
            dateLabel: todayLabel,
            totalSelections: todayMenuSummary.selections.length,
            isClosed: isTodayClosed,
            items,
            topChoice: topChoice
              ? {
                  name: topChoice.name,
                  count: topChoice.count,
                }
              : null,
          });

          if (generated) {
            return {
              text: generated.text,
              model: generated.model,
            };
          }
        } catch (error) {
          console.error("Home menu AI narrative failed", error);
        }

        return {
          text: buildHomeMenuNarrativeFallback({
            dateLabel: todayLabel,
            totalSelections: todayMenuSummary.selections.length,
            isClosed: isTodayClosed,
            items,
            topChoice: topChoice
              ? {
                  name: topChoice.name,
                  count: topChoice.count,
                }
              : null,
          }),
          model: null,
        };
      })()
    : null;

  const requestedMenuDaySummary =
    selectableMenuDays.find((menuDay) => menuDay.id === requestedMenuDayId) ?? null;
  const initialMenuDayId =
    requestedMenuDaySummary?.id ??
    selectableMenuDays.find((availableMenuDay) => getDateKey(availableMenuDay.date) === todayKey)
      ?.id ??
    selectableMenuDays[0]?.id ??
    null;

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
      getDateKey(selectedMenuDay.date) < todayKey ||
      (getDateKey(selectedMenuDay.date) === todayKey && isTodayClosed)
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
      <Link
        href="/admin"
        className="fixed right-5 top-[8.25rem] z-40 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold shadow-[0_12px_32px_rgba(29,29,27,0.14)] transition-colors hover:bg-background"
      >
        AD
      </Link>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-8 sm:py-10 lg:px-10">
        <HomeFlow
          people={people}
          todayLabel={todayLabel}
          todayNarrative={todayMenuNarrative}
          todayMenuOptions={todayMenuSummary?.options ?? []}
          todaySelectionCount={todayMenuSummary?.selections.length ?? 0}
          todayMonthKey={todayMonthKey}
          cutoffNotice={CUTOFF_NOTICE}
          isTodayClosed={isTodayClosed}
          menuDays={selectableMenuDays.map(mapMenuDayForHome)}
          coverageMenuDays={availableMenuDays
            .filter((menuDay) => menuDay.options.length > 0)
            .map(mapMenuDayForHome)}
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
