import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.REPORT_TIMEZONE = "America/Santiago";

function withoutScheduledMinuteOverride(callback: () => void) {
  const previousMinute = process.env.REPORT_SCHEDULED_LOCAL_MINUTE;

  delete process.env.REPORT_SCHEDULED_LOCAL_MINUTE;

  try {
    callback();
  } finally {
    if (previousMinute === undefined) {
      delete process.env.REPORT_SCHEDULED_LOCAL_MINUTE;
    } else {
      process.env.REPORT_SCHEDULED_LOCAL_MINUTE = previousMinute;
    }
  }
}

test("scheduled report window", async (t) => {
  const {
    getScheduledReportLocalMinute,
    getScheduledReportWindowMinutes,
    isWithinScheduledReportWindow,
  } = await import("./daily-report");

  await t.test("uses 09:30 as the default scheduled report time", () => {
    withoutScheduledMinuteOverride(() => {
      delete process.env.REPORT_SCHEDULED_LOCAL_HOUR;
      delete process.env.REPORT_SCHEDULED_WINDOW_MINUTES;

      const schedule = isWithinScheduledReportWindow(
        new Date("2026-09-08T12:30:00.000Z"),
      );

      assert.equal(schedule.scheduledHour, 9);
      assert.equal(schedule.scheduledMinute, 30);
      assert.equal(getScheduledReportLocalMinute(), 30);
      assert.equal(getScheduledReportWindowMinutes(), 15);
      assert.equal(schedule.windowMinutes, 15);
      assert.equal(schedule.isWithinWindow, true);
    });
  });
  await t.test("accepts 09:30 through 09:44 and rejects 09:45", () => {
    withoutScheduledMinuteOverride(() => {
      delete process.env.REPORT_SCHEDULED_LOCAL_HOUR;
      delete process.env.REPORT_SCHEDULED_WINDOW_MINUTES;

      const schedules = [
        isWithinScheduledReportWindow(new Date("2026-09-08T12:30:00.000Z")),
        isWithinScheduledReportWindow(new Date("2026-09-08T12:44:59.000Z")),
        isWithinScheduledReportWindow(new Date("2026-09-08T12:45:00.000Z")),
      ];

      assert.deepEqual(
        schedules.map((schedule) => schedule.isWithinWindow),
        [true, true, false],
      );
    });
  });


  await t.test("summer time in Chile sends only on the matching UTC run", () => {
    withoutScheduledMinuteOverride(() => {
      const summerRuns = [
        isWithinScheduledReportWindow(new Date("2026-09-08T12:30:00.000Z")),
        isWithinScheduledReportWindow(new Date("2026-09-08T13:30:00.000Z")),
      ];

      assert.deepEqual(
        summerRuns.map((schedule) => schedule.isWithinWindow),
        [true, false],
      );
      assert.deepEqual(
        summerRuns.map(
          (schedule) => `${schedule.currentHour}:${schedule.currentMinute}`,
        ),
        ["9:30", "10:30"],
      );
    });
  });

  await t.test("winter time in Chile sends only on the matching UTC run", () => {
    withoutScheduledMinuteOverride(() => {
      const winterRuns = [
        isWithinScheduledReportWindow(new Date("2026-06-08T12:30:00.000Z")),
        isWithinScheduledReportWindow(new Date("2026-06-08T13:30:00.000Z")),
      ];

      assert.deepEqual(
        winterRuns.map((schedule) => schedule.isWithinWindow),
        [false, true],
      );
      assert.deepEqual(
        winterRuns.map(
          (schedule) => `${schedule.currentHour}:${schedule.currentMinute}`,
        ),
        ["8:30", "9:30"],
      );
    });
  });
});
