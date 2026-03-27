import { sendDailyReportEmail } from "@/lib/report-email";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.REPORT_CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authorizationHeader = request.headers.get("authorization");

  return authorizationHeader === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendDailyReportEmail();

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
