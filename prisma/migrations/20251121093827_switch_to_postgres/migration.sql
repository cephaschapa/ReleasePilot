-- CreateEnum
CREATE TYPE "DigestStatus" AS ENUM ('healthy', 'warning', 'critical');

-- CreateTable
CREATE TABLE "Digest" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "DigestStatus" NOT NULL,
    "highlights" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "incidents" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Digest_pkey" PRIMARY KEY ("id")
);
