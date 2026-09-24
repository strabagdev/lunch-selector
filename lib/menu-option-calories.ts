import { estimateMenuOptionCalories } from "@/lib/lunch-ai";
import { prisma } from "@/lib/prisma";

type CalorieStatus = "PENDING" | "ESTIMATED" | "FAILED";

type MenuOptionCalorieWrite = {
  caloriesKcal: number | null;
  calorieEstimateStatus: CalorieStatus;
  calorieEstimatedAt: Date | null;
  calorieEstimateModel: string | null;
};

type UpdateManyArgs = {
  where: {
    id: string;
    name: string;
    calorieEstimateStatus?: CalorieStatus;
  };
  data: MenuOptionCalorieWrite;
};

type UpdateArgs = {
  where: { id: string };
  data: MenuOptionCalorieWrite & { name: string };
  select: { id: true; name: true };
};

export type MenuOptionCalorieStore = {
  menuOption: {
    updateMany: (args: UpdateManyArgs) => Promise<{ count: number }>;
    update: (args: UpdateArgs) => Promise<{ id: string; name: string }>;
  };
};

type CalorieEstimator = (
  name: string,
) => Promise<{ caloriesKcal: number; model: string }>;

type CalorieDependencies = {
  store?: MenuOptionCalorieStore;
  estimate?: CalorieEstimator;
  now?: () => Date;
};

const EMPTY_ESTIMATE: MenuOptionCalorieWrite = {
  caloriesKcal: null,
  calorieEstimateStatus: "PENDING",
  calorieEstimatedAt: null,
  calorieEstimateModel: null,
};

function getStore(store?: MenuOptionCalorieStore) {
  return store ?? (prisma as unknown as MenuOptionCalorieStore);
}

export function shouldReestimateMenuOptionCalories(
  current: { name: string },
  next: { name: string },
) {
  return current.name !== next.name;
}

export async function estimateAndPersistMenuOptionCalories(
  option: { id: string; name: string },
  dependencies: CalorieDependencies = {},
  alreadyPending = false,
) {
  const store = getStore(dependencies.store);
  const estimate = dependencies.estimate ?? estimateMenuOptionCalories;

  if (!alreadyPending) {
    const invalidated = await store.menuOption.updateMany({
      where: { id: option.id, name: option.name },
      data: EMPTY_ESTIMATE,
    });

    if (invalidated.count === 0) {
      return { status: "stale" as const };
    }
  }

  try {
    const result = await estimate(option.name);
    const persisted = await store.menuOption.updateMany({
      where: {
        id: option.id,
        name: option.name,
        calorieEstimateStatus: "PENDING",
      },
      data: {
        caloriesKcal: result.caloriesKcal,
        calorieEstimateStatus: "ESTIMATED",
        calorieEstimatedAt: (dependencies.now ?? (() => new Date()))(),
        calorieEstimateModel: result.model,
      },
    });

    return persisted.count > 0
      ? { status: "estimated" as const, ...result }
      : { status: "stale" as const };
  } catch {
    await store.menuOption.updateMany({
      where: {
        id: option.id,
        name: option.name,
        calorieEstimateStatus: "PENDING",
      },
      data: {
        caloriesKcal: null,
        calorieEstimateStatus: "FAILED",
        calorieEstimatedAt: null,
        calorieEstimateModel: null,
      },
    });

    return { status: "failed" as const };
  }
}

export async function renameMenuOptionAndEstimateCalories(
  input: { id: string; currentName: string; nextName: string },
  dependencies: CalorieDependencies = {},
) {
  if (
    !shouldReestimateMenuOptionCalories(
      { name: input.currentName },
      { name: input.nextName },
    )
  ) {
    return { status: "unchanged" as const };
  }

  const store = getStore(dependencies.store);
  const option = await store.menuOption.update({
    where: { id: input.id },
    data: {
      name: input.nextName,
      ...EMPTY_ESTIMATE,
    },
    select: { id: true, name: true },
  });

  return estimateAndPersistMenuOptionCalories(
    option,
    { ...dependencies, store },
    true,
  );
}
