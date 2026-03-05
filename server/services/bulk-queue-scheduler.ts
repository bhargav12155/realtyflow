import type { IStorage } from "../storage";
import { WhatsAppService } from "./whatsapp";

export class BulkQueueScheduler {
  private storage: IStorage;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private realtimeService: any;

  constructor(storage: IStorage, realtimeService: any) {
    this.storage = storage;
    this.realtimeService = realtimeService;
  }

  start() {
    if (this.intervalId) {
      console.log("📱 Bulk queue scheduler is already running");
      return;
    }

    console.log("✅ Starting WhatsApp bulk queue scheduler - checking every 60 seconds");

    this.intervalId = setInterval(() => {
      this.processQueues();
    }, 60000);

    this.processQueues();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("🛑 Bulk queue scheduler stopped");
    }
  }

  async processQueues() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const activeQueues = await this.storage.getActiveWhatsappBulkQueues();
      if (activeQueues.length === 0) {
        this.isProcessing = false;
        return;
      }

      const now = new Date();

      for (const queue of activeQueues) {
        if (queue.nextBatchAt && new Date(queue.nextBatchAt) > now) {
          continue;
        }

        if (!queue.remainingNumbers || queue.remainingNumbers.length === 0) {
          await this.storage.updateWhatsappBulkQueue(queue.id, { status: "completed" });
          this.notifyUser(queue.userId, {
            type: "whatsapp_queue_complete",
            data: {
              queueId: queue.id,
              sent: queue.sentCount,
              failed: queue.failedCount,
              total: queue.totalNumbers,
              message: `Bulk queue complete: ${queue.sentCount} sent, ${queue.failedCount} failed out of ${queue.totalNumbers} total.`,
            },
          });
          continue;
        }

        await this.processSingleQueue(queue);
      }
    } catch (error) {
      console.error("Bulk queue scheduler error:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSingleQueue(queue: any) {
    const whatsappService = new WhatsAppService();
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1009337698927791";

    if (!accessToken) {
      console.error(`📱 Bulk queue ${queue.id}: No WHATSAPP_ACCESS_TOKEN`);
      return;
    }

    let dailyLimit = queue.dailyLimit || 2000;
    try {
      const limitUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=messaging_limit_tier&access_token=${accessToken}`;
      const limitRes = await fetch(limitUrl);
      const limitData = (await limitRes.json()) as any;
      if (limitData.messaging_limit_tier) {
        const tierMap: Record<string, number> = {
          TIER_NOT_SET: 250, TIER_50: 50, TIER_250: 250,
          TIER_1K: 2000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: 999999,
        };
        dailyLimit = tierMap[limitData.messaging_limit_tier] || 2000;
      }
    } catch (e) {
      console.log(`⚠️ Could not fetch tier for queue ${queue.id}, using ${dailyLimit}`);
    }

    const numbersToSend = queue.remainingNumbers.slice(0, dailyLimit);
    const leftover = queue.remainingNumbers.slice(dailyLimit);

    console.log(`📱 Bulk queue ${queue.id}: Sending batch of ${numbersToSend.length} (${leftover.length} remaining after this batch)`);

    this.notifyUser(queue.userId, {
      type: "whatsapp_queue_batch_start",
      data: {
        queueId: queue.id,
        batchSize: numbersToSend.length,
        remaining: leftover.length,
        message: `Starting batch: ${numbersToSend.length} messages (${leftover.length} still queued)`,
      },
    });

    let sentCount = 0;
    let failedCount = 0;
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 2000;
    const RATE_LIMIT_BACKOFF_MS = 30000;

    for (let i = 0; i < numbersToSend.length; i += BATCH_SIZE) {
      const currentQueue = await this.storage.getWhatsappBulkQueueById(queue.id);
      if (!currentQueue || currentQueue.status !== "active") {
        console.log(`📱 Bulk queue ${queue.id}: Status changed to ${currentQueue?.status}, stopping`);
        break;
      }

      const batch = numbersToSend.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (phone: string) => {
          try {
            if (queue.templateName) {
              await whatsappService.sendTemplateMessage(phoneNumberId, accessToken, phone, queue.templateName);
            } else if (queue.messageText) {
              await whatsappService.sendTextMessage(phoneNumberId, accessToken, phone, queue.messageText);
            }
            return true;
          } catch (err: any) {
            const errMsg = err.message || "";
            if (errMsg.includes("130429") || errMsg.toLowerCase().includes("rate limit")) {
              await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_BACKOFF_MS));
              try {
                if (queue.templateName) {
                  await whatsappService.sendTemplateMessage(phoneNumberId, accessToken, phone, queue.templateName);
                } else if (queue.messageText) {
                  await whatsappService.sendTextMessage(phoneNumberId, accessToken, phone, queue.messageText);
                }
                return true;
              } catch {
                throw err;
              }
            }
            throw err;
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") sentCount++;
        else failedCount++;
      }

      const processed = sentCount + failedCount;
      const percent = Math.round((processed / numbersToSend.length) * 100);

      this.notifyUser(queue.userId, {
        type: "whatsapp_queue_progress",
        data: {
          queueId: queue.id,
          sent: (queue.sentCount || 0) + sentCount,
          failed: (queue.failedCount || 0) + failedCount,
          total: queue.totalNumbers,
          batchSent: sentCount,
          batchTotal: numbersToSend.length,
          remaining: leftover.length,
          percent,
          message: `Queue batch: ${sentCount} of ${numbersToSend.length} sent (${percent}%)`,
        },
      });

      if (i + BATCH_SIZE < numbersToSend.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);

    const newSentCount = (queue.sentCount || 0) + sentCount;
    const newFailedCount = (queue.failedCount || 0) + failedCount;
    const isComplete = leftover.length === 0;

    await this.storage.updateWhatsappBulkQueue(queue.id, {
      sentCount: newSentCount,
      failedCount: newFailedCount,
      remainingNumbers: leftover,
      lastBatchSentAt: new Date(),
      nextBatchAt: isComplete ? null : tomorrow,
      status: isComplete ? "completed" : "active",
    });

    const eventType = isComplete ? "whatsapp_queue_complete" : "whatsapp_queue_batch_complete";
    this.notifyUser(queue.userId, {
      type: eventType,
      data: {
        queueId: queue.id,
        sent: newSentCount,
        failed: newFailedCount,
        total: queue.totalNumbers,
        remaining: leftover.length,
        nextBatchAt: isComplete ? null : tomorrow.toISOString(),
        message: isComplete
          ? `Queue complete: ${newSentCount} delivered, ${newFailedCount} failed out of ${queue.totalNumbers}`
          : `Batch done: ${sentCount} sent this batch. ${leftover.length} remaining, next batch at ${tomorrow.toLocaleString()}`,
      },
    });

    console.log(`📱 Bulk queue ${queue.id}: Batch done - ${sentCount} sent, ${failedCount} failed. ${leftover.length} remaining.`);
  }

  private notifyUser(userId: string, payload: any) {
    try {
      if (this.realtimeService?.sendToUser) {
        this.realtimeService.sendToUser(userId, {
          ...payload,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("Failed to notify user:", e);
    }
  }
}
