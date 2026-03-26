"use client";

import { useState } from "react";

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
  dayNumber: number;
  options: MenuOptionItem[];
  selectedPersonIds: string[];
};

type HomeFlowProps = {
  people: PersonOption[];
  todayLabel: string;
  menuDays: MenuDayItem[];
  calendarWeekdays: string[];
  calendarDays: Array<{
    dateKey: string;
    dayNumber: number;
    isPast: boolean;
    menuDayId: string | null;
    hasOptions: boolean;
  }>;
  initialMenuDayId: string | null;
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

export function HomeFlow({
  people,
  todayLabel,
  menuDays,
  calendarWeekdays,
  calendarDays,
  initialMenuDayId,
  initialSuccess,
  submitSelection,
}: HomeFlowProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(
    initialSuccess ? 5 : 1,
  );
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedMenuDayId, setSelectedMenuDayId] = useState<string | null>(null);
  const [selectedMenuOptionId, setSelectedMenuOptionId] = useState("");

  const selectedMenuDay =
    menuDays.find((menuDay) => menuDay.id === selectedMenuDayId) ?? null;
  const selectedMenuOption =
    selectedMenuDay?.options.find((option) => option.id === selectedMenuOptionId) ?? null;

  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? null;
  const selectedPersonHasAnyAvailableDate = selectedPersonId
    ? menuDays.some((menuDay) => !menuDay.selectedPersonIds.includes(selectedPersonId))
    : false;
  const canAdvanceFromStep1 = selectedPersonId.length > 0;
  const canAdvanceFromStep2 = selectedMenuDay !== null;
  const canAdvanceFromStep3 = selectedMenuOptionId.length > 0;
  const canSubmit =
    selectedPersonId.length > 0 &&
    selectedMenuDay !== null &&
    selectedMenuOptionId.length > 0;

  return (
    <>
      <section className="rounded-[26px] border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(29,29,27,0.08)] sm:p-8">
        <div className="space-y-5">
          <div className="max-w-xl space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Seleccion diaria
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold leading-none tracking-tight sm:text-4xl xl:text-[2.35rem]">
                Registro de almuerzo diario
              </h1>
              <p className="text-sm font-medium text-accent">{todayLabel}</p>
              <p className="text-[15px] leading-6 text-muted">
                Avanza paso a paso para registrar tu almuerzo de forma simple.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(107,102,93,0.12)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(180,83,9,0.88),rgba(217,119,6,0.74))] transition-[width] duration-300"
                style={{
                  width: `${Math.max(
                    0,
                    ((Math.min(currentStep, 4) - 1) / (STEPS.length - 1)) * 100,
                  )}%`,
                }}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              {STEPS.map((item) => {
                const isCurrent = currentStep === item.step;
                const isDone =
                  (item.step === 1 && canAdvanceFromStep1) ||
                  (item.step === 2 && canAdvanceFromStep2) ||
                  (item.step === 3 && canAdvanceFromStep3);

                return (
                  <div
                    key={item.step}
                    className={`flex items-center gap-3 rounded-[18px] border px-3 py-2 ${
                      isCurrent
                        ? "border-[var(--accent)] bg-[rgba(180,83,9,0.1)]"
                        : isDone
                          ? "border-[rgba(180,83,9,0.16)] bg-[rgba(180,83,9,0.05)]"
                          : "border-border bg-background"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                        isCurrent
                          ? "border-[var(--accent)] bg-[rgba(180,83,9,0.14)] text-[var(--accent)]"
                          : isDone
                            ? "border-[rgba(180,83,9,0.22)] bg-[rgba(180,83,9,0.08)] text-[var(--accent)]"
                            : "border-border bg-surface text-muted"
                      }`}
                    >
                      {item.step}
                    </span>

                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                        Paso
                      </p>
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                    </div>
                  </div>
                );
              })}
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
          <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              Almuerzo confirmado.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              Puedes cerrar esta ventana.
            </p>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => {
                  setSelectedPersonId("");
                  setSelectedMenuDayId(null);
                  setSelectedMenuOptionId("");
                  setCurrentStep(1);
                }}
                className="text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Volver al principio
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
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

                    setSelectedPersonId(nextPersonId);
                    setSelectedMenuDayId(nextMenuDayId);
                    setSelectedMenuOptionId("");
                  }}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
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

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                disabled={!canAdvanceFromStep1}
                onClick={() => setCurrentStep(2)}
                className="rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Paso 2
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Elegir fecha</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              {selectedPerson
                ? `Estas eligiendo como ${selectedPerson.name}.`
                : "Selecciona una fecha disponible para continuar."}
            </p>

            {!selectedPersonHasAnyAvailableDate ? (
              <p className="mt-6 text-sm leading-6 text-muted">
                Esta persona ya registr&oacute; elecci&oacute;n en todas las fechas
                disponibles del mes actual.
              </p>
            ) : (
              <div className="mt-6 rounded-[18px] border border-border bg-background px-4 py-4">
                <div className="mb-2 grid grid-cols-7 gap-px text-center text-[7px] font-semibold uppercase tracking-[0.05em] text-muted sm:text-[8px]">
                  {calendarWeekdays.map((weekday) => (
                    <div key={weekday}>{weekday}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-px">
                  {calendarDays.map((day) => {
                    if (day.isPast) {
                      return null;
                    }

                    if (!day.menuDayId || !day.hasOptions) {
                      return (
                        <div
                          key={day.dateKey}
                          className="flex h-5 w-full items-center justify-center rounded-[5px] border border-transparent bg-transparent text-[9px] font-medium leading-none text-muted sm:h-6"
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
                          key={day.dateKey}
                          className="flex h-5 w-full items-center justify-center rounded-[5px] border border-dashed border-border bg-[rgba(107,102,93,0.05)] text-[9px] font-medium leading-none text-muted sm:h-6"
                          title="Ya registraste una eleccion para esta fecha"
                        >
                          {day.dayNumber}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onClick={() => {
                          setSelectedMenuDayId(day.menuDayId);
                          setSelectedMenuOptionId("");
                        }}
                        className={`flex h-5 w-full items-center justify-center rounded-[5px] border text-[9px] font-semibold leading-none transition hover:bg-surface sm:h-6 ${
                          isSelected
                            ? "border-[var(--accent)] bg-[rgba(180,83,9,0.14)] text-[var(--accent)] ring-1 ring-[rgba(180,83,9,0.2)]"
                            : "border-border bg-white text-foreground"
                        }`}
                      >
                        {day.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-surface"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={!canAdvanceFromStep2}
                onClick={() => setCurrentStep(3)}
                className="rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 3 ? (
          <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Paso 3
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Elegir almuerzo
            </h2>

            {selectedMenuDay ? (
              <div className="mt-6 rounded-[18px] border border-border bg-background px-4 py-4">
                <div className="mb-3 border-b border-[rgba(107,102,93,0.12)] pb-2">
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
                      <span className="block rounded-[18px] border border-border bg-white px-4 py-4 shadow-[0_10px_30px_-26px_rgba(29,29,27,0.28)] transition duration-150 hover:-translate-y-0.5 hover:bg-surface hover:shadow-[0_16px_28px_-24px_rgba(29,29,27,0.35)] peer-checked:border-[var(--accent)] peer-checked:ring-2 peer-checked:ring-[rgba(180,83,9,0.18)]">
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

            <div className="mt-8 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-surface"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={!canAdvanceFromStep3}
                onClick={() => setCurrentStep(4)}
                className="rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 4 ? (
          <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Paso 4
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Confirmar selecci&oacute;n
            </h2>

            <div className="mt-6 rounded-[18px] border border-border bg-background px-4 py-4">
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

            <div className="mt-8 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-surface"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
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
