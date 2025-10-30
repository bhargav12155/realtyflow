import { config } from "dotenv";
config();

import { HeyGenPhotoAvatarService } from "./server/services/heygen-photo-avatar";
import * as fs from "fs";
import * as path from "path";

async function testUploadFromVihuFolder() {
  try {
    console.log("🧪 Testing Photo Avatar Upload from vihu folder...\n");

    const service = new HeyGenPhotoAvatarService();

    // Get images from vihu folder
    const vihuFolder = "./vihu";
    const files = fs
      .readdirSync(vihuFolder)
      .filter((f) => f.match(/\.(jpg|jpeg|png)$/i))
      .slice(0, 5); // Take first 5 images

    if (files.length < 5) {
      console.log(`❌ Need at least 5 images, found only ${files.length}`);
      return;
    }

    console.log(`📁 Found ${files.length} images in vihu folder:`);
    files.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));

    // Upload all photos to HeyGen
    console.log("\n📤 Uploading photos to HeyGen...\n");
    const imageKeys: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(vihuFolder, file);
      const buffer = fs.readFileSync(filePath);

      console.log(`   [${i + 1}/${files.length}] Uploading ${file}...`);

      try {
        const imageKey = await service.uploadCustomPhoto(buffer, "image/jpeg");
        imageKeys.push(imageKey);
        console.log(`   ✅ Uploaded: ${imageKey}`);
      } catch (error: any) {
        console.log(`   ❌ Failed to upload ${file}: ${error.message}`);
        throw error;
      }
    }

    console.log(`\n✅ All ${imageKeys.length} photos uploaded successfully!`);
    console.log("Image keys:", imageKeys);

    // Create avatar group
    console.log("\n👤 Creating avatar group...\n");
    const groupName = "Vihu Test Avatar Group";

    try {
      const result = await service.createAvatarGroup(groupName, imageKeys);
      console.log("\n🎉 SUCCESS! Avatar group created:");
      console.log(JSON.stringify(result, null, 2));

      // Start training
      if (result.avatar_group_id) {
        console.log(
          `\n🚀 Starting training for group: ${result.avatar_group_id}`
        );
        try {
          const trainResult = await service.trainAvatarGroup(
            result.avatar_group_id
          );
          console.log("✅ Training started:", trainResult);
        } catch (error: any) {
          console.log(
            "⚠️  Training start failed (this is okay, group is still created):",
            error.message
          );
        }
      }
    } catch (error: any) {
      console.log("\n❌ Failed to create avatar group:");
      console.log("Error:", error.message);
      throw error;
    }
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
  }
}

testUploadFromVihuFolder();
