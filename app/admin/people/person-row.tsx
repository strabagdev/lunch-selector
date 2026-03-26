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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3">
      <form
        action={async (formData) => {
          await updateAction(formData);
          setIsEditing(false);
        }}
        className="contents"
      >
        <input type="hidden" name="personId" value={personId} />
        <label className="block">
          {isEditing ? (
            <span className="mb-2 inline-flex rounded-full bg-[rgba(180,83,9,0.1)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
              Editando
            </span>
          ) : null}
          <div className="flex min-h-[44px] items-center">
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
                className="w-full rounded-2xl border border-accent bg-white px-4 py-3 text-sm font-medium outline-none transition-colors"
              />
            ) : (
              <span className="text-sm font-medium">{personName}</span>
            )}
          </div>
        </label>

        <div className="flex flex-wrap items-center justify-end gap-3">
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
        <form action={deleteAction} className="col-span-2 flex justify-end">
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
