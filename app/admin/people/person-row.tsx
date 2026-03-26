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
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <form
        action={async (formData) => {
          await updateAction(formData);
          setIsEditing(false);
        }}
        className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="personId" value={personId} />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                isEditing
                  ? "bg-[rgba(180,83,9,0.1)] text-[var(--accent)]"
                  : "bg-[rgba(27,94,32,0.08)] text-[rgb(27,94,32)]"
              }`}
            >
              {isEditing ? "Editando" : "Guardado"}
            </span>
          </div>

          <label className="block">
            <span className="sr-only">Nombre</span>
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
              className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium outline-none transition-colors ${
                isEditing
                  ? "border-accent bg-white"
                  : "border-border bg-surface"
              }`}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3 sm:flex-none">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraftName(personName);
                  setIsEditing(false);
                }}
                className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-background"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!isDirty || !normalizedDraft}
                className="rounded-2xl border border-border bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                Guardar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-background"
            >
              Editar
            </button>
          )}
        </div>
      </form>

      {isEditing ? (
        <form action={deleteAction}>
          <input type="hidden" name="personId" value={personId} />
          <button
            type="submit"
            className="rounded-2xl border border-[rgba(154,52,18,0.18)] bg-[rgba(154,52,18,0.06)] px-4 py-2.5 text-sm font-medium text-[rgb(154,52,18)] transition-colors hover:bg-[rgba(154,52,18,0.1)]"
          >
            Eliminar
          </button>
        </form>
      ) : null}
    </div>
  );
}
