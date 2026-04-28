import { isAuthorizedDailyReportRequest } from "@/lib/daily-report";
import { closeAndSendDailyReportEmail } from "@/lib/report-email";

export const dynamic = "force-dynamic";

async function runDailyReport(request: Request) {
  if (!isAuthorizedDailyReportRequest(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await closeAndSendDailyReportEmail();

    return Response.json({ ok: true, result });
  } catch (error) {
    console.error("Daily report cron failed", error);

    return Response.json(
      {
        ok: false,
        error: "Daily report failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return runDailyReport(request);
}

export async function POST(request: Request) {
  return runDailyReport(request);
}
