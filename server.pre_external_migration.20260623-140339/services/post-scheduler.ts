import type { IStorage } from "../storage";
import { SocialMediaService, postToWhatsApp } from "./socialMedia";

export class PostScheduler {
  private storage: IStorage;
  private socialMediaService: SocialMediaService;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private supportedPlatforms = ["x", "twitter", "facebook", "linkedin", "tiktok", "instagram", "youtube", "whatsapp"];

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
          const approvedPosts = await this.storage.getScheduledPosts(
            user.id,
            "approved"
          );
          const allReady = [...scheduledPosts, ...approvedPosts];

          const duePosts = allReady.filter((post) => {
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
            status: "posted",
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
      } else if (platform === "facebook") {
        try {
          const accounts = await this.storage.getSocialMediaAccounts(userId);
          const fbAccount = accounts.find(a => a.platform.toLowerCase() === "facebook");

          if (!fbAccount) {
            await this.storage.updateScheduledPost(post.id, {
              status: "failed",
              metadata: {
                ...post.metadata,
                error: "No Facebook Page configured",
                failedAt: new Date().toISOString(),
              },
            });
            console.log(`❌ Post ${post.id} failed: No Facebook Page configured`);
            return;
          }

          const fbMetadata = (fbAccount as any).metadata || {};
          const pageId = fbMetadata.pageId || (fbAccount as any).accountId || process.env.FACEBOOK_PAGE_ID;

          if (!pageId) {
            await this.storage.updateScheduledPost(post.id, {
              status: "failed",
              metadata: {
                ...post.metadata,
                error: "No Facebook Page configured",
                failedAt: new Date().toISOString(),
              },
            });
            console.log(`❌ Post ${post.id} failed: No Facebook Page configured`);
            return;
          }

          const fbToken = fbMetadata.pageAccessToken || fbAccount.accessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_USER_TOKEN;

          const imageUrl = post.imageUrl || (post.metadata as any)?.imageUrl;

          const result = await this.socialMediaService.postToFacebookPage(pageId, post.content, imageUrl, fbToken);

          await this.storage.updateScheduledPost(post.id, {
            status: "posted",
            metadata: {
              ...post.metadata,
              publishedAt: new Date().toISOString(),
              platformPostId: result.postId,
            },
          });

          console.log(`✅ Successfully published post ${post.id} to Facebook`);
        } catch (error: any) {
          console.error(`❌ Failed to publish post ${post.id} to Facebook:`, error);

          await this.storage.updateScheduledPost(post.id, {
            status: "failed",
            metadata: {
              ...post.metadata,
              error: error.message,
              failedAt: new Date().toISOString(),
            },
          });
        }
      } else if (platform === "linkedin") {
        try {
          const accounts = await this.storage.getSocialMediaAccounts(userId);
          const liAccount = accounts.find(a => a.platform.toLowerCase() === "linkedin");

          if (!liAccount || !liAccount.accessToken) {
            await this.storage.updateScheduledPost(post.id, {
              status: "failed",
              metadata: {
                ...post.metadata,
                error: "No LinkedIn account connected",
                failedAt: new Date().toISOString(),
              },
            });
            console.log(`❌ Post ${post.id} failed: No LinkedIn account connected`);
            return;
          }

          const photoUrls = (post.imageUrl || (post.metadata as any)?.imageUrl) ? [post.imageUrl || (post.metadata as any)?.imageUrl] : undefined;

          const result = await this.socialMediaService.postToLinkedIn(post.content, liAccount.accessToken, { photoUrls });

          await this.storage.updateScheduledPost(post.id, {
            status: "posted",
            metadata: {
              ...post.metadata,
              publishedAt: new Date().toISOString(),
              platformPostId: result.postId,
            },
          });

          console.log(`✅ Successfully published post ${post.id} to LinkedIn`);
        } catch (error: any) {
          console.error(`❌ Failed to publish post ${post.id} to LinkedIn:`, error);

          await this.storage.updateScheduledPost(post.id, {
            status: "failed",
            metadata: {
              ...post.metadata,
              error: error.message,
              failedAt: new Date().toISOString(),
            },
          });
        }
      } else if (platform === "tiktok") {
        try {
          const videoUrl = post.imageUrl || (post.metadata as any)?.videoUrl || (post.metadata as any)?.imageUrl;

          if (!videoUrl) {
            await this.storage.updateScheduledPost(post.id, {
              status: "failed",
              metadata: {
                ...post.metadata,
                error: "TikTok requires a video - text-only posts cannot be published to TikTok",
                failedAt: new Date().toISOString(),
              },
            });
            console.log(`❌ Post ${post.id} failed: TikTok requires a video`);
            return;
          }

          const result = await this.socialMediaService.postToTikTok(userId, post.content, videoUrl);

          await this.storage.updateScheduledPost(post.id, {
            status: "posted",
            metadata: {
              ...post.metadata,
              publishedAt: new Date().toISOString(),
              platformPostId: result.publishId,
            },
          });

          console.log(`✅ Successfully published post ${post.id} to TikTok`);
        } catch (error: any) {
          console.error(`❌ Failed to publish post ${post.id} to TikTok:`, error);

          await this.storage.updateScheduledPost(post.id, {
            status: "failed",
            metadata: {
              ...post.metadata,
              error: error.message,
              failedAt: new Date().toISOString(),
            },
          });
        }
      } else if (platform === "instagram") {
        try {
          const accounts = await this.storage.getSocialMediaAccounts(userId);
          const igAccount = accounts.find(a => a.platform.toLowerCase() === "instagram");

          if (!igAccount || !igAccount.accessToken) {
            await this.storage.updateScheduledPost(post.id, {
              status: "failed",
              metadata: {
                ...post.metadata,
                error: "No Instagram Business Account connected",
                failedAt: new Date().toISOString(),
              },
            });
            console.log(`❌ Post ${post.id} failed: No Instagram account connected`);
            return;
          }

          const imageUrl = post.imageUrl || (post.metadata as any)?.imageUrl;
          if (!imageUrl) {
            await this.storage.updateScheduledPost(post.id, {
              status: "failed",
              metadata: {
                ...post.metadata,
                error: "Instagram requires an image or video - text-only posts are not supported",
                failedAt: new Date().toISOString(),
              },
            });
            console.log(`❌ Post ${post.id} failed: Instagram requires media`);
            return;
          }

          const igMetadata = (igAccount as any).metadata || {};
          const igUserId = igMetadata.igUserId || igMetadata.instagram_business_account_id;

          const result = await this.socialMediaService.postToInstagram(
            post.content,
            imageUrl,
            igAccount.accessToken,
            igUserId
          );

          await this.storage.updateScheduledPost(post.id, {
            status: "posted",
            metadata: {
              ...post.metadata,
              publishedAt: new Date().toISOString(),
              platformPostId: result.postId,
            },
          });

          console.log(`✅ Successfully published post ${post.id} to Instagram`);
        } catch (error: any) {
          console.error(`❌ Failed to publish post ${post.id} to Instagram:`, error);

          await this.storage.updateScheduledPost(post.id, {
            status: "failed",
            metadata: {
              ...post.metadata,
              error: error.message,
              failedAt: new Date().toISOString(),
            },
          });
        }
      } else if (platform === "youtube") {
        try {
          const accounts = await this.storage.getSocialMediaAccounts(userId);
          const ytAccount = accounts.find(a => a.platform.toLowerCase() === "youtube");

          if (!ytAccount || !ytAccount.accessToken) {
            await this.storage.updateScheduledPost(post.id, {
              status: "failed",
              metadata: {
                ...post.metadata,
                error: "No YouTube account connected",
                failedAt: new Date().toISOString(),
              },
            });
            console.log(`❌ Post ${post.id} failed: No YouTube account connected`);
            return;
          }

          const videoUrl = post.imageUrl || (post.metadata as any)?.videoUrl || (post.metadata as any)?.imageUrl;
          const title = (post.metadata as any)?.title || post.content.substring(0, 100);
          const description = post.content;

          const result = await this.socialMediaService.postToYoutube(
            title,
            description,
            videoUrl,
            ytAccount.accessToken
          );

          await this.storage.updateScheduledPost(post.id, {
            status: "posted",
            metadata: {
              ...post.metadata,
              publishedAt: new Date().toISOString(),
              platformPostId: result.postId,
              watchUrl: result.watchUrl,
            },
          });

          console.log(`✅ Successfully published post ${post.id} to YouTube`);
        } catch (error: any) {
          console.error(`❌ Failed to publish post ${post.id} to YouTube:`, error);

          await this.storage.updateScheduledPost(post.id, {
            status: "failed",
            metadata: {
              ...post.metadata,
              error: error.message,
              failedAt: new Date().toISOString(),
            },
          });
        }
      } else if (platform === "whatsapp") {
        try {
          const recipientPhone = (post.metadata as any)?.recipientPhone;

          if (!recipientPhone) {
            await this.storage.updateScheduledPost(post.id, {
              status: "failed",
              metadata: {
                ...post.metadata,
                error: "No recipient phone number specified for WhatsApp message",
                failedAt: new Date().toISOString(),
              },
            });
            console.log(`❌ Post ${post.id} failed: No WhatsApp recipient`);
            return;
          }

          const whatsappSettings = (post.metadata as any)?.whatsappSettings || {};
          const result = await postToWhatsApp(
            post.content,
            recipientPhone,
            whatsappSettings.phoneNumberId,
            whatsappSettings.accessToken
          );

          if (result.success) {
            await this.storage.updateScheduledPost(post.id, {
              status: "posted",
              metadata: {
                ...post.metadata,
                publishedAt: new Date().toISOString(),
                platformPostId: result.messageId,
              },
            });
            console.log(`✅ Successfully published post ${post.id} to WhatsApp`);
          } else {
            await this.storage.updateScheduledPost(post.id, {
              status: "failed",
              metadata: {
                ...post.metadata,
                error: result.error || "WhatsApp send failed",
                failedAt: new Date().toISOString(),
              },
            });
            console.log(`❌ Post ${post.id} failed: ${result.error}`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to publish post ${post.id} to WhatsApp:`, error);

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
