import { HeyGenPhotoAvatarService } from '../server/services/heygen-photo-avatar';

async function deleteRecentAvatars() {
  const service = new HeyGenPhotoAvatarService();
  
  console.log("Fetching HeyGen avatar groups...");
  const response = await service.listAvatarGroups();
  const groups = response.avatar_group_list || [];
  
  const now = Date.now();
  const oneDayAgoMs = now - (24 * 60 * 60 * 1000);
  const oneDayAgoSec = Math.floor(oneDayAgoMs / 1000);
  
  console.log(`Found ${groups.length} total avatar groups`);
  console.log(`Current time: ${now} ms (${Math.floor(now/1000)} sec)`);
  console.log(`Looking for groups created after ${oneDayAgoSec} seconds`);
  
  let deletedCount = 0;
  
  for (const group of groups) {
    const createdAt = group.created_at; // Already in seconds
    console.log(`\nGroup: ${group.name} (${group.id})`);
    console.log(`  Created: ${createdAt} (${new Date(createdAt * 1000).toISOString()})`);
    console.log(`  Status: ${group.status || group.train_status}`);
    
    if (createdAt > oneDayAgoSec) {
      console.log(`  -> DELETING (created in last 24 hours)`);
      try {
        await service.deleteAvatarGroup(group.id);
        console.log(`  -> DELETED successfully`);
        deletedCount++;
      } catch (error: any) {
        console.error(`  -> FAILED to delete: ${error.message}`);
      }
    } else {
      console.log(`  -> Skipping (older than 24 hours)`);
    }
  }
  
  console.log(`\nDone! Deleted ${deletedCount} avatar groups.`);
}

deleteRecentAvatars().catch(console.error);
