/*
  Warnings:

  - You are about to drop the column `creditCost` on the `GameRecord` table. All the data in the column will be lost.
  - You are about to drop the column `credits` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_userId_fkey";

-- AlterTable
ALTER TABLE "GameRecord" DROP COLUMN "creditCost";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "credits";

-- DropTable
DROP TABLE "Transaction";
