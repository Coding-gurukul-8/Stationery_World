-- AlterTable
ALTER TABLE "bargain_attempts" ADD COLUMN     "acceptedTier" INTEGER,
ADD COLUMN     "addedToCart" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cartAddedAt" TIMESTAMP(3),
ADD COLUMN     "finalPrice" DOUBLE PRECISION,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "isAbused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "offerLockExpiry" TIMESTAMP(3),
ADD COLUMN     "purchasedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "bargain_configs" ADD COLUMN     "allowCouponCombination" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bargainAmountLimit" DOUBLE PRECISION,
ADD COLUMN     "bargainExpiryDate" TIMESTAMP(3),
ADD COLUMN     "bargainPercentageLimit" DOUBLE PRECISION,
ADD COLUMN     "bargainStockLimit" INTEGER,
ADD COLUMN     "bargainStockUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "lockDurationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "minimumCartValueForBargain" DOUBLE PRECISION,
ADD COLUMN     "minimumCustomerOrdersRequired" INTEGER DEFAULT 0,
ADD COLUMN     "requiresLogin" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "bargain_attempts_userId_isAbused_idx" ON "bargain_attempts"("userId", "isAbused");

-- CreateIndex
CREATE INDEX "bargain_attempts_productId_accepted_idx" ON "bargain_attempts"("productId", "accepted");

-- CreateIndex
CREATE INDEX "bargain_attempts_offerLockExpiry_idx" ON "bargain_attempts"("offerLockExpiry");

-- CreateIndex
CREATE INDEX "bargain_configs_productId_isActive_idx" ON "bargain_configs"("productId", "isActive");

-- CreateIndex
CREATE INDEX "bargain_configs_bargainExpiryDate_idx" ON "bargain_configs"("bargainExpiryDate");
