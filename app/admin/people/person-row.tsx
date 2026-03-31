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
      className={`px-4 py-4 transition-colors ${
        isEditing ? "bg-[rgba(215,243,239,0.28)]" : "bg-transparent"
      }`}
    >
      <form
        action={async (formData) => {
          await updateAction(formData);
          setIsEditing(false);
        }}
        className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
      >
        <input type="hidden" name="personId" value={personId} />
        <div className="space-y-3">
          {isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
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
                className="h-11 w-full rounded-[16px] border border-[var(--accent-border)] bg-white px-4 text-base font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition-colors sm:text-sm"
              />
            ) : (
              <div className="flex min-h-[44px] items-center rounded-[16px] border border-transparent bg-transparent px-1">
                <span className="text-sm font-medium">{personName}</span>
              </div>
            )}
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end lg:self-start">
          {isEditing ? (
            <>
              <button
                type="submit"
                disabled={!isDirty || !normalizedDraft}
                className="order-1 rounded-[14px] bg-[linear-gradient(180deg,var(--accent),#0a5a54)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_24px_-16px_rgba(15,23,42,0.32)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
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
              onClick={() => setIsEditing(true)}
              className="rounded-[14px] border border-[color:var(--border-strong)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-strong)]"
            >
              Editar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
