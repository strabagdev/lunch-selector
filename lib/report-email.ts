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
  whatsapp: DailyReportWhatsAppSendResult;
};

type DailyReportWhatsAppSendResult =
  | {
      status: "sent";
      summary: NonNullable<Awaited<ReturnType<typeof getDailyReportSummary>>>;
      recipientCount: number;
      messageIds: string[];
    }
  | {
      status: "skipped";
      reason: "disabled" | "no_menu_day" | "no_available_options";
      dateKey: string;
    }
  | {
      status: "not_configured";
      missing: string[];
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

function buildReportText(
  dateLabel: string,
  totalSelections: number,
  items: Array<{ name: string; count: number }>,
) {
  return [
    `Resumen de elecciones de hoy (${dateLabel})`,
    `Total: ${totalSelections}`,
    "",
    ...items.map((item, index) => `Menu ${index + 1} - ${item.name}: ${item.count}`),
  ].join("\n");
}

function buildWhatsAppReportText(
  dateLabel: string,
  totalSelections: number,
  items: Array<{ name: string; count: number }>,
) {
  return [
    `Resumen de almuerzos - ${dateLabel}`,
    `Total: ${totalSelections}`,
    "",
    ...items.map((item) => `- ${item.name}: ${item.count}`),
  ].join("\n");
}

function buildReportHtml(
  dateLabel: string,
  totalSelections: number,
  items: Array<{ name: string; count: number }>,
) {
  const columnCount = 3;
  const rows = [];

  for (let index = 0; index < items.length; index += columnCount) {
    const rowItems = items.slice(index, index + columnCount);
    const cells = rowItems
      .map((item, itemIndex) => {
        const menuNumber = index + itemIndex + 1;

        return `
          <td style="width:33.333%;padding:7px;vertical-align:top;">
            <table role="presentation" style="width:100%;height:190px;border-collapse:separate;border-spacing:0;border:1px solid #d9e4df;border-radius:20px;background:#ffffff;box-shadow:0 10px 22px rgba(15,23,42,0.06);">
              <tr>
                <td style="height:190px;padding:22px 14px;text-align:center;vertical-align:middle;">
                  <div style="font-size:54px;line-height:1;font-weight:700;letter-spacing:0;color:#0f766e;">${item.count}</div>
                  <div style="margin-top:14px;font-size:10px;line-height:14px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#71817d;">Menu ${menuNumber}</div>
                  <div style="margin-top:8px;font-size:15px;line-height:20px;font-weight:700;color:#10231f;">${escapeHtml(item.name)}</div>
                </td>
              </tr>
            </table>
          </td>`;
      })
      .join("");
    const emptyCells = Array.from(
      { length: columnCount - rowItems.length },
      () => `<td style="width:33.333%;padding:7px;vertical-align:top;">&nbsp;</td>`,
    ).join("");

    rows.push(`<tr>${cells}${emptyCells}</tr>`);
  }

  return [
    `<!doctype html>`,
    `<html>`,
    `<body style="margin:0;padding:0;background:#f5f9f8;font-family:Arial,Helvetica,sans-serif;color:#10231f;">`,
    `<div style="display:none;max-height:0;overflow:hidden;color:transparent;">Resumen de elecciones de hoy (${escapeHtml(dateLabel)}): ${totalSelections} selecciones totales.</div>`,
    `<table role="presentation" style="width:100%;border-collapse:collapse;background:#f5f9f8;">`,
    `<tr>`,
    `<td align="center" style="padding:28px 14px;">`,
    `<table role="presentation" style="width:100%;max-width:680px;border-collapse:separate;border-spacing:0;border:1px solid #d9e4df;border-radius:26px;background:#ffffff;box-shadow:0 18px 36px rgba(15,23,42,0.08);overflow:hidden;">`,
    `<tr>`,
    `<td style="padding:30px 28px 10px;background:linear-gradient(180deg,#ffffff,#f6fbfa);">`,
    `<div style="font-size:10px;line-height:14px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#0f766e;">Resumen</div>`,
    `<h1 style="margin:8px 0 0;font-size:28px;line-height:34px;font-weight:700;letter-spacing:0;color:#10231f;">${escapeHtml(dateLabel)}</h1>`,
    `<p style="margin:10px 0 0;font-size:15px;line-height:22px;font-weight:600;color:#71817d;">${totalSelections} selecciones totales</p>`,
    `</td>`,
    `</tr>`,
    `<tr>`,
    `<td style="padding:18px 21px 30px;background:#f6fbfa;">`,
    `<table role="presentation" style="width:100%;border-collapse:collapse;">`,
    rows.join(""),
    `</table>`,
    `</td>`,
    `</tr>`,
    `</table>`,
    `<p style="margin:14px 0 0;font-size:12px;line-height:18px;color:#71817d;">Enviado automaticamente por Lunch Selector.</p>`,
    `</td>`,
    `</tr>`,
    `</table>`,
    `</body>`,
    `</html>`,
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
      text: buildReportText(summary.dateLabel, summary.totalSelections, summary.items),
      html: buildReportHtml(
        summary.dateLabel,
        summary.totalSelections,
        summary.items,
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

function getWhatsAppRecipientsFromEnv() {
  return (process.env.WHATSAPP_REPORT_RECIPIENTS ?? process.env.WHATSAPP_TO ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getWhatsAppReportConfigStatus() {
  const missing: string[] = [];
  const recipients = getWhatsAppRecipientsFromEnv();

  if (process.env.WHATSAPP_REPORT_ENABLED !== "1") {
    return {
      isEnabled: false,
      isReady: false,
      missing,
      recipients,
    };
  }

  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    missing.push("WHATSAPP_ACCESS_TOKEN");
  }

  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
    missing.push("WHATSAPP_PHONE_NUMBER_ID");
  }

  if (recipients.length === 0) {
    missing.push("WHATSAPP_REPORT_RECIPIENTS");
  }

  return {
    isEnabled: true,
    isReady: missing.length === 0,
    missing,
    recipients,
  };
}

export async function sendDailyReportWhatsApp(): Promise<DailyReportWhatsAppSendResult> {
  const config = getWhatsAppReportConfigStatus();
  const dateKey = getCurrentDateKey();

  if (!config.isEnabled) {
    return {
      status: "skipped",
      reason: "disabled",
      dateKey,
    };
  }

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
      dateKey,
    };
  }

  if (summary.items.length === 0) {
    return {
      status: "skipped",
      reason: "no_available_options",
      dateKey: summary.dateKey,
    };
  }

  const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const responseMessageIds: string[] = [];
  const body = buildWhatsAppReportText(
    summary.dateLabel,
    summary.totalSelections,
    summary.items,
  );

  for (const recipient of config.recipients) {
    const response = await fetch(
      `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: false,
            body,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `WhatsApp report request failed for ${recipient}: ${response.status} ${errorText}`,
      );
    }

    const responseData = (await response.json()) as {
      messages?: Array<{ id?: string }>;
    };

    responseMessageIds.push(responseData.messages?.[0]?.id ?? "");
  }

  return {
    status: "sent",
    summary,
    recipientCount: config.recipients.length,
    messageIds: responseMessageIds.filter(Boolean),
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
      whatsapp: {
        status: "skipped",
        reason: "disabled",
        dateKey,
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
        whatsapp: {
          status: "skipped",
          reason: "disabled",
          dateKey: close.dateKey,
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
      whatsapp: {
        status: "skipped",
        reason: close.reason,
        dateKey: close.dateKey,
      },
    };
  }

  const email = await sendDailyReportEmail();
  const whatsapp = await sendDailyReportWhatsApp();

  return {
    close,
    email,
    whatsapp,
  };
}
