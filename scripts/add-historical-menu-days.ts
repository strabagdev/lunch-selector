import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const historicalMenus = [
  {
    date: "2026-03-23",
    options: [
      {
        name: "Pastel de papas",
        sortOrder: 1,
      },
      {
        name: "Ensalada de atun",
        sortOrder: 2,
      },
      {
        name: "Arroz salteado de verduras",
        sortOrder: 3,
      },
    ],
    selections: [
      { personName: "Danny", optionName: "Pastel de papas" },
      { personName: "Camila", optionName: "Ensalada de atun" },
    ],
  },
  {
    date: "2026-03-24",
    options: [
      {
        name: "Pollo grillado con quinoa",
        sortOrder: 1,
      },
      {
        name: "Tortilla espanola",
        sortOrder: 2,
      },
      {
        name: "Pasta al pesto",
        sortOrder: 3,
      },
    ],
    selections: [
      { personName: "Fran", optionName: "Pasta al pesto" },
      { personName: "Javier", optionName: "Pollo grillado con quinoa" },
    ],
  },
];

async function main() {
  const people = await prisma.person.findMany({
    where: {
      name: {
        in: ["Danny", "Fran", "Camila", "Javier"],
      },
    },
  });

  const peopleByName = new Map(people.map((person) => [person.name, person]));

  for (const menu of historicalMenus) {
    const date = new Date(`${menu.date}T00:00:00.000Z`);

    const menuDay = await prisma.menuDay.upsert({
      where: { date },
      update: {},
      create: { date },
    });

    for (const option of menu.options) {
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

    for (const selection of menu.selections) {
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

  console.log("Historial de ejemplo cargado para 2026-03-23 y 2026-03-24.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
