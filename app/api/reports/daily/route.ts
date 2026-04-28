import { getReportCronSecrets } from "@/lib/daily-report";
import { closeAndSendDailyReportEmail } from "@/lib/report-email";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secrets = getReportCronSecrets();

  if (secrets.length === 0) {
    return false;
  }

  const authorizationHeader = request.headers.get("authorization");
  const requestUrl = new URL(request.url);
  const querySecret = requestUrl.searchParams.get("secret");

  return secrets.some(
    (secret) =>
      authorizationHeader === `Bearer ${secret}` || querySecret === secret,
  );
}

async function runDailyReport(request: Request) {
  if (!isAuthorized(request)) {
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
