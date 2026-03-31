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
        <h3 className="text-xl font-semibold tracking-tight">Agregar persona</h3>

        <form action={createPerson} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Nombre</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Ejemplo: Daniela Soto"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none transition-colors focus:border-accent sm:text-sm"
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
        <h3 className="text-xl font-semibold tracking-tight">Personas</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          Al eliminar una persona tambi&eacute;n se borrar&aacute; su historial de
          selecciones asociado.
        </p>

        {people.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-background px-5 py-4 text-sm leading-6 text-muted">
            Todav&iacute;a no hay personas registradas.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-background">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              <span>Nombre</span>
              <span>Acciones</span>
            </div>
            <div className="divide-y divide-border">
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
          </div>
        )}
      </section>
    </div>
  );
}
