import type { IStorage } from "../storage";
import { SocialMediaService } from "./socialMedia";

export class PostScheduler {
  private storage: IStorage;
  private socialMediaService: SocialMediaService;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private supportedPlatforms = ["x", "twitter"];

  constructor(storage: IStorage, socialMediaService: SocialMediaService) {
    this.storage = storage;
    this.socialMediaService = socialMediaService;
  }

  start() {
    if (this.intervalId) {
      console.log("⏰ Post scheduler is already running");
      return;
    }

    console.log("✅ Starting automatic post scheduler - checking every minute");
    
    this.intervalId = setInterval(() => {
      this.processScheduledPosts();
    }, 60000);

    this.processScheduledPosts();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("🛑 Post scheduler stopped");
    }
  }

  private async processScheduledPosts() {
    if (this.isProcessing) {
      console.log("⏸️ Scheduler already processing, skipping this check");
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();
      console.log(`⏰ Checking for scheduled posts due at ${now.toISOString()}`);

      const allUsers = await this.storage.getAllUsers();

      for (const user of allUsers) {
        try {
          const scheduledPosts = await this.storage.getScheduledPosts(
            user.id,
            "scheduled"
          );

          const duePosts = scheduledPosts.filter((post) => {
            if (!post.scheduledFor) return false;
            const scheduledTime = new Date(post.scheduledFor);
            const isPastDue = scheduledTime <= now;
            const isPlatformSupported = this.supportedPlatforms.includes(
              post.platform.toLowerCase()
            );
            return isPastDue && isPlatformSupported;
          });

          if (duePosts.length > 0) {
            console.log(
              `📋 Found ${duePosts.length} posts due for user ${user.id}`
            );
          }

          for (const post of duePosts) {
            await this.publishPost(post, user.id);
          }
        } catch (error) {
          console.error(`❌ Error processing posts for user ${user.id}:`, error);
        }
      }
    } catch (error) {
      console.error("❌ Error in post scheduler:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async publishPost(post: any, userId: string) {
    try {
      console.log(
        `📤 Publishing post ${post.id} to ${post.platform} for user ${userId}`
      );

      const platform = post.platform.toLowerCase();

      if (platform === "x" || platform === "twitter") {
        try {
          const result = await this.socialMediaService.postToTwitter(
            userId,
            post.content,
            post.imageUrl
          );

          await this.storage.updateScheduledPost(post.id, {
            status: "published",
            metadata: {
              ...post.metadata,
              publishedAt: new Date().toISOString(),
              platformPostId: result.postId,
            },
          });

          console.log(`✅ Successfully published post ${post.id} to Twitter`);
        } catch (error: any) {
          console.error(`❌ Failed to publish post ${post.id} to Twitter:`, error);
          
          await this.storage.updateScheduledPost(post.id, {
            status: "failed",
            metadata: {
              ...post.metadata,
              error: error.message,
              failedAt: new Date().toISOString(),
            },
          });
        }
      } else {
        console.log(`⚠️ Platform ${platform} posting not yet supported, skipping post ${post.id}`);
      }
    } catch (error) {
      console.error(`❌ Error publishing post ${post.id}:`, error);
    }
  }

  async manualPublish(postId: string, userId: string): Promise<boolean> {
    try {
      const posts = await this.storage.getScheduledPosts(userId);
      const post = posts.find((p) => p.id === postId);

      if (!post) {
        throw new Error("Post not found");
      }

      await this.publishPost(post, userId);
      return true;
    } catch (error) {
      console.error(`❌ Manual publish failed for post ${postId}:`, error);
      throw error;
    }
  }
}
