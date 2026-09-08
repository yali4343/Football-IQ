-- CreateTable
CREATE TABLE "League" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "footballDataId" INTEGER NOT NULL,
    "apiFootballLeagueId" INTEGER,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "League_footballDataId_key" ON "League"("footballDataId");

-- CreateIndex
CREATE UNIQUE INDEX "League_apiFootballLeagueId_key" ON "League"("apiFootballLeagueId");
