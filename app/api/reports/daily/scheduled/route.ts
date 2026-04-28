import {
  getCurrentReportLocalHour,
  getScheduledReportLocalHour,
  isAuthorizedDailyReportRequest,
  REPORT_TIMEZONE,
} from "@/lib/daily-report";
import { closeAndSendDailyReportEmail } from "@/lib/report-email";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedDailyReportRequest(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const currentHour = getCurrentReportLocalHour();
  const scheduledHour = getScheduledReportLocalHour();

  if (currentHour !== scheduledHour) {
    return Response.json({
      ok: true,
      result: {
        status: "skipped",
        reason: "outside_scheduled_hour",
        timezone: REPORT_TIMEZONE,
        currentHour,
        scheduledHour,
      },
    });
  }

  try {
    const result = await closeAndSendDailyReportEmail();

    return Response.json({ ok: true, result });
  } catch (error) {
    console.error("Scheduled daily report failed", error);

    return Response.json(
      {
        ok: false,
        error: "Daily report failed",
      },
      { status: 500 },
    );
  }
}
