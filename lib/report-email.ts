import {
  closeTodayMenuDayRequests,
  getDailyReportConfigStatus,
  getDailyReportSummary,
  getCurrentDateKey,
  type DailyRequestsCloseResult,
  type DailyReportSendResult,
} from "@/lib/daily-report";

export type CloseAndSendDailyReportResult = {
  close: DailyRequestsCloseResult;
  email: DailyReportSendResult;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildReportSubject(dateLabel: string) {
  const subjectPrefix = process.env.REPORT_EMAIL_SUBJECT_PREFIX ?? "Resumen almuerzos";

  return `${subjectPrefix} - ${dateLabel}`;
}

function buildReportText(dateLabel: string, items: Array<{ name: string; count: number }>) {
  return [
    `Resumen de elecciones de hoy (${dateLabel})`,
    "",
    ...items.map((item) => `${item.name}: ${item.count}`),
  ].join("\n");
}

function buildReportHtml(dateLabel: string, items: Array<{ name: string; count: number }>) {
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;color:#334155;">${escapeHtml(item.name)}</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f766e;">${item.count}</td></tr>`,
    )
    .join("");

  return [
    `<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;color:#0f172a;">`,
    `<p style="margin:0 0 16px;font-size:14px;color:#64748b;">Resumen de elecciones de hoy (${escapeHtml(dateLabel)})</p>`,
    `<table style="width:100%;border-collapse:collapse;">`,
    rows,
    `</table>`,
    `</div>`,
  ].join("");
}

export async function sendDailyReportEmail(): Promise<DailyReportSendResult> {
  const config = getDailyReportConfigStatus();

  if (!config.isReady) {
    return {
      status: "not_configured",
      missing: config.missing,
    };
  }

  const summary = await getDailyReportSummary();

  if (!summary) {
    return {
      status: "skipped",
      reason: "no_menu_day",
      dateKey: getCurrentDateKey(),
    };
  }

  if (summary.items.length === 0) {
    return {
      status: "skipped",
      reason: "no_available_options",
      dateKey: summary.dateKey,
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REPORT_FROM_EMAIL,
      to: config.recipients,
      subject: buildReportSubject(summary.dateLabel),
      text: buildReportText(summary.dateLabel, summary.items),
      html: buildReportHtml(summary.dateLabel, summary.items),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend email request failed: ${response.status} ${errorText}`);
  }

  const responseData = (await response.json()) as { id?: string };

  return {
    status: "sent",
    summary,
    recipientCount: config.recipients.length,
    deliveryId: responseData.id ?? null,
  };
}

export async function closeAndSendDailyReportEmail(): Promise<CloseAndSendDailyReportResult> {
  const config = getDailyReportConfigStatus();
  const dateKey = getCurrentDateKey();

  if (!config.isReady) {
    return {
      close: {
        status: "skipped",
        reason: "not_configured",
        dateKey,
      },
      email: {
        status: "not_configured",
        missing: config.missing,
      },
    };
  }

  const close = await closeTodayMenuDayRequests();

  if (close.status === "skipped") {
    if (close.reason === "not_configured") {
      return {
        close,
        email: {
          status: "not_configured",
          missing: config.missing,
        },
      };
    }

    return {
      close,
      email: {
        status: "skipped",
        reason: close.reason,
        dateKey: close.dateKey,
      },
    };
  }

  const email = await sendDailyReportEmail();

  return {
    close,
    email,
  };
}
