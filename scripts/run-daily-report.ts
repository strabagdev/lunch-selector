import {
  isWithinScheduledReportWindow,
  REPORT_TIMEZONE,
} from "../lib/daily-report";
import { prisma } from "../lib/prisma";
import { closeAndSendDailyReportEmail } from "../lib/report-email";

async function main() {
  const schedule = isWithinScheduledReportWindow();

  if (!schedule.isWithinWindow) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          result: {
            status: "skipped",
            reason: "outside_scheduled_time",
            timezone: REPORT_TIMEZONE,
            currentHour: schedule.currentHour,
            currentMinute: schedule.currentMinute,
            scheduledHour: schedule.scheduledHour,
            scheduledMinute: schedule.scheduledMinute,
            windowMinutes: schedule.windowMinutes,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await closeAndSendDailyReportEmail();

  console.log(JSON.stringify({ ok: true, result }, null, 2));
}

main()
  .catch((error) => {
    console.error("Scheduled daily report command failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
