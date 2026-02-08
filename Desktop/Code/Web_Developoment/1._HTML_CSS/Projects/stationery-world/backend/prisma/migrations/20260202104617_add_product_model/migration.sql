-- CreateEnum
CREATE TYPE "Category" AS ENUM ('STATIONERY', 'BOOKS', 'TOYS');

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "Category" NOT NULL,
    "subCategory" TEXT NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL,
    "baseSellingPrice" DOUBLE PRECISION NOT NULL,
    "bargainable" BOOLEAN NOT NULL DEFAULT true,
    "lowStockThreshold" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
