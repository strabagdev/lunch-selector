import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { MenuOptionCalorieStore } from "./menu-option-calories";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

const {
  estimateAndPersistMenuOptionCalories,
  renameMenuOptionAndEstimateCalories,
  shouldReestimateMenuOptionCalories,
} = await import("./menu-option-calories");
const { getCalorieEstimateDisplay } = await import("./calorie-display");

type StoredOption = {
  id: string;
  name: string;
  caloriesKcal: number | null;
  calorieEstimateStatus: "PENDING" | "ESTIMATED" | "FAILED";
  calorieEstimatedAt: Date | null;
  calorieEstimateModel: string | null;
};

function createStore(options: StoredOption[]) {
  const records = new Map(options.map((option) => [option.id, option]));
  const store: MenuOptionCalorieStore = {
    menuOption: {
      async updateMany({ where, data }) {
        const option = records.get(where.id);
        if (
          !option ||
          option.name !== where.name ||
          (where.calorieEstimateStatus &&
            option.calorieEstimateStatus !== where.calorieEstimateStatus)
        ) {
          return { count: 0 };
        }

        Object.assign(option, data);
        return { count: 1 };
      },
      async update({ where, data }) {
        const option = records.get(where.id);
        if (!option) throw new Error("Option not found");
        Object.assign(option, data);
        return { id: option.id, name: option.name };
      },
    },
  };

  return { records, store };
}

function pendingOption(id: string, name: string): StoredOption {
  return {
    id,
    name,
    caloriesKcal: null,
    calorieEstimateStatus: "PENDING",
    calorieEstimatedAt: null,
    calorieEstimateModel: null,
  };
}

test("different menu options can persist different calorie estimates", async () => {
  const { records, store } = createStore([
    pendingOption("one", "Ensalada griega"),
    pendingOption("two", "Garbanzos con longaniza"),
  ]);
  const values = new Map([
    ["Ensalada griega", 380],
    ["Garbanzos con longaniza", 790],
  ]);

  for (const option of records.values()) {
    await estimateAndPersistMenuOptionCalories(option, {
      store,
      estimate: async (name) => ({
        caloriesKcal: values.get(name) ?? 500,
        model: "test-model",
      }),
      now: () => new Date("2026-09-24T15:00:00.000Z"),
    });
  }

  assert.equal(records.get("one")?.caloriesKcal, 380);
  assert.equal(records.get("two")?.caloriesKcal, 790);
  assert.equal(records.get("one")?.calorieEstimateStatus, "ESTIMATED");
  assert.equal(records.get("one")?.calorieEstimateModel, "test-model");
});

test("renaming an option clears the old estimate and estimates the new name", async () => {
  const original: StoredOption = {
    ...pendingOption("one", "Pollo con arroz"),
    caloriesKcal: 650,
    calorieEstimateStatus: "ESTIMATED",
    calorieEstimatedAt: new Date("2026-09-23T12:00:00.000Z"),
    calorieEstimateModel: "old-model",
  };
  const { records, store } = createStore([original]);
  let estimatedName = "";

  const result = await renameMenuOptionAndEstimateCalories(
    {
      id: "one",
      currentName: "Pollo con arroz",
      nextName: "Ensalada griega",
    },
    {
      store,
      estimate: async (name) => {
        estimatedName = name;
        return { caloriesKcal: 380, model: "new-model" };
      },
    },
  );

  assert.equal(result.status, "estimated");
  assert.equal(estimatedName, "Ensalada griega");
  assert.equal(records.get("one")?.name, "Ensalada griega");
  assert.equal(records.get("one")?.caloriesKcal, 380);
  assert.equal(records.get("one")?.calorieEstimateModel, "new-model");
});

test("an unchanged name does not trigger another estimate", async () => {
  const { records, store } = createStore([pendingOption("one", "Ensalada")]);
  let estimateCount = 0;

  const result = await renameMenuOptionAndEstimateCalories(
    { id: "one", currentName: "Ensalada", nextName: "Ensalada" },
    {
      store,
      estimate: async () => {
        estimateCount += 1;
        return { caloriesKcal: 350, model: "test-model" };
      },
    },
  );

  assert.equal(result.status, "unchanged");
  assert.equal(estimateCount, 0);
  assert.equal(records.get("one")?.calorieEstimateStatus, "PENDING");
});

test("changing availability without changing the name does not require estimation", () => {
  assert.equal(
    shouldReestimateMenuOptionCalories(
      { name: "Ensalada", isAvailable: true },
      { name: "Ensalada", isAvailable: false },
    ),
    false,
  );
});

test("OpenAI failure does not reject the write and leaves a failed null estimate", async () => {
  const { records, store } = createStore([pendingOption("one", "Pastel de choclo")]);

  const result = await estimateAndPersistMenuOptionCalories(
    { id: "one", name: "Pastel de choclo" },
    {
      store,
      estimate: async () => {
        throw new Error("provider unavailable");
      },
    },
  );

  assert.equal(result.status, "failed");
  assert.equal(records.get("one")?.caloriesKcal, null);
  assert.equal(records.get("one")?.calorieEstimateStatus, "FAILED");
  assert.equal(records.get("one")?.calorieEstimatedAt, null);
  assert.equal(records.get("one")?.calorieEstimateModel, null);
});

test("OpenAI failure after a rename preserves the new name and clears old calories", async () => {
  const original: StoredOption = {
    ...pendingOption("one", "Pollo con arroz"),
    caloriesKcal: 650,
    calorieEstimateStatus: "ESTIMATED",
    calorieEstimatedAt: new Date("2026-09-23T12:00:00.000Z"),
    calorieEstimateModel: "old-model",
  };
  const { records, store } = createStore([original]);

  const result = await renameMenuOptionAndEstimateCalories(
    {
      id: "one",
      currentName: "Pollo con arroz",
      nextName: "Pescado con papas",
    },
    {
      store,
      estimate: async () => {
        throw new Error("provider unavailable");
      },
    },
  );

  assert.equal(result.status, "failed");
  assert.equal(records.get("one")?.name, "Pescado con papas");
  assert.equal(records.get("one")?.caloriesKcal, null);
  assert.equal(records.get("one")?.calorieEstimateStatus, "FAILED");
});

test("frontend only displays a valid persisted estimate", () => {
  assert.equal(
    getCalorieEstimateDisplay({
      caloriesKcal: 650,
      calorieEstimateStatus: "ESTIMATED",
    }),
    "≈ 650 kcal",
  );
  assert.equal(
    getCalorieEstimateDisplay({
      caloriesKcal: null,
      calorieEstimateStatus: "PENDING",
    }),
    "Calculando…",
  );
  assert.equal(
    getCalorieEstimateDisplay({
      caloriesKcal: null,
      calorieEstimateStatus: "FAILED",
    }),
    "Estimación no disponible",
  );
});

test("the public frontend no longer contains mock calorie estimates", async () => {
  const source = await readFile(new URL("../app/home-flow.tsx", import.meta.url), "utf8");

  assert.equal(source.includes("MOCK_ENERGY_ESTIMATES_KCAL"), false);
  assert.equal(source.includes("getMockEnergyEstimateKcal"), false);
});
