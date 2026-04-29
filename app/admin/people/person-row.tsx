"use client";

import { useState } from "react";

type PersonRowProps = {
  personId: string;
  personName: string;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

export function PersonRow({
  personId,
  personName,
  updateAction,
  deleteAction,
}: PersonRowProps) {
  const [draftName, setDraftName] = useState(personName);
  const [isEditing, setIsEditing] = useState(false);

  const normalizedDraft = draftName.trim();
  const isDirty = normalizedDraft !== personName;

  return (
    <div
      className={`px-4 transition-colors ${
        isEditing ? "bg-[var(--accent-soft)]/40 py-3" : "bg-transparent py-1.5"
      }`}
    >
      <form
        action={async (formData) => {
          await updateAction(formData);
          setIsEditing(false);
        }}
        className={`grid gap-2 ${
          isEditing
            ? "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            : "grid-cols-[minmax(0,1fr)_2.25rem] items-center"
        }`}
      >
        <input type="hidden" name="personId" value={personId} />
        <div className={isEditing ? "space-y-2" : "min-w-0"}>
          {isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                Editando
              </span>
            </div>
          ) : null}

          <label className="block">
            <span className="sr-only">Nombre</span>
            {isEditing ? (
              <input
                type="text"
                name="name"
                required
                value={draftName}
                onChange={(event) => {
                  setDraftName(event.target.value);
                  if (!isEditing) {
                    setIsEditing(true);
                  }
                }}
                onFocus={() => setIsEditing(true)}
                className="h-10 w-full rounded-[14px] border border-[var(--accent-border)] bg-white px-3 text-base font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition-colors sm:text-sm"
              />
            ) : (
              <div className="flex min-h-9 min-w-0 items-center">
                <span className="truncate text-sm font-medium">{personName}</span>
              </div>
            )}
          </label>
        </div>

        <div
          className={`flex items-center gap-2 ${
            isEditing ? "flex-wrap justify-start sm:justify-end" : "justify-end"
          }`}
        >
          {isEditing ? (
            <>
              <button
                type="submit"
                disabled={!isDirty || !normalizedDraft}
                className="order-1 rounded-[14px] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_24px_-16px_rgba(15,23,42,0.32)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftName(personName);
                  setIsEditing(false);
                }}
                className="order-2 rounded-[14px] border border-[color:var(--border-strong)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-strong)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                formAction={deleteAction}
                className="order-3 rounded-[14px] border border-[var(--danger-border)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(255,239,243,0.98))] px-4 py-2.5 text-sm font-medium text-[var(--danger)] shadow-[0_12px_24px_-20px_rgba(220,63,97,0.4)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,rgba(255,248,250,1),rgba(255,235,240,1))]"
              >
                Eliminar
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-label={`Editar ${personName}`}
              title="Editar"
              onClick={() => setIsEditing(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-transparent text-muted transition-colors hover:border-[color:var(--border-strong)] hover:bg-[var(--surface-strong)] hover:text-[var(--accent)]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4.5 w-4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11.8 4.2 15.8 8.2" />
                <path d="M13.5 2.8a1.4 1.4 0 0 1 2 0l1.7 1.7a1.4 1.4 0 0 1 0 2L7.4 16.3 3.5 17.4l1.1-3.9 8.9-10.7Z" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
