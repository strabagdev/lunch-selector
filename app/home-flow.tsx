"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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
  todayDateKey: string;
  todayNarrative: {
    text: string;
    model: string | null;
  } | null;
  todayMonthKey: string;
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
const SESSION_STORAGE_KEY = "lunch-selector-session-id";
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MOCK_ENERGY_ESTIMATES_KCAL = [620, 740, 710, 485, 660, 590, 735, 515];
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

function formatWizardDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const formattedDate = new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
}

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

function getMockEnergyEstimateKcal(optionIndex: number) {
  return MOCK_ENERGY_ESTIMATES_KCAL[
    optionIndex % MOCK_ENERGY_ESTIMATES_KCAL.length
  ];
}

function createAnonymousSessionId() {
  if (typeof crypto === "undefined") {
    return null;
  }

  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  try {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  } catch {
    return null;
  }
}

function getOrCreateAnonymousSessionId() {
  try {
    const storedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);

    if (storedSessionId && SESSION_ID_PATTERN.test(storedSessionId)) {
      return storedSessionId.toLowerCase();
    }

    const sessionId = createAnonymousSessionId();

    if (sessionId) {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }

    return sessionId;
  } catch {
    return null;
  }
}

export function HomeFlow({
  people,
  shareUrl,
  todayDateKey,
  todayMonthKey,
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
  const sessionIdInputRef = useRef<HTMLInputElement>(null);

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
  const hasNoAvailableDates = nextAvailableMenuDay === null;
  const canAdvanceFromStep1 = selectedPersonId.length > 0 && !hasNoAvailableDates;
  const canAdvanceFromStep2 = selectedMenuDay !== null;
  const canAdvanceFromStep3 = selectedMenuOptionId.length > 0;
  const canSubmit =
    selectedPersonId.length > 0 &&
    selectedMenuDay !== null &&
    selectedMenuOptionId.length > 0;
  const currentProgressStep = Math.min(currentStep, 4);
  const currentStepMeta = STEPS[currentProgressStep - 1];
  const wizardDateLabel = selectedMenuDay
    ? formatWizardDateLabel(selectedMenuDay.dateKey)
    : formatWizardDateLabel(todayDateKey);
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[clamp(0.5rem,1.35vh,1rem)]">
      <section className="rounded-[26px] border border-border bg-[rgba(18,21,27,0.9)] p-[clamp(0.75rem,1.7vh,1.15rem)] shadow-[var(--shadow-card)] backdrop-blur sm:rounded-[30px]">
        <div className="space-y-[clamp(0.45rem,1.1vh,0.75rem)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)] sm:text-[10px] sm:tracking-[0.18em]">
                Seleccion diaria
              </p>
              <h1 className="text-[1.15rem] font-semibold leading-tight tracking-tight text-white sm:text-[1.45rem]">
                Registro de almuerzo
              </h1>
            </div>
            <p className="shrink-0 text-right text-[clamp(1rem,2.2vw,1.65rem)] font-semibold leading-tight tracking-tight text-white">
              {wizardDateLabel}
            </p>
          </div>

          <div className="space-y-1.5">
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

            <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))] transition-[width] duration-300"
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

      <div className="min-h-0 overflow-y-auto overscroll-contain pr-0.5">
        <div className="min-h-full pb-1">
          <form
            action={submitSelection}
            onSubmitCapture={() => {
              const sessionId = getOrCreateAnonymousSessionId();

              if (sessionIdInputRef.current) {
                sessionIdInputRef.current.value = sessionId ?? "";
              }
            }}
          >
            <input ref={sessionIdInputRef} type="hidden" name="sessionId" />
            {selectedPersonId ? <input type="hidden" name="personId" value={selectedPersonId} /> : null}
            {selectedMenuDay ? <input type="hidden" name="menuDayId" value={selectedMenuDay.id} /> : null}
            {selectedMenuOptionId ? (
              <input type="hidden" name="menuOptionId" value={selectedMenuOptionId} />
            ) : null}

        {currentStep === 5 ? (
          <section className="rounded-[26px] border border-border bg-[var(--card)] p-3.5 shadow-[var(--shadow-card)] backdrop-blur sm:p-4">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Almuerzo confirmado.
            </h2>
            <p className="mt-3 text-sm leading-5 text-muted">
              Tu eleccion fue registrada correctamente.
            </p>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              {nextAvailableMenuDayId ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMenuDayId(nextAvailableMenuDayId);
                    setSelectedMenuOptionId("");
                    setCurrentStep(2);
                  }}
                  className="rounded-[18px] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(8,90,113,0.75)] transition hover:brightness-105"
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
                className="rounded-[18px] border border-[color:var(--border-strong)] bg-[var(--surface-strong)] px-5 py-3 text-sm font-semibold transition-colors hover:bg-[var(--card)]"
              >
                Cambiar persona
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="rounded-[26px] border border-border bg-[var(--card)] p-3.5 shadow-[var(--shadow-card)] backdrop-blur sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Paso 1
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Identificaci&oacute;n
            </h2>
            <p className="mt-1.5 text-sm leading-5 text-muted">
              Selecciona tu nombre para comenzar.
            </p>

            <div className="mt-4 max-w-md">
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
                  className="w-full rounded-[18px] border border-[color:var(--input)] bg-[var(--surface-strong)] px-4 py-3 text-base font-medium text-foreground outline-none transition-colors focus:border-[var(--accent-border)] focus:shadow-[0_0_0_4px_rgba(6,127,143,0.22)] sm:text-sm"
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
              <div className="mt-3 max-w-md">
                {selectedPersonCoveredDays.length > 0 ? (
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          className="h-3.5 w-3.5"
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
                        {todayCoveredDay ? (
                          <span className="block font-semibold leading-5 text-foreground">
                            {todayCoveredDay.menuOptionName}
                          </span>
                        ) : (
                          <span className="block font-medium leading-5 text-muted">
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
                            className="text-lg leading-none text-[var(--accent-strong)] transition-transform group-open:rotate-180"
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

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={!canAdvanceFromStep1}
                onClick={() => setCurrentStep(2)}
                className="w-full rounded-[18px] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(8,90,113,0.75)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {isTodayClosed ? "Programar otras fechas" : "Continuar"}
              </button>
            </div>

            <div className="mt-4 border-t border-border pt-2.5">
              <div className="flex gap-2 sm:justify-end">
                <Link
                  href="/admin"
                  className="flex-1 rounded-[16px] border border-[color:var(--border-strong)] bg-[var(--surface-strong)] px-4 py-2.5 text-center text-sm font-semibold shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--card)] sm:flex-none"
                >
                  AD
                </Link>
                <QrLauncher shareUrl={shareUrl} />
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="rounded-[26px] border border-border bg-[var(--card)] p-3.5 shadow-[var(--shadow-card)] backdrop-blur sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Paso 2
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Elegir fecha</h2>
            <p className="mt-1.5 text-sm leading-5 text-muted">
              {selectedPerson
                ? `Estas eligiendo como ${selectedPerson.name}.`
                : "Selecciona una fecha disponible para continuar."}
            </p>

            {hasNoAvailableDates ? (
              <div className="mt-4 space-y-2.5">
                <p className="text-sm leading-5 text-muted">
                  Esta persona ya registr&oacute; elecci&oacute;n en todas las fechas
                  futuras disponibles.
                </p>
                {selectedPersonCoveredDays.length > 0 ? (
                  <div className="rounded-[18px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3.5 py-2.5 shadow-[var(--shadow-soft)]">
                    <div className="space-y-2">
                      {selectedPersonCoveredDays.map((coveredDay) => (
                        <div
                          key={coveredDay.menuDayId}
                          className="rounded-[14px] bg-[var(--surface-strong)] px-3 py-1.5"
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
              <div className="mt-4 space-y-3">
                {!selectedMenuDay && nextAvailableMenuDay ? (
                  <div className="rounded-[18px] border border-border bg-[var(--surface-strong)] px-3.5 py-2.5 shadow-[var(--shadow-soft)]">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                          Siguiente fecha pendiente
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMenuDayId(nextAvailableMenuDay.id);
                          setSelectedMenuOptionId("");
                          setCurrentCalendarMonthKey(getMonthKey(nextAvailableMenuDay.dateKey));
                        }}
                        className="rounded-[16px] bg-white px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:brightness-95"
                      >
                        Usar esta fecha
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[22px] border border-border bg-[var(--surface)] px-2.5 py-2.5 shadow-[var(--shadow-soft)]">
                  <div className="mb-2.5 flex items-center justify-between gap-2.5">
                    <button
                      type="button"
                      disabled={currentCalendarMonthIndex <= 0}
                      onClick={() => {
                        const previousMonthKey = monthKeys[currentCalendarMonthIndex - 1];

                        if (previousMonthKey) {
                          setCurrentCalendarMonthKey(previousMonthKey);
                        }
                      }}
                      className="rounded-[14px] border border-border bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--card)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
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
                      className="rounded-[14px] border border-border bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--card)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>

                  <div className="mb-1.5 grid grid-cols-7 gap-px text-center text-[7px] font-semibold uppercase tracking-[0.05em] text-muted sm:text-[8px]">
                    {CALENDAR_WEEKDAYS.map((weekday) => (
                      <div key={weekday}>{weekday}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-px">
                    {currentCalendarDays.map((day) => {
                      if (day.kind === "empty") {
                        return <div key={day.key} className="h-8 sm:h-7" />;
                      }

                      if (!day.menuDayId) {
                        return (
                          <div
                            key={day.key}
                            className="flex h-8 w-full items-center justify-center rounded-[8px] border border-transparent bg-transparent text-[11px] font-medium leading-none text-muted sm:h-7 sm:text-[10px]"
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
                            className="flex h-8 w-full items-center justify-center rounded-[8px] border border-dashed border-border bg-[var(--surface-strong)] text-[11px] font-semibold leading-none text-muted sm:h-7 sm:text-[10px]"
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
                          className={`flex h-8 w-full items-center justify-center rounded-[10px] border text-[11px] font-semibold leading-none transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] sm:h-7 sm:text-[10px] ${
                            isSelected
                              ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-white shadow-[0_0_0_1px_var(--accent-border)]"
                              : "border-border bg-[var(--surface-strong)] text-foreground shadow-[var(--shadow-soft)]"
                          }`}
                        >
                          {day.dayNumber}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-3 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-[4px] border border-border bg-[var(--surface-strong)]" />
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

            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="w-full rounded-[18px] border border-[color:var(--border-strong)] bg-[var(--surface-strong)] px-5 py-3 text-sm font-semibold transition-colors hover:bg-[var(--card)] sm:w-auto"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={!canAdvanceFromStep2}
                onClick={() => setCurrentStep(3)}
                className="w-full rounded-[18px] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(8,90,113,0.75)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Continuar
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 3 ? (
          <section className="rounded-[26px] border border-border bg-[var(--card)] p-3.5 shadow-[var(--shadow-card)] backdrop-blur sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Paso 3
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Elegir almuerzo
            </h2>

            {selectedMenuDay ? (
              <div className="mt-4 rounded-[22px] border border-border bg-[var(--surface)] px-2.5 py-2.5 shadow-[var(--shadow-soft)]">
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedMenuDay.options.map((option, index) => (
                    <label key={option.id} className="block cursor-pointer">
                      <input
                        type="radio"
                        value={option.id}
                        checked={selectedMenuOptionId === option.id}
                        onChange={() => setSelectedMenuOptionId(option.id)}
                        className="peer sr-only"
                      />
                      <span className="relative block rounded-[20px] border border-border bg-[var(--surface-strong)] px-3.5 py-3 shadow-[var(--shadow-soft)] transition duration-150 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[rgba(54,60,70,0.98)] hover:shadow-[0_18px_32px_-24px_rgba(0,0,0,0.8)] peer-checked:border-[var(--accent-border)] peer-checked:bg-[var(--accent-soft)] peer-checked:shadow-[0_0_0_1px_var(--accent-border)]">
                        <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-[rgba(7,9,13,0.62)] text-[11px] font-semibold leading-none text-muted">
                          {index + 1}
                        </span>
                        <span className="block min-w-0">
                          <span className="block pr-8 text-base font-semibold leading-6 sm:text-[1.05rem] sm:leading-6">
                            {option.name}
                          </span>
                          <span className="mt-2.5 block rounded-[14px] border border-border bg-[rgba(7,9,13,0.42)] px-3 py-1.5 text-left">
                            <span className="block text-base font-semibold leading-none text-[var(--accent-strong)]">
                              &asymp; {getMockEnergyEstimateKcal(index)} kcal
                            </span>
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-2.5 px-1 text-xs leading-5 text-muted">
                  Aporte energ&eacute;tico estimado seg&uacute;n los componentes del plato.
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-full rounded-[18px] border border-[color:var(--border-strong)] bg-[var(--surface-strong)] px-5 py-3 text-sm font-semibold transition-colors hover:bg-[var(--card)] sm:w-auto"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={!canAdvanceFromStep3}
                onClick={() => setCurrentStep(4)}
                className="w-full rounded-[18px] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(8,90,113,0.75)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Continuar
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 4 ? (
          <section className="rounded-[26px] border border-border bg-[var(--card)] p-3.5 shadow-[var(--shadow-card)] backdrop-blur sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Paso 4
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Confirmar selecci&oacute;n
            </h2>

            <div className="mt-4 rounded-[22px] border border-border bg-[var(--surface)] px-3.5 py-3.5 shadow-[var(--shadow-soft)]">
              <div className="space-y-2.5 text-sm">
                <div>
                  <span className="font-semibold">Persona:</span>{" "}
                  <span className="text-muted">{selectedPerson?.name ?? "-"}</span>
                </div>
                <div>
                  <span className="font-semibold">Almuerzo:</span>{" "}
                  <span className="text-muted">{selectedMenuOption?.name ?? "-"}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="w-full rounded-[18px] border border-[color:var(--border-strong)] bg-[var(--surface-strong)] px-5 py-3 text-sm font-semibold transition-colors hover:bg-[var(--card)] sm:w-auto"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-[18px] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(8,90,113,0.75)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Confirmar seleccion
              </button>
            </div>
          </section>
        ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
