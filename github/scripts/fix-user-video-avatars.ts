import { db } from "../server/db";
import { videoAvatars } from "../shared/schema";
import { eq, and, notInArray } from "drizzle-orm";

// Clear video avatars that don't match the user's actual avatars
// User 2 (bhargav12155@gmail.com) only owns: "bhargav avatar train night" and "bhargav avatar train"

async function fixUserVideoAvatars() {
  const userId = 2; // bhargav12155@gmail.com
  
  // These are the only avatars that belong to user 2
  const ownedAvatarNames = [
    "bhargav avatar train night",
    "bhargav avatar train"
  ];
  
  console.log(`🔧 Fixing video avatars for user ${userId}...`);
  console.log(`📋 User owns: ${ownedAvatarNames.join(", ")}`);
  
  // Get all avatars for this user
  const userAvatars = await db.select().from(videoAvatars).where(eq(videoAvatars.userId, userId));
  console.log(`📋 Found ${userAvatars.length} avatars in database for user ${userId}:`);
  
  for (const avatar of userAvatars) {
    const isOwned = ownedAvatarNames.some(name => 
      avatar.avatarName?.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(avatar.avatarName?.toLowerCase() || '')
    );
    
    if (isOwned) {
      console.log(`  ✅ Keep: ${avatar.avatarName} (${avatar.heygenAvatarId})`);
    } else {
      console.log(`  ❌ Remove: ${avatar.avatarName} (${avatar.heygenAvatarId})`);
      await db.delete(videoAvatars).where(
        and(
          eq(videoAvatars.userId, userId),
          eq(videoAvatars.id, avatar.id)
        )
      );
    }
  }
  
  // Verify
  const remaining = await db.select().from(videoAvatars).where(eq(videoAvatars.userId, userId));
  console.log(`\n✅ Done! User ${userId} now has ${remaining.length} avatars:`);
  for (const avatar of remaining) {
    console.log(`  - ${avatar.avatarName}`);
  }
  
  process.exit(0);
}

fixUserVideoAvatars().catch(console.error);
