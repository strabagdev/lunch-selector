import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSelectionAuditWhere,
  describeSelectionDevice,
  formatAuditDateTime,
  formatTraceValue,
  getSelectionSourceLabel,
  getSharedSessionPersonCounts,
  parseSelectionAuditFilters,
} from "./selection-audit";

test("audit timestamps are presented in America/Santiago", () => {
  assert.equal(
    formatAuditDateTime(new Date("2026-06-08T13:30:45.000Z")),
    "08-06-2026 09:30:45",
  );
  assert.equal(
    formatAuditDateTime(new Date("2026-09-08T12:30:45.000Z")),
    "08-09-2026 09:30:45",
  );
});

test("device description recognizes Chrome on Windows", () => {
  assert.equal(
    describeSelectionDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
    ),
    "Chrome · Windows",
  );
});

test("device description recognizes Safari on iPhone", () => {
  assert.equal(
    describeSelectionDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
    ),
    "Safari · iPhone",
  );
});

test("one person using a session is not marked as shared", () => {
  const shared = getSharedSessionPersonCounts([
    { sessionId: "session-1", personId: "person-1" },
  ]);

  assert.equal(shared.has("session-1"), false);
});

test("two distinct people using one session are marked as shared", () => {
  const shared = getSharedSessionPersonCounts([
    { sessionId: "session-1", personId: "person-1" },
    { sessionId: "session-1", personId: "person-2" },
  ]);

  assert.equal(shared.get("session-1"), 2);
});

test("repeated selections by one person do not make a shared session", () => {
  const shared = getSharedSessionPersonCounts([
    { sessionId: "session-1", personId: "person-1" },
    { sessionId: "session-1", personId: "person-1" },
  ]);

  assert.equal(shared.has("session-1"), false);
});

test("null session ids are never grouped together", () => {
  const shared = getSharedSessionPersonCounts([
    { sessionId: null, personId: "person-1" },
    { sessionId: null, personId: "person-2" },
  ]);

  assert.equal(shared.size, 0);
});

test("historical null trace values use neutral labels", () => {
  assert.equal(formatTraceValue(null), "Sin información");
  assert.equal(getSelectionSourceLabel(null), "Sin información");
  assert.equal(describeSelectionDevice(null), "Sin información");
});

test("audit filters are normalized and produce a server query", () => {
  const filters = parseSelectionAuditFilters({
    date: "2026-09-08",
    person: "person-1",
    source: "PUBLIC_WEB",
    shared: "1",
    page: "2",
  });
  const where = buildSelectionAuditWhere(filters, ["session-1"]);

  assert.deepEqual(filters, {
    date: "2026-09-08",
    personId: "person-1",
    source: "PUBLIC_WEB",
    sharedOnly: true,
    page: 2,
  });
  assert.deepEqual(where, {
    menuDay: { date: new Date("2026-09-08T00:00:00.000Z") },
    personId: "person-1",
    source: "PUBLIC_WEB",
    sessionId: { in: ["session-1"] },
  });
});

test("invalid filter values are ignored", () => {
  assert.deepEqual(
    parseSelectionAuditFilters({
      date: "08-09-2026",
      source: "PUBLIC",
      page: "-2",
    }),
    {
      date: null,
      personId: null,
      source: null,
      sharedOnly: false,
      page: 1,
    },
  );
});
