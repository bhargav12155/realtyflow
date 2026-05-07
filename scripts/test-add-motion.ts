#!/usr/bin/env tsx
/**
 * Test script for Add Motion feature
 * Tests the HeyGen Add Motion API integration
 */

import * as dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../.env") });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const BASE_URL = "https://api.heygen.com/v2";

if (!HEYGEN_API_KEY) {
  console.error("❌ HEYGEN_API_KEY not found in .env file");
  process.exit(1);
}

interface AddMotionRequest {
  id: string; // Avatar/look ID
  prompt?: string; // Optional motion description
  motion_type?:
    | "expressive"
    | "consistent"
    | "consistent_gen_3"
    | "hailuo_2"
    | "veo2"
    | "seedance_lite"
    | "kling";
}

async function testAddMotion(
  avatarId: string,
  prompt?: string,
  motionType?: string
) {
  console.log("\n🎬 Testing Add Motion API");
  console.log("=".repeat(60));
  console.log(`Avatar ID: ${avatarId}`);
  console.log(`Prompt: ${prompt || "(automatic motion)"}`);
  console.log(`Motion Type: ${motionType || "consistent (default)"}`);
  console.log("=".repeat(60));

  const payload: AddMotionRequest = {
    id: avatarId,
    motion_type: (motionType as any) || "consistent",
  };

  if (prompt) {
    payload.prompt = prompt;
  }

  console.log("\n📤 Request Payload:");
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(`${BASE_URL}/photo_avatar/add_motion`, {
      method: "POST",
      headers: {
        "X-Api-Key": HEYGEN_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log(
      `\n📨 Response Status: ${response.status} ${response.statusText}`
    );

    const data = await response.json();
    console.log("\n📦 Response Body:");
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("\n✅ SUCCESS! Motion generation started.");
      console.log("📝 Next steps:");
      console.log("   1. The animated version is being generated");
      console.log(
        "   2. Check the avatar details to get the motion preview URL"
      );
      console.log("   3. Use GET /v2/photo_avatar/{avatar_id} to check status");

      if (data.data) {
        console.log("\n🎯 Generated Avatar Details:");
        console.log(`   - ID: ${data.data.id || "N/A"}`);
        console.log(`   - Status: ${data.data.status || "N/A"}`);
        console.log(`   - Is Motion: ${data.data.is_motion || false}`);
        console.log(
          `   - Motion Preview URL: ${
            data.data.motion_preview_url || "Processing..."
          }`
        );
      }
    } else {
      console.log("\n❌ FAILED!");
      if (data.error) {
        console.log(`   Error Code: ${data.error.code}`);
        console.log(`   Error Message: ${data.error.message}`);
      }
    }

    return { success: response.ok, data };
  } catch (error) {
    console.error("\n❌ Request failed:", error);
    return { success: false, error };
  }
}

async function getAvatarDetails(avatarId: string) {
  console.log("\n🔍 Fetching Avatar Details");
  console.log("=".repeat(60));

  try {
    const response = await fetch(`${BASE_URL}/photo_avatar/${avatarId}`, {
      method: "GET",
      headers: {
        "X-Api-Key": HEYGEN_API_KEY!,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok && data.data) {
      console.log("✅ Avatar found!");
      console.log(`   - Name: ${data.data.name}`);
      console.log(`   - Status: ${data.data.status}`);
      console.log(`   - Group ID: ${data.data.group_id}`);
      console.log(`   - Is Motion: ${data.data.is_motion || false}`);
      console.log(`   - Business Type: ${data.data.business_type}`);
      console.log(
        `   - Created: ${new Date(
          data.data.created_at * 1000
        ).toLocaleString()}`
      );

      if (data.data.motion_preview_url) {
        console.log(`   - Motion Preview: ${data.data.motion_preview_url}`);
      }

      return data.data;
    } else {
      console.log("❌ Avatar not found or error:");
      console.log(JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    console.error("❌ Failed to fetch avatar:", error);
    return null;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("\n📖 Usage:");
    console.log(
      "   tsx scripts/test-add-motion.ts <avatar_id> [prompt] [motion_type]"
    );
    console.log("\nExamples:");
    console.log(
      '   tsx scripts/test-add-motion.ts "7bb7f1897ec047b490f91cb115320a7d"'
    );
    console.log(
      '   tsx scripts/test-add-motion.ts "7bb7f1897ec047b490f91cb115320a7d" "running"'
    );
    console.log(
      '   tsx scripts/test-add-motion.ts "7bb7f1897ec047b490f91cb115320a7d" "running" "expressive"'
    );
    console.log("\nMotion Types:");
    console.log("   - consistent (default)");
    console.log("   - expressive");
    console.log("   - consistent_gen_3");
    console.log("   - hailuo_2");
    console.log("   - veo2");
    console.log("   - seedance_lite");
    console.log("   - kling");
    process.exit(0);
  }

  const avatarId = args[0];
  const prompt = args[1];
  const motionType = args[2];

  // First, get avatar details to verify it exists
  console.log("\n🚀 Starting Add Motion Test");
  const avatarDetails = await getAvatarDetails(avatarId);

  if (!avatarDetails) {
    console.log("\n⚠️  Avatar not found. Please provide a valid avatar ID.");
    console.log(
      "💡 Tip: You can get avatar IDs from the Photo Avatar Manager in the app."
    );
    process.exit(1);
  }

  // Test add motion
  const result = await testAddMotion(avatarId, prompt, motionType);

  if (result.success) {
    console.log("\n🎉 Test completed successfully!");

    // Wait a moment and check the avatar again
    console.log("\n⏳ Waiting 3 seconds before checking avatar status...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await getAvatarDetails(avatarId);
  } else {
    console.log("\n❌ Test failed!");
    process.exit(1);
  }
}

main().catch(console.error);
