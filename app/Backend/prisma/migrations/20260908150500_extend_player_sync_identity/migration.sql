-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "externalApiId" INTEGER NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "number" INTEGER,
ADD COLUMN     "photoUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Player_externalApiId_key" ON "Player"("externalApiId");
