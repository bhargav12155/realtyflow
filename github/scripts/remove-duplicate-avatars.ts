import { db } from "../server/db";
import { videoAvatars } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function removeDuplicates() {
  // These are the GROUP IDs (incorrect), we want to keep only entries with AVATAR IDs
  const groupIdsToRemove = [
    '5eb60c4794714b0c8041c78c65452ebc', // group_id for bhargav avatar train night
    'fe569199df71493f830bea4f94d7b46c', // group_id for bhargav avatar train
  ];
  
  console.log("🔧 Removing duplicate avatar entries (group_ids)...");
  
  for (const groupId of groupIdsToRemove) {
    await db.delete(videoAvatars).where(
      and(
        eq(videoAvatars.userId, 2),
        eq(videoAvatars.heygenAvatarId, groupId)
      )
    );
    console.log(`✅ Deleted entry with group_id: ${groupId}`);
  }
  
  // Verify
  const remaining = await db.select().from(videoAvatars).where(eq(videoAvatars.userId, 2));
  console.log(`\n✅ Done! User 2 now has ${remaining.length} avatars:`);
  remaining.forEach((a, i) => {
    console.log(`  ${i+1}. ${a.avatarName} (ID: ${a.heygenAvatarId})`);
  });
  process.exit(0);
}

removeDuplicates().catch(console.error);
