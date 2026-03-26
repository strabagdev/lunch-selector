import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const people = ["Danny", "Fran", "Camila", "Javier"];

const menuTemplates = [
  {
    dayOffset: 0,
    options: [
      {
        name: "Pollo al horno con arroz",
        sortOrder: 1,
      },
      {
        name: "Ensalada cesar con pollo",
        sortOrder: 2,
      },
      {
        name: "Pasta vegetariana",
        sortOrder: 3,
      },
    ],
    selections: [
      { personName: "Danny", optionName: "Pollo al horno con arroz" },
      { personName: "Fran", optionName: "Pasta vegetariana" },
    ],
  },
  {
    dayOffset: 1,
    options: [
      {
        name: "Carne al jugo con pure",
        sortOrder: 1,
      },
      {
        name: "Wrap de pollo grillado",
        sortOrder: 2,
      },
      {
        name: "Lasaña de verduras",
        sortOrder: 3,
      },
    ],
    selections: [
      { personName: "Camila", optionName: "Wrap de pollo grillado" },
    ],
  },
  {
    dayOffset: 2,
    options: [
      {
        name: "Pescado apanado con papas cocidas",
        sortOrder: 1,
      },
      {
        name: "Bowl mediterraneo",
        sortOrder: 2,
      },
      {
        name: "Ñoquis con salsa de albahaca",
        sortOrder: 3,
      },
    ],
    selections: [
      { personName: "Javier", optionName: "Pescado apanado con papas cocidas" },
    ],
  },
];

function getTodayInSantiago() {
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return new Date(`${todayKey}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

async function main() {
  for (const name of people) {
    await prisma.person.upsert({
      where: { name },
      update: { isActive: true },
      create: { name },
    });
  }

  const peopleByName = new Map(
    (
      await prisma.person.findMany({
        where: { name: { in: people } },
      })
    ).map((person) => [person.name, person]),
  );

  const baseDate = getTodayInSantiago();

  for (const template of menuTemplates) {
    const menuDate = addUtcDays(baseDate, template.dayOffset);

    const menuDay = await prisma.menuDay.upsert({
      where: { date: menuDate },
      update: {},
      create: {
        date: menuDate,
      },
    });

    for (const option of template.options) {
      await prisma.menuOption.upsert({
        where: {
          menuDayId_name: {
            menuDayId: menuDay.id,
            name: option.name,
          },
        },
        update: {
          sortOrder: option.sortOrder,
          isAvailable: true,
        },
        create: {
          menuDayId: menuDay.id,
          name: option.name,
          sortOrder: option.sortOrder,
          isAvailable: true,
        },
      });
    }

    for (const selection of template.selections) {
      const person = peopleByName.get(selection.personName);

      if (!person) {
        continue;
      }

      const option = await prisma.menuOption.findUniqueOrThrow({
        where: {
          menuDayId_name: {
            menuDayId: menuDay.id,
            name: selection.optionName,
          },
        },
      });

      await prisma.lunchSelection.upsert({
        where: {
          personId_menuDayId: {
            personId: person.id,
            menuDayId: menuDay.id,
          },
        },
        update: {
          menuOptionId: option.id,
        },
        create: {
          personId: person.id,
          menuDayId: menuDay.id,
          menuOptionId: option.id,
        },
      });
    }
  }

  const menuDayCount = await prisma.menuDay.count();
  const optionCount = await prisma.menuOption.count();
  const selectionCount = await prisma.lunchSelection.count();

  console.log(
    `Seed listo: ${people.length} personas, ${menuDayCount} menus del dia, ${optionCount} opciones y ${selectionCount} selecciones.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed fallo:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
