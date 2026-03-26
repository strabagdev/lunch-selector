import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdminMenuConfigPageProps = {
  searchParams: Promise<{
    edit?: string | string[] | undefined;
  }>;
};

function getSingleParam(value: string | string[] | undefined) {
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

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export default async function AdminMenuConfigPage({
  searchParams,
}: AdminMenuConfigPageProps) {
  const resolvedSearchParams = await searchParams;
  const editingMenuDayId = getSingleParam(resolvedSearchParams.edit);
  const todayKey = getTodayKey();
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);

  const menuDays = await prisma.menuDay.findMany({
    where: {
      date: {
        gte: todayDate,
      },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      options: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          sortOrder: true,
          isAvailable: true,
        },
      },
      _count: {
        select: {
          selections: true,
        },
      },
    },
  });

  async function createMenuDay(formData: FormData) {
    "use server";

    const dateValue = String(formData.get("date") ?? "");
    const optionNames = formData
      .getAll("optionName")
      .map((value) => normalizeText(String(value ?? "")));
    const optionSortOrders = formData
      .getAll("optionSortOrder")
      .map((value) => Number(String(value ?? "0")));

    if (!dateValue) {
      return;
    }

    const date = new Date(`${dateValue}T00:00:00.000Z`);
    const optionsToCreate = optionNames
      .map((name, index) => ({
        name,
        sortOrder: Number.isFinite(optionSortOrders[index]) ? optionSortOrders[index] : index + 1,
      }))
      .filter((option) => option.name.length > 0)
      .filter(
        (option, index, collection) =>
          collection.findIndex((candidate) => candidate.name === option.name) === index,
      );

    const existingMenuDay = await prisma.menuDay.findUnique({
      where: { date },
      select: { id: true },
    });

    if (!existingMenuDay) {
      await prisma.menuDay.create({
        data: {
          date,
          options:
            optionsToCreate.length === 0
              ? undefined
              : {
                  create: optionsToCreate.map((option) => ({
                    name: option.name,
                    sortOrder: option.sortOrder,
                    isAvailable: true,
                  })),
                },
        },
        select: { id: true },
      });
    }

    revalidatePath("/admin/menu-config");
    revalidatePath("/");
    revalidatePath("/admin");
  }

  async function deleteMenuDay(formData: FormData) {
    "use server";

    const menuDayId = String(formData.get("menuDayId") ?? "");

    if (!menuDayId) {
      return;
    }

    await prisma.menuDay.delete({
      where: { id: menuDayId },
      select: { id: true },
    });

    revalidatePath("/admin/menu-config");
    revalidatePath("/");
    revalidatePath("/admin");
  }

  async function createMenuOption(formData: FormData) {
    "use server";

    const menuDayId = String(formData.get("menuDayId") ?? "");
    const name = normalizeText(String(formData.get("name") ?? ""));
    const sortOrderValue = Number(String(formData.get("sortOrder") ?? "0"));

    if (!menuDayId || !name) {
      return;
    }

    const existingOption = await prisma.menuOption.findUnique({
      where: {
        menuDayId_name: {
          menuDayId,
          name,
        },
      },
      select: { id: true },
    });

    if (existingOption) {
      await prisma.menuOption.update({
        where: { id: existingOption.id },
        data: {
          sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
          isAvailable: true,
        },
        select: { id: true },
      });
    } else {
      await prisma.menuOption.create({
        data: {
          menuDayId,
          name,
          sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
          isAvailable: true,
        },
        select: { id: true },
      });
    }

    revalidatePath("/admin/menu-config");
    revalidatePath("/");
    revalidatePath("/admin");
  }

  async function updateMenuOption(formData: FormData) {
    "use server";

    const optionId = String(formData.get("optionId") ?? "");
    const menuDayId = String(formData.get("menuDayId") ?? "");
    const name = normalizeText(String(formData.get("name") ?? ""));
    const sortOrderValue = Number(String(formData.get("sortOrder") ?? "0"));

    if (!optionId || !menuDayId || !name) {
      return;
    }

    const duplicatedOption = await prisma.menuOption.findUnique({
      where: {
        menuDayId_name: {
          menuDayId,
          name,
        },
      },
      select: { id: true },
    });

    if (duplicatedOption && duplicatedOption.id !== optionId) {
      return;
    }

    await prisma.menuOption.update({
      where: { id: optionId },
      data: {
        name,
        sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
      },
      select: { id: true },
    });

    revalidatePath("/admin/menu-config");
    revalidatePath("/");
    revalidatePath("/admin");
  }

  async function toggleMenuOptionStatus(formData: FormData) {
    "use server";

    const optionId = String(formData.get("optionId") ?? "");
    const nextValue = String(formData.get("nextValue") ?? "") === "true";

    if (!optionId) {
      return;
    }

    await prisma.menuOption.update({
      where: { id: optionId },
      data: { isAvailable: nextValue },
      select: { id: true },
    });

    revalidatePath("/admin/menu-config");
    revalidatePath("/");
    revalidatePath("/admin");
  }

  async function deleteMenuOption(formData: FormData) {
    "use server";

    const optionId = String(formData.get("optionId") ?? "");

    if (!optionId) {
      return;
    }

    await prisma.menuOption.delete({
      where: { id: optionId },
      select: { id: true },
    });

    revalidatePath("/admin/menu-config");
    revalidatePath("/");
    revalidatePath("/admin");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
        <h3 className="text-xl font-semibold tracking-tight">Crear fecha y opciones</h3>
        <form action={createMenuDay} className="mt-6 space-y-5">
          <label className="block max-w-[220px]">
            <span className="mb-2 block text-sm font-medium">Fecha</span>
            <input
              type="date"
              name="date"
              required
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>

          <div className="space-y-3">
            <p className="text-sm font-medium">Opciones iniciales</p>
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px]"
              >
                <label className="block">
                  <span className="sr-only">Opci&oacute;n {item}</span>
                  <input
                    type="text"
                    name="optionName"
                    placeholder={`Menú ${item}`}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Orden de opci&oacute;n {item}</span>
                  <input
                    type="number"
                    name="optionSortOrder"
                    defaultValue={item}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                  />
                </label>
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
          >
            Guardar fecha
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {menuDays.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-border bg-surface px-6 py-5 text-sm leading-6 text-muted">
            Todav&iacute;a no hay fechas futuras o vigentes configuradas.
          </div>
        ) : (
          menuDays.map((menuDay) => (
            <section
              key={menuDay.id}
              className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted">
                      {menuDay.options.length} opciones
                    </span>
                    <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted">
                      {menuDay._count.selections} selecciones
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight">
                    {formatMenuDate(menuDay.date)}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={
                      editingMenuDayId === menuDay.id
                        ? "/admin/menu-config"
                        : `/admin/menu-config?edit=${menuDay.id}`
                    }
                    className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
                  >
                    {editingMenuDayId === menuDay.id ? "Cerrar edición" : "Editar"}
                  </Link>
                  <form action={deleteMenuDay}>
                    <input type="hidden" name="menuDayId" value={menuDay.id} />
                    <button
                      type="submit"
                      className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-2.5 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[rgba(220,63,97,0.14)]"
                    >
                      Eliminar fecha
                    </button>
                  </form>
                </div>
              </div>

              {editingMenuDayId === menuDay.id ? (
                <div className="mt-6 space-y-3">
                  {menuDay.options.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-4 text-sm leading-6 text-muted">
                      Esta fecha todav&iacute;a no tiene opciones configuradas.
                    </div>
                  ) : (
                    menuDay.options.map((option) => (
                      <div
                        key={option.id}
                        className="rounded-2xl border border-border bg-background px-4 py-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                          <form
                            action={updateMenuOption}
                            className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-end"
                          >
                            <input type="hidden" name="optionId" value={option.id} />
                            <input type="hidden" name="menuDayId" value={menuDay.id} />
                            <label className="block flex-1">
                              <span className="mb-2 block text-sm font-medium">
                                Nombre
                              </span>
                              <input
                                type="text"
                                name="name"
                                required
                                defaultValue={option.name}
                                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                              />
                            </label>
                            <label className="block w-full lg:w-[110px]">
                              <span className="mb-2 block text-sm font-medium">Orden</span>
                              <input
                                type="number"
                                name="sortOrder"
                                defaultValue={option.sortOrder}
                                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                              />
                            </label>
                            <button
                              type="submit"
                              className="rounded-2xl bg-foreground px-4 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
                            >
                              Guardar
                            </button>
                          </form>

                          <div className="flex flex-wrap gap-3">
                            <form action={toggleMenuOptionStatus}>
                              <input type="hidden" name="optionId" value={option.id} />
                              <input
                                type="hidden"
                                name="nextValue"
                                value={option.isAvailable ? "false" : "true"}
                              />
                              <button
                                type="submit"
                                className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium transition-colors hover:bg-background"
                              >
                                {option.isAvailable ? "Ocultar" : "Mostrar"}
                              </button>
                            </form>

                            <form action={deleteMenuOption}>
                              <input type="hidden" name="optionId" value={option.id} />
                              <button
                                type="submit"
                                className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[rgba(220,63,97,0.14)]"
                              >
                                Eliminar
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {menuDay.options.length === 0 ? (
                    <span className="text-sm text-muted">
                      Sin opciones configuradas
                    </span>
                  ) : (
                    menuDay.options.map((option) => (
                      <span
                        key={option.id}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          option.isAvailable
                            ? "border border-border bg-background text-foreground"
                            : "border border-border bg-surface text-muted"
                        }`}
                      >
                        {option.name}
                      </span>
                    ))
                  )}
                </div>
              )}

              {editingMenuDayId === menuDay.id ? (
                <div className="mt-6 rounded-[1.5rem] border border-border bg-background p-5">
                  <h4 className="text-sm font-semibold">Agregar opci&oacute;n</h4>
                  <form
                    action={createMenuOption}
                    className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px_auto]"
                  >
                    <input type="hidden" name="menuDayId" value={menuDay.id} />
                    <label className="block">
                      <span className="sr-only">Nombre de la opci&oacute;n</span>
                      <input
                        type="text"
                        name="name"
                        required
                        placeholder="Ejemplo: Pollo con arroz"
                        className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                      />
                    </label>
                    <label className="block">
                      <span className="sr-only">Orden</span>
                      <input
                        type="number"
                        name="sortOrder"
                        defaultValue={menuDay.options.length + 1}
                        className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
                    >
                      Agregar opci&oacute;n
                    </button>
                  </form>
                </div>
              ) : null}
            </section>
          ))
        )}
      </section>
    </div>
  );
}
