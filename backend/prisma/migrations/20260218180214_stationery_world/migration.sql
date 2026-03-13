-- CreateTable
CREATE TABLE "product_notifications" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_notifications_productId_idx" ON "product_notifications"("productId");

-- CreateIndex
CREATE INDEX "product_notifications_userId_idx" ON "product_notifications"("userId");

-- CreateIndex
CREATE INDEX "product_notifications_notified_idx" ON "product_notifications"("notified");

-- CreateIndex
CREATE UNIQUE INDEX "product_notifications_productId_userId_key" ON "product_notifications"("productId", "userId");

-- AddForeignKey
ALTER TABLE "product_notifications" ADD CONSTRAINT "product_notifications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_notifications" ADD CONSTRAINT "product_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
