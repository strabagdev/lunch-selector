"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { QrLauncher } from "./qr-launcher";

type PersonOption = {
  id: string;
  name: string;
};

type MenuOptionItem = {
  id: string;
  name: string;
  selectionCount: number;
};

type MenuDayItem = {
  id: string;
  dateKey: string;
  fullDateLabel: string;
  shortDateLabel: string;
  dayNumber: number;
  options: MenuOptionItem[];
  selectedPersonIds: string[];
  selections?: Array<{
    personId: string;
    menuOptionName: string;
  }>;
};

type HomeFlowProps = {
  people: PersonOption[];
  shareUrl: string;
  todayLabel: string;
  todayDateKey: string;
  todayNarrative: {
    text: string;
    model: string | null;
  } | null;
  todayMonthKey: string;
  cutoffNotice: string;
  isTodayClosed: boolean;
  menuDays: MenuDayItem[];
  coverageMenuDays?: MenuDayItem[];
  initialMenuDayId: string | null;
  initialPersonId: string | null;
  initialOptionId: string | null;
  initialSuccess: boolean;
  submitSelection: (formData: FormData) => void | Promise<void>;
};

function getFirstAvailableMenuDayId(menuDays: MenuDayItem[], personId: string) {
  return (
    menuDays.find((menuDay) => !menuDay.selectedPersonIds.includes(personId))?.id ?? null
  );
}

const STEPS = [
  { step: 1, title: "Persona" },
  { step: 2, title: "Fecha" },
  { step: 3, title: "Menu" },
  { step: 4, title: "Confirmar" },
] as const;

const COVERED_DAYS_PREVIEW_LIMIT = 6;
const CALENDAR_WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const CALENDAR_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const monthIndex = Number(month) - 1;
  const monthLabel = CALENDAR_MONTHS[monthIndex] ?? monthKey;
  return `${monthLabel} ${year}`;
}

function buildMonthCalendarDays(monthKey: string, menuDays: MenuDayItem[]) {
  const monthStart = new Date(`${monthKey}-01T00:00:00.000Z`);
  const monthIndex = monthStart.getUTCMonth();
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
  const monthDays: Array<
    | { kind: "empty"; key: string }
    | {
        kind: "day";
        key: string;
        dateKey: string;
        dayNumber: number;
        menuDayId: string | null;
      }
  > = [];
  const menuDayByDateKey = new Map(menuDays.map((menuDay) => [menuDay.dateKey, menuDay]));

  for (let index = 0; index < firstWeekday; index += 1) {
    monthDays.push({
      kind: "empty",
      key: `${monthKey}-empty-${index}`,
    });
  }

  const currentDate = new Date(monthStart);

  while (currentDate.getUTCMonth() === monthIndex) {
    const dateKey = currentDate.toISOString().slice(0, 10);
    const matchingMenuDay = menuDayByDateKey.get(dateKey);

    monthDays.push({
      kind: "day",
      key: dateKey,
      dateKey,
      dayNumber: currentDate.getUTCDate(),
      menuDayId: matchingMenuDay?.id ?? null,
    });

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return monthDays;
}

function renderBoldMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*.*?\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function subscribeToMount() {
  return () => {};
}

export function HomeFlow({
  people,
  shareUrl,
  todayLabel,
  todayDateKey,
  todayNarrative,
  todayMonthKey,
  cutoffNotice,
  isTodayClosed,
  menuDays,
  coverageMenuDays = menuDays,
  initialMenuDayId,
  initialPersonId,
  initialOptionId,
  initialSuccess,
  submitSelection,
}: HomeFlowProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(
    initialSuccess ? 5 : 1,
  );
  const [selectedPersonId, setSelectedPersonId] = useState(initialPersonId ?? "");
  const [selectedMenuDayId, setSelectedMenuDayId] = useState<string | null>(
    initialSuccess ? initialMenuDayId : null,
  );
  const [selectedMenuOptionId, setSelectedMenuOptionId] = useState(
    initialSuccess ? initialOptionId ?? "" : "",
  );
  const hasMounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  const [isCutoffNoticeDismissed, setIsCutoffNoticeDismissed] = useState(false);
  const [cutoffNoticeProgress, setCutoffNoticeProgress] = useState(100);

  useEffect(() => {
    if (!hasMounted || currentStep !== 1 || isCutoffNoticeDismissed) {
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.max(0, 100 - elapsed / 300);
      setCutoffNoticeProgress(nextProgress);
    }, 100);

    const timeoutId = window.setTimeout(() => {
      setIsCutoffNoticeDismissed(true);
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [currentStep, hasMounted, isCutoffNoticeDismissed]);

  const selectedMenuDay =
    menuDays.find((menuDay) => menuDay.id === selectedMenuDayId) ?? null;
  const selectedMenuOption =
    selectedMenuDay?.options.find((option) => option.id === selectedMenuOptionId) ?? null;

  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? null;
  const nextAvailableMenuDayId = selectedPersonId
    ? getFirstAvailableMenuDayId(menuDays, selectedPersonId)
    : null;
  const nextAvailableMenuDay =
    menuDays.find((menuDay) => menuDay.id === nextAvailableMenuDayId) ?? null;
  const monthKeys = Array.from(new Set(menuDays.map((menuDay) => getMonthKey(menuDay.dateKey))));
  const initialCalendarMonthKey =
    getMonthKey(
      (
        menuDays.find((menuDay) => menuDay.id === (initialMenuDayId ?? nextAvailableMenuDayId)) ??
        menuDays[0]
      )?.dateKey ?? todayMonthKey,
    );
  const [currentCalendarMonthKey, setCurrentCalendarMonthKey] = useState(
    monthKeys.includes(initialCalendarMonthKey)
      ? initialCalendarMonthKey
      : monthKeys[0] ?? todayMonthKey,
  );
  const selectedPersonCoveredDays = selectedPersonId
    ? coverageMenuDays
        .flatMap((menuDay) => {
          const selection = menuDay.selections?.find(
            (menuDaySelection) => menuDaySelection.personId === selectedPersonId,
          );

          if (!selection) {
            return [];
          }

          return [
            {
              menuDayId: menuDay.id,
              fullDateLabel: menuDay.fullDateLabel,
              shortDateLabel: menuDay.shortDateLabel,
              dateKey: menuDay.dateKey,
              menuOptionName: selection.menuOptionName,
            },
          ];
        })
    : [];
  const todayCoveredDay =
    selectedPersonCoveredDays.find((coveredDay) => coveredDay.dateKey === todayDateKey) ?? null;
  const otherCoveredDays = selectedPersonCoveredDays.filter(
    (coveredDay) => coveredDay.dateKey !== todayDateKey,
  );
  const otherCoveredDaysPreview = otherCoveredDays.slice(0, COVERED_DAYS_PREVIEW_LIMIT);
  const remainingOtherCoveredDaysCount = Math.max(
    0,
    otherCoveredDays.length - otherCoveredDaysPreview.length,
  );
  const currentCalendarMonthIndex = monthKeys.findIndex(
    (monthKey) => monthKey === currentCalendarMonthKey,
  );
  const currentCalendarDays = buildMonthCalendarDays(currentCalendarMonthKey, menuDays);
  const canAdvanceFromStep1 = selectedPersonId.length > 0 && !isTodayClosed;
  const canAdvanceFromStep2 = selectedMenuDay !== null;
  const canAdvanceFromStep3 = selectedMenuOptionId.length > 0;
  const canSubmit =
    selectedPersonId.length > 0 &&
    selectedMenuDay !== null &&
    selectedMenuOptionId.length > 0;
  const currentProgressStep = Math.min(currentStep, 4);
  const currentStepMeta = STEPS[currentProgressStep - 1];
  const hasNoAvailableDates = nextAvailableMenuDay === null;
  return (
    <>
      {hasMounted && currentStep === 1 && (isTodayClosed || todayNarrative) ? (
        <section
          className={
            isTodayClosed
              ? "overflow-hidden rounded-[20px] border border-[rgba(220,63,97,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,245,247,0.96))] p-4 text-[var(--danger)] shadow-[var(--shadow-soft)] sm:rounded-[26px] sm:p-6"
              : "overflow-hidden rounded-[28px] border border-[rgba(15,118,110,0.14)] bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.2),transparent_34%),linear-gradient(135deg,rgba(10,90,84,0.96),rgba(15,118,110,0.9)_55%,rgba(219,243,238,0.92)_140%)] p-6 text-white shadow-[0_24px_60px_-36px_rgba(6,78,59,0.55)] sm:p-8"
          }
        >
          {isTodayClosed ? (
            <div className="flex items-center justify-center gap-3 text-center">
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(220,63,97,0.16)] bg-white/75 shadow-[0_10px_22px_-16px_rgba(127,29,29,0.55)]"
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-4.5 w-4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="10" cy="10" r="7" />
                  <path d="M10 6.5V10l2.2 1.7" />
                </svg>
              </span>
              <div className="min-w-0 text-left">
                <h2 className="text-base font-semibold leading-5 sm:text-lg">
                  Solicitudes cerradas
                </h2>
                <p className="mt-1 text-xs font-medium leading-5 text-muted">
                  Puedes programar fechas futuras.
                </p>
              </div>
            </div>
          ) : todayNarrative ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/16 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 13.5V6.8A1.8 1.8 0 0 1 5.8 5h12.4A1.8 1.8 0 0 1 20 6.8v6.7A1.8 1.8 0 0 1 18.2 15.3H9l-4.2 3.2v-3.2H5.8A1.8 1.8 0 0 1 4 13.5Z" />
                    <path d="M8 9.5h8" />
                    <path d="M8 12.5h5" />
                  </svg>
                </span>
                <h2 className="text-center text-[1.35rem] font-semibold tracking-tight sm:text-[2rem]">
                  El menu de hoy ya tiene comentarista.
                </h2>
              </div>

              <p className="mx-auto max-w-3xl text-center text-base leading-7 text-white/88 sm:text-lg">
                {renderBoldMarkdown(todayNarrative.text)}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {hasMounted && currentStep === 1 && !isTodayClosed && !isCutoffNoticeDismissed ? (
        <section className="rounded-[18px] border border-[rgba(220,63,97,0.18)] bg-[rgba(220,63,97,0.08)] px-4 py-3 text-sm font-medium text-[var(--danger)] shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-center gap-3 text-center">
            <div className="flex flex-1 items-center justify-center gap-3 text-center">
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(220,63,97,0.16)] bg-white/75 text-[var(--danger)] shadow-[0_10px_22px_-16px_rgba(127,29,29,0.55)]"
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-4.5 w-4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="10" cy="10" r="7" />
                  <path d="M10 6.5V10l2.2 1.7" />
                </svg>
              </span>
              <p className="text-base font-semibold uppercase tracking-[0.14em] leading-5 sm:text-lg">
                {cutoffNotice}
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(220,63,97,0.16)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(220,63,97,0.92),rgba(246,114,128,0.86))] transition-[width] duration-100"
              style={{ width: `${cutoffNoticeProgress}%` }}
            />
          </div>
        </section>
      ) : null}

      <section className="rounded-[20px] border border-border bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-4 shadow-[var(--shadow-card)] sm:rounded-[26px] sm:p-8">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1 sm:space-y-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-accent sm:text-[10px] sm:tracking-[0.18em]">
                Seleccion diaria
              </p>
              <h1 className="text-[1.2rem] font-semibold leading-tight tracking-tight sm:text-4xl xl:text-[2.35rem]">
                Registro de almuerzo
              </h1>
            </div>
            <p className="max-w-[8.5rem] shrink-0 text-right text-[11px] font-medium leading-4 text-accent sm:max-w-none sm:pt-1 sm:text-sm">
              {todayLabel}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Paso {currentStepMeta.step} de {STEPS.length}
                </p>
                <p className="text-sm font-semibold text-foreground sm:text-base">
                  {currentStepMeta.title}
                </p>
              </div>
              <p className="text-[10px] font-medium text-muted sm:text-xs">
                {Math.round(((currentProgressStep - 1) / (STEPS.length - 1)) * 100)}%
              </p>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(17,32,28,0.08)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--success))] transition-[width] duration-300"
                style={{
                  width: `${Math.max(
                    0,
                    ((Math.min(currentStep, 4) - 1) / (STEPS.length - 1)) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <form action={submitSelection}>
        {selectedPersonId ? <input type="hidden" name="personId" value={selectedPersonId} /> : null}
        {selectedMenuDay ? <input type="hidden" name="menuDayId" value={selectedMenuDay.id} /> : null}
        {selectedMenuOptionId ? (
          <input type="hidden" name="menuOptionId" value={selectedMenuOptionId} />
        ) : null}

        {currentStep === 5 ? (
          <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              Almuerzo confirmado.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              Tu eleccion fue registrada correctamente.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {nextAvailableMenuDayId ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMenuDayId(nextAvailableMenuDayId);
                    setSelectedMenuOptionId("");
                    setCurrentStep(2);
                  }}
                  className="rounded-[16px] bg-[linear-gradient(180deg,var(--accent),#0a5a54)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_26px_-16px_rgba(15,23,42,0.28)] transition hover:brightness-105"
                >
                  Seleccionar otra fecha
                </button>
              ) : (
                <p className="text-sm leading-6 text-muted">
                  Las fechas disponibles para esta persona ya quedaron
                  programadas.
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedPersonId("");
                  setSelectedMenuDayId(null);
                  setSelectedMenuOptionId("");
                  setCurrentStep(1);
                }}
                className="rounded-[16px] border border-[color:var(--border-strong)] bg-[var(--card)] px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--surface-strong)]"
              >
                Cambiar persona
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Paso 1
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Identificaci&oacute;n
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Selecciona tu nombre para comenzar.
            </p>

            <div className="mt-6 max-w-md">
              <label className="block space-y-2">
                <span className="sr-only">Persona</span>
                <select
                  required
                  value={selectedPersonId}
                  onChange={(event) => {
                    const nextPersonId = event.target.value;
                    const nextMenuDayId = nextPersonId
                      ? initialMenuDayId &&
                        menuDays.some(
                          (menuDay) =>
                            menuDay.id === initialMenuDayId &&
                            !menuDay.selectedPersonIds.includes(nextPersonId),
                        )
                        ? initialMenuDayId
                        : getFirstAvailableMenuDayId(menuDays, nextPersonId)
                      : null;
                    const nextMenuDay = menuDays.find(
                      (menuDay) => menuDay.id === nextMenuDayId,
                    );

                    setSelectedPersonId(nextPersonId);
                    setSelectedMenuDayId(nextMenuDayId);
                    setSelectedMenuOptionId("");
                    if (nextMenuDay) {
                      setCurrentCalendarMonthKey(getMonthKey(nextMenuDay.dateKey));
                    }
                  }}
                  className="w-full rounded-[16px] border border-[color:var(--input)] bg-[var(--card)] px-4 py-3 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition-colors focus:border-accent sm:text-sm"
                >
                  <option value="" disabled>
                    Selecciona tu nombre
                  </option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedPerson ? (
              <div className="mt-4 max-w-md">
                {selectedPersonCoveredDays.length > 0 ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(15,118,110,0.08)] text-accent"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3.5" y="4.5" width="13" height="11" rx="2" />
                          <path d="M6.5 8.5h7" />
                          <path d="M6.5 11.5h5" />
                        </svg>
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                          Hoy
                        </span>
                        {todayCoveredDay ? (
                          <>
                            <span className="mt-1 block font-semibold leading-5 text-foreground">
                              {todayCoveredDay.menuOptionName}
                            </span>
                            <span className="mt-0.5 block text-xs leading-5 text-muted">
                              {todayCoveredDay.fullDateLabel}
                            </span>
                          </>
                        ) : (
                          <span className="mt-1 block font-medium leading-5 text-muted">
                            No tienes almuerzo registrado para hoy.
                          </span>
                        )}
                      </span>
                    </div>

                    {otherCoveredDays.length > 0 ? (
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-t border-border pt-3 font-medium leading-5 text-foreground">
                          <span>
                            Ver m&aacute;s{" "}
                            <span className="text-xs font-normal text-muted">
                              ({otherCoveredDays.length}{" "}
                              {otherCoveredDays.length === 1 ? "fecha" : "fechas"})
                            </span>
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-lg leading-none text-accent transition-transform group-open:rotate-180"
                          >
                            ˅
                          </span>
                        </summary>
                        <div className="mt-2 flex flex-col gap-2 pl-10">
                          {otherCoveredDaysPreview.map((coveredDay) => (
                            <div
                              key={coveredDay.menuDayId}
                              className="text-sm"
                            >
                              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                                {coveredDay.shortDateLabel}
                              </div>
                              <div className="mt-0.5 font-medium leading-5 text-foreground">
                                {coveredDay.menuOptionName}
                              </div>
                            </div>
                          ))}
                          {remainingOtherCoveredDaysCount > 0 ? (
                            <p className="text-xs leading-5 text-muted">
                              y {remainingOtherCoveredDaysCount} m&aacute;s.
                            </p>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-muted">
                    Ya puedes comenzar a registrar tus almuerzos en las fechas disponibles.
                  </p>
                )}
              </div>
            ) : null}

            {!isTodayClosed ? (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={!canAdvanceFromStep1}
                  onClick={() => setCurrentStep(2)}
                  className="w-full rounded-[16px] bg-[linear-gradient(180deg,var(--accent),#0a5a54)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_26px_-16px_rgba(15,23,42,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Continuar
                </button>
              </div>
            ) : null}

            <div className="mt-6 border-t border-border pt-3">
              <div className="flex gap-2 sm:justify-end">
                <Link
                  href="/admin"
                  className="flex-1 rounded-[14px] border border-[color:var(--border-strong)] bg-[var(--card)] px-4 py-2.5 text-center text-sm font-semibold shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-strong)] sm:flex-none"
                >
                  AD
                </Link>
                <QrLauncher shareUrl={shareUrl} />
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Paso 2
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Elegir fecha</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              {selectedPerson
                ? `Estas eligiendo como ${selectedPerson.name}.`
                : "Selecciona una fecha disponible para continuar."}
            </p>

            {hasNoAvailableDates ? (
              <div className="mt-6 space-y-3">
                <p className="text-sm leading-6 text-muted">
                  Esta persona ya registr&oacute; elecci&oacute;n en todas las fechas
                  futuras disponibles.
                </p>
                {selectedPersonCoveredDays.length > 0 ? (
                  <div className="rounded-[18px] border border-border bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-soft)]">
                    <div className="space-y-2">
                      {selectedPersonCoveredDays.map((coveredDay) => (
                        <div
                          key={coveredDay.menuDayId}
                          className="rounded-[14px] bg-[rgba(17,32,28,0.03)] px-3 py-2"
                        >
                          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                            {coveredDay.shortDateLabel}
                          </div>
                          <div className="mt-1 text-sm font-medium leading-5 text-foreground">
                            {coveredDay.menuOptionName}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {!selectedMenuDay && nextAvailableMenuDay ? (
                  <div className="rounded-[18px] border border-border bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-soft)]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-muted">
                          Siguiente fecha pendiente
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {nextAvailableMenuDay.fullDateLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMenuDayId(nextAvailableMenuDay.id);
                          setSelectedMenuOptionId("");
                          setCurrentCalendarMonthKey(getMonthKey(nextAvailableMenuDay.dateKey));
                        }}
                        className="rounded-[14px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-2.5 text-sm font-medium text-[var(--accent)] transition-colors hover:brightness-95"
                      >
                        Usar esta fecha
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[20px] border border-border bg-[var(--card)] px-4 py-4 shadow-[var(--shadow-soft)]">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={currentCalendarMonthIndex <= 0}
                      onClick={() => {
                        const previousMonthKey = monthKeys[currentCalendarMonthIndex - 1];

                        if (previousMonthKey) {
                          setCurrentCalendarMonthKey(previousMonthKey);
                        }
                      }}
                      className="rounded-[12px] border border-border bg-white px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mes anterior
                    </button>
                    <p className="text-sm font-semibold capitalize text-foreground">
                      {formatMonthLabel(currentCalendarMonthKey)}
                    </p>
                    <button
                      type="button"
                      disabled={
                        currentCalendarMonthIndex === -1 ||
                        currentCalendarMonthIndex >= monthKeys.length - 1
                      }
                      onClick={() => {
                        const nextMonthKey = monthKeys[currentCalendarMonthIndex + 1];

                        if (nextMonthKey) {
                          setCurrentCalendarMonthKey(nextMonthKey);
                        }
                      }}
                      className="rounded-[12px] border border-border bg-white px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mes siguiente
                    </button>
                  </div>

                  <div className="mb-2 grid grid-cols-7 gap-px text-center text-[7px] font-semibold uppercase tracking-[0.05em] text-muted sm:text-[8px]">
                    {CALENDAR_WEEKDAYS.map((weekday) => (
                      <div key={weekday}>{weekday}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-px">
                    {currentCalendarDays.map((day) => {
                      if (day.kind === "empty") {
                        return <div key={day.key} className="h-8 sm:h-6" />;
                      }

                      if (!day.menuDayId) {
                        return (
                          <div
                            key={day.key}
                            className="flex h-10 w-full items-center justify-center rounded-[8px] border border-transparent bg-transparent text-[11px] font-medium leading-none text-muted sm:h-6 sm:text-[9px]"
                          >
                            {day.dayNumber}
                          </div>
                        );
                      }

                      const menuDay = menuDays.find(
                        (availableMenuDay) => availableMenuDay.id === day.menuDayId,
                      );
                      const alreadySelected =
                        menuDay?.selectedPersonIds.includes(selectedPersonId) ?? false;
                      const isSelected = day.menuDayId === selectedMenuDayId;

                      if (alreadySelected) {
                        return (
                          <div
                            key={day.key}
                            className="flex h-10 w-full items-center justify-center rounded-[8px] border border-dashed border-border bg-[var(--surface-strong)] text-[11px] font-semibold leading-none text-muted sm:h-6 sm:text-[9px]"
                            title="Ya registraste una eleccion para esta fecha"
                          >
                            {day.dayNumber}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => {
                            setSelectedMenuDayId(day.menuDayId);
                            setSelectedMenuOptionId("");
                            const clickedMenuDay = menuDays.find(
                              (menuDay) => menuDay.id === day.menuDayId,
                            );

                            if (clickedMenuDay) {
                              setCurrentCalendarMonthKey(getMonthKey(clickedMenuDay.dateKey));
                            }
                          }}
                          className={`flex h-10 w-full items-center justify-center rounded-[8px] border text-[11px] font-semibold leading-none transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] sm:h-6 sm:text-[9px] ${
                            isSelected
                              ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-border)]"
                              : "border-border bg-white text-foreground shadow-[var(--shadow-soft)]"
                          }`}
                        >
                          {day.dayNumber}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-[4px] border border-border bg-white" />
                      Disponible
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-[4px] border border-[var(--accent-border)] bg-[var(--accent-soft)]" />
                      Seleccionado
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-[4px] border border-dashed border-border bg-[var(--surface-strong)]" />
                      Ya usado
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="w-full rounded-[16px] border border-[color:var(--border-strong)] bg-[var(--card)] px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--surface-strong)] sm:w-auto"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={!canAdvanceFromStep2}
                onClick={() => setCurrentStep(3)}
                className="w-full rounded-[16px] bg-[linear-gradient(180deg,var(--accent),#0a5a54)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_26px_-16px_rgba(15,23,42,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Continuar
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 3 ? (
          <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Paso 3
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Elegir almuerzo
            </h2>

            {selectedMenuDay ? (
              <div className="mt-6 rounded-[20px] border border-border bg-[var(--card)] px-4 py-4 shadow-[var(--shadow-soft)]">
                <div className="mb-3 border-b border-border pb-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    {selectedMenuDay.fullDateLabel}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedMenuDay.options.map((option, index) => (
                    <label key={option.id} className="block cursor-pointer">
                      <input
                        type="radio"
                        value={option.id}
                        checked={selectedMenuOptionId === option.id}
                        onChange={() => setSelectedMenuOptionId(option.id)}
                        className="peer sr-only"
                      />
                      <span className="block rounded-[20px] border border-border bg-white px-4 py-4 shadow-[var(--shadow-soft)] transition duration-150 hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] hover:shadow-[0_16px_28px_-24px_rgba(15,23,42,0.24)] peer-checked:border-[var(--accent-border)] peer-checked:bg-[var(--accent-soft)] peer-checked:shadow-[0_0_0_1px_var(--accent-border)]">
                        <span className="block min-w-0">
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                            Menu {index + 1}
                          </span>
                          <span className="mt-2 block text-sm font-semibold leading-5">
                            {option.name}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-full rounded-[16px] border border-[color:var(--border-strong)] bg-[var(--card)] px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--surface-strong)] sm:w-auto"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={!canAdvanceFromStep3}
                onClick={() => setCurrentStep(4)}
                className="w-full rounded-[16px] bg-[linear-gradient(180deg,var(--accent),#0a5a54)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_26px_-16px_rgba(15,23,42,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Continuar
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 4 ? (
          <section className="rounded-[26px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,249,248,0.92))] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Paso 4
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Confirmar selecci&oacute;n
            </h2>

            <div className="mt-6 rounded-[20px] border border-border bg-[var(--card)] px-4 py-4 shadow-[var(--shadow-soft)]">
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-semibold">Persona:</span>{" "}
                  <span className="text-muted">{selectedPerson?.name ?? "-"}</span>
                </div>
                <div>
                  <span className="font-semibold">Fecha:</span>{" "}
                  <span className="text-muted">
                    {selectedMenuDay?.fullDateLabel ?? "-"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Almuerzo:</span>{" "}
                  <span className="text-muted">{selectedMenuOption?.name ?? "-"}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="w-full rounded-[16px] border border-[color:var(--border-strong)] bg-[var(--card)] px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--surface-strong)] sm:w-auto"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-[16px] bg-[linear-gradient(180deg,var(--accent),#0a5a54)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_26px_-16px_rgba(15,23,42,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Confirmar seleccion
              </button>
            </div>
          </section>
        ) : null}
      </form>
    </>
  );
}
