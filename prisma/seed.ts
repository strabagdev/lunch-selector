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

const menuDate = new Date("2026-03-25T00:00:00.000Z");

const menuOptions = [
  {
    name: "Pollo al horno con arroz",
    description: "Porcion clasica con ensalada verde.",
    sortOrder: 1,
  },
  {
    name: "Ensalada cesar con pollo",
    description: "Ligera y rapida para almuerzo de oficina.",
    sortOrder: 2,
  },
  {
    name: "Pasta vegetariana",
    description: "Con salsa de tomates asados y verduras.",
    sortOrder: 3,
  },
];

async function main() {
  for (const name of people) {
    await prisma.person.upsert({
      where: { name },
      update: { isActive: true },
      create: { name },
    });
  }

  const menuDay = await prisma.menuDay.upsert({
    where: { date: menuDate },
    update: {
      label: "Menu de ejemplo",
      isOpen: true,
    },
    create: {
      date: menuDate,
      label: "Menu de ejemplo",
      isOpen: true,
    },
  });

  for (const option of menuOptions) {
    await prisma.menuOption.upsert({
      where: {
        menuDayId_name: {
          menuDayId: menuDay.id,
          name: option.name,
        },
      },
      update: {
        description: option.description,
        sortOrder: option.sortOrder,
        isAvailable: true,
      },
      create: {
        menuDayId: menuDay.id,
        name: option.name,
        description: option.description,
        sortOrder: option.sortOrder,
        isAvailable: true,
      },
    });
  }

  const danny = await prisma.person.findUniqueOrThrow({
    where: { name: "Danny" },
  });
  const fran = await prisma.person.findUniqueOrThrow({
    where: { name: "Fran" },
  });
  const pollo = await prisma.menuOption.findUniqueOrThrow({
    where: {
      menuDayId_name: {
        menuDayId: menuDay.id,
        name: "Pollo al horno con arroz",
      },
    },
  });
  const pasta = await prisma.menuOption.findUniqueOrThrow({
    where: {
      menuDayId_name: {
        menuDayId: menuDay.id,
        name: "Pasta vegetariana",
      },
    },
  });

  await prisma.lunchSelection.upsert({
    where: {
      personId_menuDayId: {
        personId: danny.id,
        menuDayId: menuDay.id,
      },
    },
    update: {
      menuOptionId: pollo.id,
    },
    create: {
      personId: danny.id,
      menuDayId: menuDay.id,
      menuOptionId: pollo.id,
    },
  });

  await prisma.lunchSelection.upsert({
    where: {
      personId_menuDayId: {
        personId: fran.id,
        menuDayId: menuDay.id,
      },
    },
    update: {
      menuOptionId: pasta.id,
    },
    create: {
      personId: fran.id,
      menuDayId: menuDay.id,
      menuOptionId: pasta.id,
    },
  });

  const optionCount = await prisma.menuOption.count({
    where: { menuDayId: menuDay.id },
  });
  const selectionCount = await prisma.lunchSelection.count({
    where: { menuDayId: menuDay.id },
  });

  console.log(
    `Seed listo: ${people.length} personas, 1 menu del dia, ${optionCount} opciones y ${selectionCount} selecciones.`,
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
