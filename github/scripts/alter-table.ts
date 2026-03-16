import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function alterTable() {
  try {
    // Make training_video_url nullable
    await db.execute(sql`ALTER TABLE video_avatars ALTER COLUMN training_video_url DROP NOT NULL`);
    console.log('Made training_video_url nullable');
    
    // Make consent_video_url nullable
    await db.execute(sql`ALTER TABLE video_avatars ALTER COLUMN consent_video_url DROP NOT NULL`);
    console.log('Made consent_video_url nullable');
    
    console.log('Done!');
  } catch (e: any) {
    // Ignore if already nullable
    if (e.message?.includes('already')) {
      console.log('Columns already nullable');
    } else {
      console.error(e);
    }
  }
  process.exit(0);
}
alterTable();
