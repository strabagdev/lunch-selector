import {
  getDailyReportConfigStatus,
  getDailyReportSummary,
  type DailyReportSendResult,
} from "@/lib/daily-report";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildReportSubject(dateLabel: string) {
  return `Resumen almuerzos - ${dateLabel}`;
}

function buildReportText(dateLabel: string, items: Array<{ name: string; count: number }>) {
  return [
    `Resumen de elecciones de hoy (${dateLabel})`,
    "",
    ...items.map((item) => `${item.name}: ${item.count}`),
  ].join("\n");
}

function appendNarrativeToReportText(baseText: string, narrative: string | null) {
  if (!narrative) {
    return baseText;
  }

  return [baseText, "", "Comentario ejecutivo", narrative].join("\n");
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

function appendNarrativeToReportHtml(baseHtml: string, narrative: string | null) {
  if (!narrative) {
    return baseHtml;
  }

  return [
    baseHtml,
    `<div style="font-family:Arial,sans-serif;max-width:560px;padding:0 24px 24px;color:#0f172a;">`,
    `<p style="margin:20px 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;">Comentario ejecutivo</p>`,
    `<p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(narrative)}</p>`,
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
      dateKey: new Intl.DateTimeFormat("en-CA", {
        timeZone: process.env.REPORT_TIMEZONE ?? "America/Santiago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
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
      text: appendNarrativeToReportText(
        buildReportText(summary.dateLabel, summary.items),
        summary.narrative.text,
      ),
      html: appendNarrativeToReportHtml(
        buildReportHtml(summary.dateLabel, summary.items),
        summary.narrative.text,
      ),
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
