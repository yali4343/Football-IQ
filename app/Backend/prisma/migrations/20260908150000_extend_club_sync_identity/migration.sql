-- AlterTable
ALTER TABLE "Club" DROP COLUMN "league",
ADD COLUMN     "apiFootballId" INTEGER,
ADD COLUMN     "footballDataId" INTEGER NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "leagueId" INTEGER NOT NULL,
ADD COLUMN     "squadLastSyncedAt" TIMESTAMP(3),
ALTER COLUMN "stadium" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Club_footballDataId_key" ON "Club"("footballDataId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_apiFootballId_key" ON "Club"("apiFootballId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
