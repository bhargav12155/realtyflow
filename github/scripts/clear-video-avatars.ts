import { db } from "../server/db";
import { videoAvatars } from "../shared/schema";
import { eq } from "drizzle-orm";

async function clearVideoAvatars() {
  // Clear all video avatars for all users (to fix the group_id vs avatar_id issue)
  
  console.log(`🗑️ Clearing ALL video avatars from database...`);
  console.log(`📢 Users will need to re-sync their video avatars after this fix.`);
  
  // First, list all existing video avatars
  const existing = await db.select().from(videoAvatars);
  console.log(`📋 Found ${existing.length} video avatars to clear:`);
  for (const avatar of existing) {
    console.log(`  - User ${avatar.userId}: ${avatar.avatarName} (${avatar.heygenAvatarId})`);
  }
  
  const result = await db.delete(videoAvatars);
  
  console.log(`\n✅ Cleared ${result.rowCount} video avatars.`);
  console.log(`📢 Users should now click "Sync with HeyGen" to get the correct avatar IDs.`);
  
  process.exit(0);
}

clearVideoAvatars().catch(console.error);
