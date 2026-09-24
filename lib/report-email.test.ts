test("already closed menu still retries pending report deliveries", async () => {
  const { runCloseAndSendDailyReportEmail } = await import("./report-email");
  const calls: string[] = [];

  const result = await runCloseAndSendDailyReportEmail({
    closeTodayMenuDayRequests: async () => {
      calls.push("close");
      return {
        status: "already_closed",
        dateKey: "2026-09-08",
        menuDayId: "menu-day-1",
      };
    },
    sendDailyReportEmail: async () => {
      calls.push("email");
      return {
        status: "sent",
        summary: {
          menuDayId: "menu-day-1",
          dateKey: "2026-09-08",
          dateLabel: "8 de septiembre de 2026",
          totalSelections: 1,
          items: [],
        },
        recipientCount: 1,
        deliveryId: "email-1",
      };
    },
    sendDailyReportWhatsApp: async () => {
      calls.push("whatsapp");
      return {
        status: "skipped",
        reason: "disabled",
        dateKey: "2026-09-08",
      };
    },
  });

  assert.equal(result.close.status, "already_closed");
  assert.equal(result.email.status, "sent");
  assert.deepEqual(calls, ["close", "email", "whatsapp"]);
});
import assert from "node:assert/strict";
import test from "node:test";
import type {
  DailyReportSendResult,
  DailyRequestsCloseResult,
} from "./daily-report";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

function sentWhatsAppResult() {
  return {
    status: "skipped" as const,
    reason: "disabled" as const,
    dateKey: "2026-09-08",
  };
}

test("daily report closes the day even when email is not configured", async () => {
  const { runCloseAndSendDailyReportEmail } = await import("./report-email");
  const calls: string[] = [];
  const closeResult: DailyRequestsCloseResult = {
    status: "closed",
    dateKey: "2026-09-08",
    menuDayId: "menu-day-1",
  };
  const emailResult: DailyReportSendResult = {
    status: "not_configured",
    missing: ["RESEND_API_KEY"],
  };

  const result = await runCloseAndSendDailyReportEmail({
    closeTodayMenuDayRequests: async () => {
      calls.push("close");
      return closeResult;
    },
    sendDailyReportEmail: async () => {
      calls.push("email");
      return emailResult;
    },
    sendDailyReportWhatsApp: async () => {
      calls.push("whatsapp");
      return sentWhatsAppResult();
    },
  });

  assert.equal(result.close.status, "closed");
  assert.equal(result.email.status, "not_configured");
  assert.deepEqual(calls, ["close", "email", "whatsapp"]);
});

test("daily report closes before attempting to send email", async () => {
  const { runCloseAndSendDailyReportEmail } = await import("./report-email");
  const calls: string[] = [];

  await runCloseAndSendDailyReportEmail({
    closeTodayMenuDayRequests: async () => {
      calls.push("close");
      return {
        status: "closed",
        dateKey: "2026-09-08",
        menuDayId: "menu-day-1",
      };
    },
    sendDailyReportEmail: async () => {
      calls.push("email");
      return {
        status: "skipped",
        reason: "no_available_options",
        dateKey: "2026-09-08",
      };
    },
    sendDailyReportWhatsApp: async () => {
      calls.push("whatsapp");
      return sentWhatsAppResult();
    },
  });

  assert.equal(calls[0], "close");
  assert.equal(calls[1], "email");
});
