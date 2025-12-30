/**
 * Automatic Post Scheduler
 * Checks for pending scheduled posts and publishes them automatically
 */

import cron from 'node-cron';
import { storage } from './storage';
import { SocialMediaService } from './services/socialMedia';

const socialMediaService = new SocialMediaService();

/**
 * Check for posts that need to be published
 * Runs every 5 minutes
 */
export function initializePostScheduler() {
  const enabled = process.env.AUTO_POST_ENABLED !== 'false'; // Enabled by default
  
  if (!enabled) {
    console.log('📅 Auto-posting scheduler DISABLED');
    return;
  }

  console.log('📅 Auto-posting scheduler ENABLED');
  console.log('🔄 Checking for pending posts every 5 minutes');

  // Run every 5 minutes: "*/5 * * * *"
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('\n⏰ Checking for posts to publish...');
      await checkAndPublishPosts();
    } catch (error) {
      console.error('❌ Post scheduler error:', error);
    }
  });

  // Also run immediately on startup
  setTimeout(async () => {
    console.log('🚀 Running initial post check...');
    await checkAndPublishPosts();
  }, 5000);
}

async function checkAndPublishPosts() {
  try {
    const now = new Date();
    
    // Get all users (in production, you'd query all users from DB)
    // For now, we'll check the demo user
    const users = await getAllUsers();
    
    let totalPublished = 0;

    for (const user of users) {
      // Get pending posts for this user
      const pendingPosts = await storage.getScheduledPosts(user.id, 'pending');
      
      // Filter posts that are due to be published
      const dueNow = pendingPosts.filter(post => {
        const scheduledTime = new Date(post.scheduledFor);
        return scheduledTime <= now;
      });

      if (dueNow.length === 0) continue;

      console.log(`📤 Publishing ${dueNow.length} posts for user ${user.username}`);

      for (const post of dueNow) {
        try {
          // Get social media accounts for this user
          const accounts = await storage.getSocialMediaAccounts(user.id);
          const account = accounts.find(acc => 
            acc.platform === post.platform && acc.isConnected
          );

          if (!account) {
            console.warn(`⚠️  No connected account for ${post.platform}, skipping post ${post.id}`);
            await storage.updateScheduledPost(post.id, {
              status: 'failed',
              metadata: {
                ...post.metadata,
                error: `No connected ${post.platform} account`
              }
            });
            continue;
          }

          // Publish the post
          const result = await publishPost(post, account);

          if (result.success) {
            // Update post status to 'posted'
            await storage.updateScheduledPost(post.id, {
              status: 'posted',
              metadata: {
                ...post.metadata,
                publishedAt: new Date().toISOString(),
                externalPostId: result.postId
              }
            });
            
            console.log(`✅ Published post ${post.id} to ${post.platform}`);
            totalPublished++;
          } else {
            throw new Error(result.error || 'Unknown error');
          }

        } catch (error: any) {
          console.error(`❌ Failed to publish post ${post.id}:`, error.message);
          
          // Update post status to 'failed'
          await storage.updateScheduledPost(post.id, {
            status: 'failed',
            metadata: {
              ...post.metadata,
              error: error.message,
              attemptedAt: new Date().toISOString()
            }
          });
        }
      }
    }

    if (totalPublished > 0) {
      console.log(`✅ Successfully published ${totalPublished} posts`);
    }

  } catch (error) {
    console.error('❌ Error checking scheduled posts:', error);
  }
}

async function publishPost(post: any, account: any): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const content = post.content;
    const imageUrl = post.metadata?.imageUrl || null;

    switch (post.platform) {
      case 'facebook':
        // Get Facebook pages
        const pages = await socialMediaService.getFacebookPageInfo(account.accessToken);
        if (!pages || pages.length === 0) {
          throw new Error('No Facebook pages found');
        }
        
        const result = await socialMediaService.postToFacebookPage(
          pages[0].id,
          content,
          imageUrl,
          account.accessToken
        );
        
        return { success: true, postId: result.postId };

      case 'instagram':
        // Instagram posting would go here
        // Note: Instagram requires special handling (photo/video required)
        throw new Error('Instagram auto-posting not yet implemented');

      case 'linkedin':
        // LinkedIn posting would go here
        throw new Error('LinkedIn auto-posting not yet implemented');

      case 'x':
        // X (Twitter) posting would go here
        throw new Error('X auto-posting not yet implemented');

      default:
        throw new Error(`Unknown platform: ${post.platform}`);
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function getAllUsers(): Promise<Array<{ id: string; username: string }>> {
  // In production, query all users from database
  // For now, return demo user
  try {
    const demoUser = await storage.getUserByUsername('mikebjork');
    if (demoUser) {
      return [{ id: demoUser.id, username: demoUser.username }];
    }
  } catch (error) {
    console.error('Error getting users:', error);
  }
  return [];
}
