import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import ConfirmSubmitButton from "@/app/admin/confirm-submit-button";
import {
  getStoredHomeMenuNarrative,
  resetHomeMenuNarrative,
} from "@/lib/lunch-ai";
import {
  getDailyReportConfigStatus,
} from "@/lib/daily-report";
import { closeAndSendDailyReportEmail } from "@/lib/report-email";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    menuDay?: string | string[] | undefined;
    report?: string | string[] | undefined;
    narrative?: string | string[] | undefined;
  }>;
};

function getMenuDayParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatMenuDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortMenuDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
  }).format(date);
}

function formatSelectionTime(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function renderBoldMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*.*?\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedMenuDayId = getMenuDayParam(resolvedSearchParams.menuDay);
  const reportStatus = getMenuDayParam(resolvedSearchParams.report);
  const narrativeStatus = getMenuDayParam(resolvedSearchParams.narrative);
  const dailyReportConfig = getDailyReportConfigStatus();
  const todayKey = getTodayKey();
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);

  async function sendManualDailyReport() {
    "use server";

    let nextReportStatus = "send-error";

    try {
      const result = await closeAndSendDailyReportEmail();

      if (result.email.status === "not_configured") {
        nextReportStatus = "not-configured";
      } else if (result.close.status === "skipped") {
        nextReportStatus = "no-menu";
      } else if (result.close.status === "already_closed") {
        nextReportStatus = "already-closed";
      } else if (result.email.status === "sent") {
        revalidatePath("/");
        revalidatePath("/admin");
        nextReportStatus = "sent";
      } else {
        nextReportStatus = "send-skipped";
      }
    } catch (error) {
      console.error("Daily report send failed", error);
    }

    const nextParams = new URLSearchParams();

    if (requestedMenuDayId) {
      nextParams.set("menuDay", requestedMenuDayId);
    }

    nextParams.set("report", nextReportStatus);
    redirect(`/admin?${nextParams.toString()}`);
  }

  async function deleteSelection(formData: FormData) {
    "use server";

    const selectionId = String(formData.get("selectionId") ?? "");

    if (!selectionId) {
      return;
    }

    await prisma.lunchSelection.delete({
      where: { id: selectionId },
      select: { id: true },
    });

    revalidatePath("/admin");
    revalidatePath("/");
  }

  async function regenerateHomeNarrative() {
    "use server";

    const result = await resetHomeMenuNarrative(todayDate);
    revalidatePath("/");
    revalidatePath("/admin");

    const nextParams = new URLSearchParams();

    if (requestedMenuDayId) {
      nextParams.set("menuDay", requestedMenuDayId);
    }

    nextParams.set("narrative", result.reason === "ok" ? "regenerated" : result.reason);
    redirect(`/admin?${nextParams.toString()}`);
  }

  const [todayMenuDayStatus, menuDays, currentNarrative] = await Promise.all([
    prisma.menuDay.findUnique({
      where: { date: todayDate },
      select: {
        id: true,
        isClosed: true,
      },
    }),
    prisma.menuDay.findMany({
      where: {
        date: {
          gte: todayDate,
        },
        options: {
          some: {
            isAvailable: true,
          },
        },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        isClosed: true,
        _count: {
          select: {
            selections: true,
            options: {
              where: {
                isAvailable: true,
              },
            },
          },
        },
      },
    }),
    getStoredHomeMenuNarrative(todayDate),
  ]);

  const selectedMenuDaySummary =
    menuDays.find((menuDay) => menuDay.id === requestedMenuDayId) ??
    menuDays.find(
      (menuDay) => menuDay.date.toISOString().slice(0, 10) === todayKey,
    ) ??
    menuDays[0] ??
    null;
  const isTodayClosed = todayMenuDayStatus?.isClosed ?? false;

  const menuDay = selectedMenuDaySummary
    ? await prisma.menuDay.findUnique({
        where: { id: selectedMenuDaySummary.id },
        select: {
          id: true,
          date: true,
          options: {
            where: { isAvailable: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              sortOrder: true,
            },
          },
          selections: {
            select: {
              id: true,
              personId: true,
              menuOptionId: true,
              selectedAt: true,
              person: {
                select: {
                  id: true,
                  name: true,
                },
              },
              menuOption: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: [{ selectedAt: "desc" }],
          },
        },
      })
    : null;

  const selectionsByOption = new Map(
    menuDay?.options.map((option) => [option.id, 0]) ?? [],
  );

  for (const selection of menuDay?.selections ?? []) {
    selectionsByOption.set(
      selection.menuOptionId,
      (selectionsByOption.get(selection.menuOptionId) ?? 0) + 1,
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Reporte diario
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Cierre diario
            </h2>
            <p className="text-sm leading-6 text-muted">
              Cierra la toma de solicitudes del d&iacute;a actual y env&iacute;a el
              correo resumen a los destinatarios configurados.
            </p>
            <p className="text-xs leading-5 text-muted">
              Estado de hoy: {isTodayClosed ? "cerrado" : "abierto"}.
            </p>
            {dailyReportConfig.recipients.length > 0 ? (
              <p className="text-xs leading-5 text-muted">
                Destinatarios: {dailyReportConfig.recipients.join(", ")}
              </p>
            ) : null}
          </div>

          <form action={sendManualDailyReport} className="w-full sm:w-auto">
            <button
              type="submit"
              disabled={isTodayClosed}
              className="w-full rounded-[16px] bg-[linear-gradient(180deg,var(--accent),#0a5a54)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_26px_-16px_rgba(15,23,42,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Cerrar y enviar resumen
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Comentario diario
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Regenerar
            </h2>
            <p className="text-sm leading-6 text-muted">
              Puedes limpiar el comentario actual para que la portada genere uno nuevo
              para el d&iacute;a en la siguiente carga.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[320px]">
            <form action={regenerateHomeNarrative} className="w-full sm:w-auto">
              <button
                type="submit"
                className="w-full rounded-[16px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-5 py-3 text-sm font-medium text-[var(--accent)] transition hover:brightness-95 sm:w-auto"
              >
                Regenerar comentario del d&iacute;a
              </button>
            </form>

            <div className="rounded-[18px] border border-border bg-[var(--card)] p-3 shadow-[var(--shadow-soft)]">
              <div className="min-w-0 rounded-[14px] bg-[rgba(17,32,28,0.03)] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Actual
                </p>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-foreground">
                  {currentNarrative?.text
                    ? renderBoldMarkdown(currentNarrative.text)
                    : "Aun no hay comentario diario guardado."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {reportStatus === "sent" ? (
          <div className="mt-4 rounded-[18px] border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.06)] px-4 py-3 text-sm text-[var(--accent)]">
            La toma de solicitudes fue cerrada y el resumen fue enviado correctamente.
          </div>
        ) : null}

        {reportStatus === "already-closed" ? (
          <div className="mt-4 rounded-[18px] border border-border bg-background px-4 py-3 text-sm text-muted">
            Las solicitudes de hoy ya estaban cerradas.
          </div>
        ) : null}

        {reportStatus === "no-menu" ? (
          <div className="mt-4 rounded-[18px] border border-border bg-background px-4 py-3 text-sm text-muted">
            Hoy no hay un men&uacute; configurado para cerrar solicitudes.
          </div>
        ) : null}

        {reportStatus === "close-error" ? (
          <div className="mt-4 rounded-[18px] border border-[rgba(220,63,97,0.16)] bg-[rgba(220,63,97,0.06)] px-4 py-3 text-sm text-[var(--danger)]">
            No se pudieron cerrar las solicitudes de hoy. Revisa los logs del despliegue.
          </div>
        ) : null}

        {reportStatus === "not-configured" ? (
          <div className="mt-4 rounded-[18px] border border-[rgba(220,63,97,0.16)] bg-[rgba(220,63,97,0.06)] px-4 py-3 text-sm text-[var(--danger)]">
            Falta configurar Resend, remitente o destinatarios para enviar el resumen.
          </div>
        ) : null}

        {reportStatus === "send-skipped" ? (
          <div className="mt-4 rounded-[18px] border border-border bg-background px-4 py-3 text-sm text-muted">
            El d&iacute;a fue cerrado, pero no hab&iacute;a opciones disponibles para enviar.
          </div>
        ) : null}

        {reportStatus === "send-error" ? (
          <div className="mt-4 rounded-[18px] border border-[rgba(220,63,97,0.16)] bg-[rgba(220,63,97,0.06)] px-4 py-3 text-sm text-[var(--danger)]">
            No se pudo enviar el resumen de hoy. Revisa los logs del despliegue.
          </div>
        ) : null}

        {narrativeStatus === "regenerated" ? (
          <div className="mt-4 rounded-[18px] border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.06)] px-4 py-3 text-sm text-[var(--accent)]">
            El comentario del d&iacute;a se limpiar&aacute; y se regenerar&aacute; en la pr&oacute;xima carga de la portada.
          </div>
        ) : null}

        {narrativeStatus === "cache_disabled" ? (
          <div className="mt-4 rounded-[18px] border border-border bg-background px-4 py-3 text-sm text-muted">
            La cache del comentario diario est&aacute; desactivada en este entorno.
          </div>
        ) : null}

        {narrativeStatus === "error" ? (
          <div className="mt-4 rounded-[18px] border border-[rgba(220,63,97,0.16)] bg-[rgba(220,63,97,0.06)] px-4 py-3 text-sm text-[var(--danger)]">
            No se pudo regenerar el comentario del d&iacute;a. Revisa los logs del despliegue.
          </div>
        ) : null}
      </section>

      <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
        {menuDays.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
            A&uacute;n no hay d&iacute;as de men&uacute; con opciones cargadas.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
            {menuDays.map((availableMenuDay) => {
              const isSelected = availableMenuDay.id === menuDay?.id;

              return (
                <Link
                  key={availableMenuDay.id}
                  href={`/admin?menuDay=${availableMenuDay.id}`}
                  className={`min-w-0 rounded-[16px] border px-3 py-2 text-sm transition-colors sm:min-w-[76px] ${
                    isSelected
                      ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-border)]"
                      : "border-border bg-[var(--card)] text-foreground hover:bg-[var(--surface-strong)]"
                  }`}
                >
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {formatShortMenuDate(availableMenuDay.date)}
                  </span>
                  <span className="mt-1.5 block text-base font-semibold tracking-tight">
                    {new Intl.DateTimeFormat("es-CL", {
                      timeZone: "UTC",
                      day: "2-digit",
                    }).format(availableMenuDay.date)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {!menuDay ? null : (
        <div className="space-y-6">
          <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                  Resumen
                </p>
                <h3 className="text-2xl font-semibold tracking-tight">
                  {formatMenuDate(menuDay.date)}
                </h3>
              </div>
              <p className="text-sm font-medium text-muted">
                {menuDay.selections.length} selecciones totales
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
              {menuDay.options.map((option, index) => (
                <div
                  key={option.id}
                  className="rounded-[20px] border border-border bg-[var(--card)] px-3 py-4 text-center shadow-[var(--shadow-soft)] sm:px-5 sm:py-6"
                >
                  <div className="flex items-center justify-center">
                    <span className="text-3xl font-semibold leading-none tracking-tight text-accent sm:text-6xl">
                      {selectionsByOption.get(option.id) ?? 0}
                    </span>
                  </div>
                  <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted sm:text-[11px] sm:tracking-[0.16em]">
                    Menu {index + 1}
                  </p>
                  <h4 className="mt-2 text-xs font-semibold leading-4 sm:mt-3 sm:text-base sm:leading-5">
                    {option.name}
                  </h4>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <h3 className="text-xl font-semibold tracking-tight">
              Personas que ya eligieron
            </h3>

            {menuDay.selections.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-muted">
                A&uacute;n no hay selecciones registradas para esta fecha.
              </p>
            ) : (
              <div className="mt-6 overflow-hidden rounded-[20px] border border-border bg-[var(--card)] shadow-[var(--shadow-soft)]">
                <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_72px_auto] gap-3 border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:grid">
                  <span>Persona</span>
                  <span>Men&uacute;</span>
                  <span>Hora</span>
                  <span>Acci&oacute;n</span>
                </div>

                <div className="divide-y divide-border">
                  {menuDay.selections.map((selection) => (
                    <div key={selection.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3 sm:hidden">
                        <div className="min-w-0 flex-1 space-y-1">
                          <span className="block truncate text-sm font-medium">
                            {selection.person.name}
                          </span>
                          <span className="block text-sm text-muted">
                            {selection.menuOption.name}
                          </span>
                          <span className="block text-xs text-muted">
                            {formatSelectionTime(selection.selectedAt)}
                          </span>
                        </div>
                        <form action={deleteSelection}>
                          <input type="hidden" name="selectionId" value={selection.id} />
                          <ConfirmSubmitButton
                            confirmMessage="Se eliminará esta selección para corregirla. ¿Quieres continuar?"
                            className="group inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(220,63,97,0.1)] text-[var(--danger)] transition hover:bg-[rgba(220,63,97,0.16)]"
                          >
                            <span className="sr-only">Eliminar selección</span>
                            <span
                              aria-hidden="true"
                              className="flex h-5 w-5 items-center justify-center text-[15px] font-bold leading-none"
                            >
                              ×
                            </span>
                          </ConfirmSubmitButton>
                        </form>
                      </div>

                      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_72px_auto] items-center gap-3 sm:grid">
                        <span className="truncate text-sm font-medium">
                          {selection.person.name}
                        </span>
                        <span className="truncate text-sm text-muted">
                          {selection.menuOption.name}
                        </span>
                        <span className="text-sm text-muted">
                          {formatSelectionTime(selection.selectedAt)}
                        </span>
                        <form action={deleteSelection}>
                        <input type="hidden" name="selectionId" value={selection.id} />
                        <ConfirmSubmitButton
                          confirmMessage="Se eliminará esta selección para corregirla. ¿Quieres continuar?"
                          className="group inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(220,63,97,0.1)] text-[var(--danger)] transition hover:bg-[rgba(220,63,97,0.16)]"
                        >
                          <span className="sr-only">Eliminar selección</span>
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 items-center justify-center text-[15px] font-bold leading-none"
                          >
                            ×
                          </span>
                        </ConfirmSubmitButton>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
