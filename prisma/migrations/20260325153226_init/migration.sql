-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuOption" (
    "id" TEXT NOT NULL,
    "menuDayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LunchSelection" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "menuDayId" TEXT NOT NULL,
    "menuOptionId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LunchSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_name_key" ON "Person"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MenuDay_date_key" ON "MenuDay"("date");

-- CreateIndex
CREATE INDEX "MenuOption_menuDayId_sortOrder_idx" ON "MenuOption"("menuDayId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MenuOption_id_menuDayId_key" ON "MenuOption"("id", "menuDayId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuOption_menuDayId_name_key" ON "MenuOption"("menuDayId", "name");

-- CreateIndex
CREATE INDEX "LunchSelection_menuDayId_idx" ON "LunchSelection"("menuDayId");

-- CreateIndex
CREATE INDEX "LunchSelection_menuOptionId_idx" ON "LunchSelection"("menuOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "LunchSelection_personId_menuDayId_key" ON "LunchSelection"("personId", "menuDayId");

-- AddForeignKey
ALTER TABLE "MenuOption" ADD CONSTRAINT "MenuOption_menuDayId_fkey" FOREIGN KEY ("menuDayId") REFERENCES "MenuDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchSelection" ADD CONSTRAINT "LunchSelection_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchSelection" ADD CONSTRAINT "LunchSelection_menuDayId_fkey" FOREIGN KEY ("menuDayId") REFERENCES "MenuDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchSelection" ADD CONSTRAINT "LunchSelection_menuOptionId_menuDayId_fkey" FOREIGN KEY ("menuOptionId", "menuDayId") REFERENCES "MenuOption"("id", "menuDayId") ON DELETE CASCADE ON UPDATE CASCADE;
