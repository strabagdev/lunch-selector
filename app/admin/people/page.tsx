import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PersonRow } from "./person-row";

export const dynamic = "force-dynamic";

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export default async function AdminPeoplePage() {
  const people = await prisma.person.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          selections: true,
        },
      },
    },
  });

  async function createPerson(formData: FormData) {
    "use server";

    const rawName = String(formData.get("name") ?? "");
    const name = normalizeName(rawName);

    if (!name) {
      return;
    }

    const existingPerson = await prisma.person.findUnique({
      where: { name },
      select: { id: true, isActive: true },
    });

    if (existingPerson) {
      if (!existingPerson.isActive) {
        await prisma.person.update({
          where: { id: existingPerson.id },
          data: { isActive: true },
        });
      }

      revalidatePath("/admin/people");
      return;
    }

    await prisma.person.create({
      data: { name },
    });

    revalidatePath("/admin/people");
  }

  async function deletePerson(formData: FormData) {
    "use server";

    const personId = String(formData.get("personId") ?? "");

    if (!personId) {
      return;
    }

    await prisma.person.delete({
      where: { id: personId },
    });

    revalidatePath("/admin/people");
  }

  async function updatePerson(formData: FormData) {
    "use server";

    const personId = String(formData.get("personId") ?? "");
    const rawName = String(formData.get("name") ?? "");
    const name = normalizeName(rawName);

    if (!personId || !name) {
      return;
    }

    const existingPerson = await prisma.person.findUnique({
      where: { name },
      select: { id: true },
    });

    if (existingPerson && existingPerson.id !== personId) {
      return;
    }

    await prisma.person.update({
      where: { id: personId },
      data: { name },
    });

    revalidatePath("/admin/people");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">Personas</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Administra la lista de personas que pueden participar en la selecci&oacute;n
          diaria de almuerzo.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Total
            </p>
            <p className="mt-2 text-sm font-semibold">{people.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Con historial
            </p>
            <p className="mt-2 text-sm font-semibold">
              {people.filter((person) => person._count.selections > 0).length}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Sin historial
            </p>
            <p className="mt-2 text-sm font-semibold">
              {people.filter((person) => person._count.selections === 0).length}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
        <h3 className="text-xl font-semibold tracking-tight">Agregar persona</h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Registra nuevas personas para que puedan aparecer en el selector de
          almuerzo.
        </p>

        <form action={createPerson} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Nombre</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Ejemplo: Daniela Soto"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
          >
            Guardar persona
          </button>
        </form>
      </section>

      <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Listado actual</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Al eliminar una persona tambi&eacute;n se borrar&aacute; su historial de
              selecciones asociado.
            </p>
          </div>
        </div>

        {people.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
            Todav&iacute;a no hay personas registradas.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {people.map((person) => (
              <PersonRow
                key={person.id}
                personId={person.id}
                personName={person.name}
                updateAction={updatePerson}
                deleteAction={deletePerson}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
