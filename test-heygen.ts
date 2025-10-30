import { config } from "dotenv";
config();

import { HeyGenPhotoAvatarService } from "./server/services/heygen-photo-avatar";
import * as fs from "fs";
import * as path from "path";

async function testHeyGenUpload() {
  try {
    console.log("🧪 Testing HeyGen Photo Avatar Service...\n");

    const service = new HeyGenPhotoAvatarService();

    // Test 1: Check if service initializes
    console.log("✅ Service initialized successfully");

    // Test 2: Try to list avatar groups
    console.log("\n📋 Testing list avatar groups...");
    try {
      const groups = await service.listAvatarGroups();
      console.log("✅ List avatar groups successful:", groups);
    } catch (error: any) {
      console.log("❌ List avatar groups failed:", error.message);
    }

    // Test 3: Try uploading a test image (if one exists)
    const testImagePath = "uploads";
    if (fs.existsSync(testImagePath)) {
      const files = fs
        .readdirSync(testImagePath)
        .filter((f) => f.match(/\.(jpg|jpeg|png)$/i));
      if (files.length > 0) {
        console.log(`\n📤 Testing photo upload with: ${files[0]}`);
        try {
          const buffer = fs.readFileSync(path.join(testImagePath, files[0]));
          const imageKey = await service.uploadCustomPhoto(
            buffer,
            "image/jpeg"
          );
          console.log("✅ Photo upload successful! Image key:", imageKey);

          // Test 4: Try creating an avatar group with single photo
          console.log("\n👤 Testing create avatar group...");
          try {
            const groupResult = await service.createAvatarGroup("Test Group", [
              imageKey,
            ]);
            console.log("✅ Avatar group creation successful:", groupResult);
          } catch (error: any) {
            console.log("❌ Avatar group creation failed:", error.message);
          }
        } catch (error: any) {
          console.log("❌ Photo upload failed:", error.message);
        }
      } else {
        console.log("\n⚠️  No test images found in uploads/ directory");
      }
    } else {
      console.log("\n⚠️  uploads/ directory not found");
    }
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

testHeyGenUpload();
