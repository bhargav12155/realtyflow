import { db } from '../server/db.js';
import { videoAvatars } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function fixAvatars() {
  // Delete all synced avatars for user 2
  const deleted = await db.delete(videoAvatars).where(eq(videoAvatars.userId, 2)).returning();
  console.log('Deleted', deleted.length, 'avatars');

  // Add only the 2 actual video avatars the user uploaded
  const myAvatars = [
    {
      userId: 2,
      heygenAvatarId: '5eb60c4794714b0c8041c78c65452ebc',
      avatarName: 'bhargav avatar train night',
      status: 'completed',
      thumbnailUrl: 'https://resource2.heygen.ai/instant_avatar/url/thumbnail_b8c1b7103cfc4e8cb8da51e63ff55fb7.jpeg',
      createdAt: new Date(1769306207 * 1000),
      avatarType: 'video_avatar'
    },
    {
      userId: 2,
      heygenAvatarId: 'fe569199df71493f830bea4f94d7b46c',
      avatarName: 'bhargav avatar train',
      status: 'completed',
      thumbnailUrl: 'https://resource2.heygen.ai/instant_avatar/url/thumbnail_f7a88eebd0e3490388622dba59670d41.jpeg',
      createdAt: new Date(1769292902 * 1000),
      avatarType: 'video_avatar'
    }
  ];

  for (const avatar of myAvatars) {
    await db.insert(videoAvatars).values(avatar).onConflictDoNothing();
    console.log('Added:', avatar.name);
  }

  // Verify
  const final = await db.select().from(videoAvatars).where(eq(videoAvatars.userId, 2));
  console.log('\nFinal avatars for user 2:', final.length);
  final.forEach(a => console.log('  -', a.avatarName, '|', a.heygenAvatarId));
  
  process.exit(0);
}

fixAvatars();
