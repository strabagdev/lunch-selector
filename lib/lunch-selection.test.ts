import assert from "node:assert/strict";
import test from "node:test";
import type { SelectionTrace } from "./selection-trace";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

const PUBLIC_TRACE: SelectionTrace = {
  source: "PUBLIC_WEB",
  ipAddress: "203.0.113.42",
  userAgent: "Lunch Browser/1.0",
  sessionId: "7f9c2ad2-65f1-4bcb-a5b8-91d62c8b9ad1",
};

type SelectionWrite = {
  menuOptionId: string;
  source: SelectionTrace["source"];
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
};

type SelectionUpsertArgs = {
  update: SelectionWrite;
  create: SelectionWrite & {
    personId: string;
    menuDayId: string;
  };
};

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
  const writes: SelectionUpsertArgs[] = [];

  return {
    calls,
    writes,
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
        upsert: async (args: SelectionUpsertArgs) => {
          calls.push(existingSelection ? "lunchSelection.update" : "lunchSelection.create");
          writes.push(args);
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
    PUBLIC_TRACE,
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
    PUBLIC_TRACE,
    store,
  );

  assert.equal(result.status, "rejected");
  assert.equal(calls.includes("lunchSelection.update"), false);
});

test("public selection persists trace metadata on an open day", async () => {
  const { submitLunchSelection } = await import("./lunch-selection");
  const { calls, writes, store } = createSelectionStore();

  const result = await submitLunchSelection(
    {
      personId: "person-1",
      menuDayId: "menu-day-1",
      menuOptionId: "option-1",
      todayKey: "2026-09-08",
    },
    PUBLIC_TRACE,
    store,
  );

  assert.equal(result.status, "saved");
  assert.deepEqual(calls, [
    "person.findUnique",
    "menuDay.findUnique",
    "menuOption.findFirst",
    "lunchSelection.create",
  ]);
  assert.deepEqual(writes[0].create, {
    personId: "person-1",
    menuDayId: "menu-day-1",
    menuOptionId: "option-1",
    ...PUBLIC_TRACE,
  });
  assert.deepEqual(writes[0].update, {
    menuOptionId: "option-1",
    ...PUBLIC_TRACE,
  });
});

test("missing trace values do not prevent saving a selection", async () => {
  const { submitLunchSelection } = await import("./lunch-selection");
  const { writes, store } = createSelectionStore();
  const emptyTrace: SelectionTrace = {
    source: null,
    ipAddress: null,
    userAgent: null,
    sessionId: null,
  };

  const result = await submitLunchSelection(
    {
      personId: "person-1",
      menuDayId: "menu-day-1",
      menuOptionId: "option-1",
      todayKey: "2026-09-08",
    },
    emptyTrace,
    store,
  );

  assert.equal(result.status, "saved");
  assert.equal(writes[0].create.source, null);
  assert.equal(writes[0].create.ipAddress, null);
  assert.equal(writes[0].create.userAgent, null);
  assert.equal(writes[0].create.sessionId, null);
});
