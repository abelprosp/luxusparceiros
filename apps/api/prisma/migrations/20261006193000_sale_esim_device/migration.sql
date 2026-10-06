CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID');

ALTER TYPE "DocumentType" ADD VALUE 'DEVICE_SCREEN';

ALTER TABLE "sales" ADD COLUMN "deviceImei" TEXT;
ALTER TABLE "sales" ADD COLUMN "deviceEid" TEXT;
ALTER TABLE "sales" ADD COLUMN "devicePlatform" "DevicePlatform";
