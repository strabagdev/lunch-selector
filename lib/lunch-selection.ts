import { prisma } from "@/lib/prisma";

type LunchSelectionStore = {
  person: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; isActive: true };
    }) => Promise<{ id: string; isActive: boolean } | null>;
  };
  menuDay: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; date: true; isClosed: true };
    }) => Promise<{ id: string; date: Date; isClosed: boolean } | null>;
  };
  menuOption: {
    findFirst: (args: {
      where: { id: string; menuDayId: string; isAvailable: true };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  lunchSelection: {
    upsert: (args: {
      where: { personId_menuDayId: { personId: string; menuDayId: string } };
      update: { menuOptionId: string };
      create: { personId: string; menuDayId: string; menuOptionId: string };
      select: { id: true };
    }) => Promise<{ id: string }>;
  };
};

export type SubmitLunchSelectionResult =
  | { status: "saved" }
  | { status: "rejected" };

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function submitLunchSelection(
  {
    personId,
    menuDayId,
    menuOptionId,
    todayKey,
  }: {
    personId: string;
    menuDayId: string;
    menuOptionId: string;
    todayKey: string;
  },
  db: LunchSelectionStore = prisma,
): Promise<SubmitLunchSelectionResult> {
  if (!personId || !menuDayId || !menuOptionId) {
    return { status: "rejected" };
  }

  const [person, selectedMenuDay, option] = await Promise.all([
    db.person.findUnique({
      where: { id: personId },
      select: { id: true, isActive: true },
    }),
    db.menuDay.findUnique({
      where: { id: menuDayId },
      select: { id: true, date: true, isClosed: true },
    }),
    db.menuOption.findFirst({
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
    selectedMenuDay.isClosed ||
    getDateKey(selectedMenuDay.date) < todayKey
  ) {
    return { status: "rejected" };
  }

  await db.lunchSelection.upsert({
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

  return { status: "saved" };
}
