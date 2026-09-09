-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "address" TEXT,
ADD COLUMN     "areaId" INTEGER,
ADD COLUMN     "clubColors" TEXT,
ADD COLUMN     "crest" TEXT,
ADD COLUMN     "founded" INTEGER,
ADD COLUMN     "lastUpdated" TIMESTAMP(3),
ADD COLUMN     "shortName" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "Area" (
    "id" SERIAL NOT NULL,
    "footballDataAreaId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "flag" TEXT,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" SERIAL NOT NULL,
    "footballDataCompetitionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT,
    "emblem" TEXT,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" SERIAL NOT NULL,
    "footballDataCoachId" INTEGER NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "name" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "contractStart" TIMESTAMP(3),
    "contractUntil" TIMESTAMP(3),
    "clubId" INTEGER NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ClubToCompetition" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ClubToCompetition_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_footballDataAreaId_key" ON "Area"("footballDataAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_footballDataCompetitionId_key" ON "Competition"("footballDataCompetitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_footballDataCoachId_key" ON "Coach"("footballDataCoachId");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_clubId_key" ON "Coach"("clubId");

-- CreateIndex
CREATE INDEX "_ClubToCompetition_B_index" ON "_ClubToCompetition"("B");

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClubToCompetition" ADD CONSTRAINT "_ClubToCompetition_A_fkey" FOREIGN KEY ("A") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClubToCompetition" ADD CONSTRAINT "_ClubToCompetition_B_fkey" FOREIGN KEY ("B") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
