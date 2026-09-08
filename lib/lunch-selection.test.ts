import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

function createSelectionStore({
  isClosed = false,
  personIsActive = true,
  hasOption = true,
  existingSelection = false,
}: {
  isClosed?: boolean;
  personIsActive?: boolean;
  hasOption?: boolean;
  existingSelection?: boolean;
} = {}) {
  const calls: string[] = [];

  return {
    calls,
    store: {
      person: {
        findUnique: async () => {
          calls.push("person.findUnique");
          return { id: "person-1", isActive: personIsActive };
        },
      },
      menuDay: {
        findUnique: async () => {
          calls.push("menuDay.findUnique");
          return {
            id: "menu-day-1",
            date: new Date("2026-09-08T00:00:00.000Z"),
            isClosed,
          };
        },
      },
      menuOption: {
        findFirst: async () => {
          calls.push("menuOption.findFirst");
          return hasOption ? { id: "option-1" } : null;
        },
      },
      lunchSelection: {
        upsert: async (args: {
          update: { menuOptionId: string };
          create: { personId: string; menuDayId: string; menuOptionId: string };
        }) => {
          calls.push(existingSelection ? "lunchSelection.update" : "lunchSelection.create");
          assert.equal(args.update.menuOptionId, "option-1");
          assert.equal(args.create.personId, "person-1");
          return { id: "selection-1" };
        },
      },
    },
  };
}

test("selection is rejected if the day closed after the page was rendered", async () => {
  const { submitLunchSelection } = await import("./lunch-selection");
  const { calls, store } = createSelectionStore({ isClosed: true });

  const result = await submitLunchSelection(
    {
      personId: "person-1",
      menuDayId: "menu-day-1",
      menuOptionId: "option-1",
      todayKey: "2026-09-08",
    },
    store,
  );

  assert.equal(result.status, "rejected");
  assert.equal(calls.includes("lunchSelection.create"), false);
  assert.equal(calls.includes("lunchSelection.update"), false);
});

test("selection modification is rejected on a closed day", async () => {
  const { submitLunchSelection } = await import("./lunch-selection");
  const { calls, store } = createSelectionStore({
    isClosed: true,
    existingSelection: true,
  });

  const result = await submitLunchSelection(
    {
      personId: "person-1",
      menuDayId: "menu-day-1",
      menuOptionId: "option-1",
      todayKey: "2026-09-08",
    },
    store,
  );

  assert.equal(result.status, "rejected");
  assert.equal(calls.includes("lunchSelection.update"), false);
});

test("selection is saved normally on an open day", async () => {
  const { submitLunchSelection } = await import("./lunch-selection");
  const { calls, store } = createSelectionStore();

  const result = await submitLunchSelection(
    {
      personId: "person-1",
      menuDayId: "menu-day-1",
      menuOptionId: "option-1",
      todayKey: "2026-09-08",
    },
    store,
  );

  assert.equal(result.status, "saved");
  assert.deepEqual(calls, [
    "person.findUnique",
    "menuDay.findUnique",
    "menuOption.findFirst",
    "lunchSelection.create",
  ]);
});
