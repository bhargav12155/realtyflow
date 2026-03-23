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
    
    const settings = await this.storage.getWhatsappSettingsByUserId(queue.userId);
    if (!settings) {
      console.error(`📱 Bulk queue ${queue.id}: No WhatsApp settings for user ${queue.userId}`);
      return;
    }

    const accounts = (settings.accounts as Array<{ label: string; phoneNumberId: string; wabaId: string; accessToken?: string }>) || [];
    const activeAccount = accounts.find(a => a.phoneNumberId === settings.phoneNumberId);
    const accessToken = activeAccount?.accessToken?.trim() || settings.accessToken?.trim();
    const phoneNumberId = settings.phoneNumberId;

    if (!accessToken) {
      console.error(`📱 Bulk queue ${queue.id}: No access token in user's WhatsApp settings`);
      return;
    }

    let dailyLimit = queue.dailyLimit || 250;
    try {
      const limitUrl = `https://graph.facebook.com/v25.0/${phoneNumberId}?fields=whatsapp_business_manager_messaging_limit&access_token=${accessToken}`;
      const limitRes = await fetch(limitUrl);
      const limitData = (await limitRes.json()) as any;
      if (limitData.whatsapp_business_manager_messaging_limit) {
        const tierMap: Record<string, number> = {
          TIER_NOT_SET: 250, TIER_250: 250, TIER_2K: 2000,
          TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: 999999,
        };
        dailyLimit = tierMap[limitData.whatsapp_business_manager_messaging_limit] || 250;
      }
    } catch (e) {
      console.log(`⚠️ Could not fetch tier for queue ${queue.id}, using ${dailyLimit}`);
    }

    const allRemaining = [...queue.remainingNumbers];

    let resolvedLang = "en_US";
    if (queue.templateName) {
      try {
        const wabId = settings?.wabaId || "2690438238000842";
        const tplRes = await fetch(`https://graph.facebook.com/v25.0/${wabId}/message_templates?fields=name,category,language&limit=100`, {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        const tplData = (await tplRes.json()) as any;
        const tpl = (tplData.data || []).find((t: any) => t.name === queue.templateName);
        if (tpl?.language) {
          resolvedLang = tpl.language;
          console.log(`📱 Queue ${queue.id}: Auto-detected language "${resolvedLang}" for template "${queue.templateName}"`);
        }
        if (tpl && (tpl.category || "").toUpperCase() === "MARKETING") {
          const usCount = allRemaining.filter((n: string) => n.startsWith("+1") || n.startsWith("1")).length;
          if (usCount > 0) {
            console.warn(`⚠️ Bulk queue ${queue.id}: Template "${queue.templateName}" is MARKETING category. ${usCount} US numbers will likely NOT be delivered due to Meta's US marketing pause (since April 2025). Consider using a UTILITY template instead.`);
          }
        }
      } catch (e) {
        // non-critical, continue
      }
    }

    console.log(`📱 Bulk queue ${queue.id}: Starting batch targeting ${dailyLimit} successful deliveries from ${allRemaining.length} remaining`);

    this.notifyUser(queue.userId, {
      type: "whatsapp_queue_batch_start",
      data: {
        queueId: queue.id,
        batchSize: Math.min(dailyLimit, allRemaining.length),
        remaining: allRemaining.length,
        message: `Starting batch: targeting ${Math.min(dailyLimit, allRemaining.length)} successful deliveries`,
      },
    });

    let sentCount = 0;
    let attemptedCount = 0;
    const ecosystemBlockedNumbers: string[] = [];
    const permanentlyFailedNumbers: string[] = [];
    const unattemptedNumbers: string[] = [];
    const newlySentNumbers: string[] = [];
    const quotaBlockedNumbers: string[] = [];
    const BATCH_SIZE = 8;
    const BATCH_DELAY_MS = 2000;
    const INTRA_BATCH_DELAY_MS = 150;
    const RATE_LIMIT_BACKOFF_MS = 30000;
    const MAX_ECOSYSTEM_RATIO = 0.5;

    const isRetryableError = (errMsg: string) =>
      errMsg.includes("130429") || errMsg.includes("429") || errMsg.includes("503") ||
      errMsg.includes("131057") || errMsg.includes("131016") || errMsg.includes("133004") ||
      errMsg.includes("80007") || errMsg.includes("2494100") ||
      errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("throttl") ||
      errMsg.toLowerCase().includes("temporarily") || errMsg.toLowerCase().includes("maintenance");

    const isEcosystemBlock = (errMsg: string) =>
      errMsg.includes("131049") || errMsg.includes("131056") || errMsg.includes("130472");

    const isPermanentBlock = (errMsg: string) =>
      errMsg.includes("131050") || errMsg.includes("131026") || errMsg.includes("131031") ||
      errMsg.includes("368") || errMsg.includes("130497") || errMsg.includes("131021") ||
      errMsg.includes("132001") || errMsg.includes("132015") || errMsg.includes("132016");

    const isTemplatePausedError = (errMsg: string) =>
      errMsg.includes("132015") || errMsg.includes("132016") || errMsg.includes("132001");

    const sendOneWithRetry = async (phone: string, attempt = 1): Promise<{ success: boolean; phone: string; errorType?: string }> => {
      try {
        if (queue.templateName) {
          await whatsappService.sendTemplateMessage(phoneNumberId, accessToken, phone, queue.templateName, resolvedLang);
        } else if (queue.messageText) {
          await whatsappService.sendTextMessage(phoneNumberId, accessToken, phone, queue.messageText);
        }
        return { success: true, phone };
      } catch (err: any) {
        const errMsg = err.message || "";
        if (errMsg.includes("130429") || errMsg.includes("131048") ||
            errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("spam rate limit")) {
          return { success: false, phone, errorType: "quota" };
        }
        if (isEcosystemBlock(errMsg)) {
          return { success: false, phone, errorType: "ecosystem" };
        }
        if (isTemplatePausedError(errMsg)) {
          console.warn(`📱 Queue ${queue.id}: Template paused/rejected for ${phone}: ${errMsg.substring(0, 100)}`);
          return { success: false, phone, errorType: "template_paused" };
        }
        if (isPermanentBlock(errMsg)) {
          console.warn(`📱 Queue ${queue.id}: Permanent block for ${phone}: ${errMsg.substring(0, 100)}`);
          return { success: false, phone, errorType: "permanent" };
        }
        if (isRetryableError(errMsg) && attempt <= 2) {
          const backoff = RATE_LIMIT_BACKOFF_MS * attempt;
          console.warn(`📱 Queue ${queue.id}: Rate error for ${phone} (attempt ${attempt}), backoff ${backoff / 1000}s`);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          return sendOneWithRetry(phone, attempt + 1);
        }
        return { success: false, phone, errorType: "permanent" };
      }
    };

    let numberIndex = 0;
    let stopped = false;
    let quotaLimitReached = false;
    let consecutiveQuotaErrors = 0;
    let consecutiveTemplatePaused = 0;

    const isQuotaLimitError = (errMsg: string) =>
      errMsg.includes("130429") || errMsg.includes("131048") ||
      errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("spam rate limit");

    while (numberIndex < allRemaining.length && !stopped && !quotaLimitReached) {
      const currentQueue = await this.storage.getWhatsappBulkQueueById(queue.id);
      if (!currentQueue || currentQueue.status !== "active") {
        console.log(`📱 Bulk queue ${queue.id}: Status changed to ${currentQueue?.status}, stopping`);
        for (let j = numberIndex; j < allRemaining.length; j++) {
          unattemptedNumbers.push(allRemaining[j]);
        }
        stopped = true;
        break;
      }

      if (attemptedCount > 0 && ecosystemBlockedNumbers.length / attemptedCount > MAX_ECOSYSTEM_RATIO && ecosystemBlockedNumbers.length > 50) {
        console.warn(`📱 Queue ${queue.id}: Too many ecosystem blocks (${ecosystemBlockedNumbers.length}/${attemptedCount}), stopping to avoid further penalties`);
        for (let j = numberIndex; j < allRemaining.length; j++) {
          unattemptedNumbers.push(allRemaining[j]);
        }
        break;
      }

      const batchEnd = Math.min(numberIndex + BATCH_SIZE, allRemaining.length);
      const batch = allRemaining.slice(numberIndex, batchEnd);
      numberIndex = batchEnd;

      const results = await Promise.allSettled(
        batch.map(async (phone: string, idx: number) => {
          if (idx > 0) {
            await new Promise((resolve) => setTimeout(resolve, idx * INTRA_BATCH_DELAY_MS));
          }
          return sendOneWithRetry(phone);
        })
      );

      let batchQuotaHits = 0;
      for (const r of results) {
        attemptedCount++;
        if (r.status === "fulfilled") {
          const res = r.value;
          if (res.success) {
            sentCount++;
            newlySentNumbers.push(res.phone);
            consecutiveQuotaErrors = 0;
          } else if (res.errorType === "quota") {
            batchQuotaHits++;
            consecutiveQuotaErrors++;
            quotaBlockedNumbers.push(res.phone);
          } else if (res.errorType === "ecosystem") {
            ecosystemBlockedNumbers.push(res.phone);
          } else if (res.errorType === "template_paused") {
            ecosystemBlockedNumbers.push(res.phone);
          } else {
            permanentlyFailedNumbers.push(res.phone);
          }
        } else {
          permanentlyFailedNumbers.push("unknown");
        }
      }

      let batchTemplatePaused = 0;
      for (const r of results) {
        if (r.status === "fulfilled" && !r.value.success && r.value.errorType === "template_paused") {
          batchTemplatePaused++;
        }
      }
      if (batchTemplatePaused >= Math.ceil(batch.length * 0.5) && batch.length >= 2) {
        consecutiveTemplatePaused += batchTemplatePaused;
      } else {
        consecutiveTemplatePaused = 0;
      }

      if (consecutiveTemplatePaused >= 5) {
        console.warn(`📱 Queue ${queue.id}: Template appears paused/rejected — auto-pausing queue to prevent further failures`);
        await this.storage.updateWhatsappBulkQueue(queue.id, { status: "paused" });
        for (let j = numberIndex; j < allRemaining.length; j++) {
          unattemptedNumbers.push(allRemaining[j]);
        }
        stopped = true;
        this.notifyUser(queue.userId, {
          type: "whatsapp_queue_paused",
          data: {
            queueId: queue.id,
            reason: "Template paused by Meta due to low quality. Queue auto-paused to prevent further failures. Please use a different template.",
          },
        });
        break;
      }

      if (batchQuotaHits >= Math.ceil(batch.length * 0.5) || consecutiveQuotaErrors >= 10) {
        quotaLimitReached = true;
        console.log(`📱 Queue ${queue.id}: Quota limit reached after ${sentCount} sent. Queuing remaining.`);
        for (let j = numberIndex; j < allRemaining.length; j++) {
          unattemptedNumbers.push(allRemaining[j]);
        }
      }

      const totalProcessed = sentCount + ecosystemBlockedNumbers.length + permanentlyFailedNumbers.length;
      const percent = allRemaining.length > 0 ? Math.round((totalProcessed / allRemaining.length) * 100) : 0;

      this.notifyUser(queue.userId, {
        type: "whatsapp_queue_progress",
        data: {
          queueId: queue.id,
          sent: (queue.sentCount || 0) + sentCount,
          failed: (queue.failedCount || 0) + permanentlyFailedNumbers.length,
          total: queue.totalNumbers,
          batchSent: sentCount,
          attempted: attemptedCount,
          remaining: allRemaining.length - numberIndex + ecosystemBlockedNumbers.length,
          percent,
          ecosystemBlocked: ecosystemBlockedNumbers.length,
          quotaLimitReached,
          message: quotaLimitReached
            ? `Quota limit reached: ${sentCount} sent, ${(allRemaining.length - numberIndex).toLocaleString()} remaining queued for next batch`
            : `Queue batch: ${sentCount} delivered of ${attemptedCount} attempted (${ecosystemBlockedNumbers.length} ecosystem-blocked, re-queued)`,
        },
      });

      if (!quotaLimitReached && numberIndex < allRemaining.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    for (let j = numberIndex; j < allRemaining.length; j++) {
      if (!unattemptedNumbers.includes(allRemaining[j])) {
        unattemptedNumbers.push(allRemaining[j]);
      }
    }

    const finalRemaining = [...quotaBlockedNumbers, ...unattemptedNumbers, ...ecosystemBlockedNumbers];

    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);

    const newSentCount = (queue.sentCount || 0) + sentCount;
    const newFailedCount = (queue.failedCount || 0) + permanentlyFailedNumbers.length;
    const isComplete = finalRemaining.length === 0;

    const existingSentNumbers = (queue.sentNumbers || []) as string[];
    const existingFailedNumbers = (queue.failedNumbers || []) as string[];

    const currentDbQueue = await this.storage.getWhatsappBulkQueueById(queue.id);
    const currentDbStatus = currentDbQueue?.status || "active";
    const finalStatus = currentDbStatus === "paused" || currentDbStatus === "cancelled"
      ? currentDbStatus
      : isComplete ? "completed" : "active";

    await this.storage.updateWhatsappBulkQueue(queue.id, {
      sentCount: newSentCount,
      failedCount: newFailedCount,
      remainingNumbers: finalRemaining,
      sentNumbers: [...existingSentNumbers, ...newlySentNumbers],
      failedNumbers: [...existingFailedNumbers, ...permanentlyFailedNumbers],
      lastBatchSentAt: new Date(),
      nextBatchAt: isComplete ? null : tomorrow,
      status: finalStatus,
    });

    const eventType = isComplete ? "whatsapp_queue_complete" : "whatsapp_queue_batch_complete";
    this.notifyUser(queue.userId, {
      type: eventType,
      data: {
        queueId: queue.id,
        sent: newSentCount,
        failed: newFailedCount,
        total: queue.totalNumbers,
        remaining: finalRemaining.length,
        ecosystemBlocked: ecosystemBlockedNumbers.length,
        permanentlyFailed: permanentlyFailedNumbers.length,
        nextBatchAt: isComplete ? null : tomorrow.toISOString(),
        message: isComplete
          ? `Queue complete: ${newSentCount} delivered, ${newFailedCount} failed out of ${queue.totalNumbers}`
          : `Batch done: ${sentCount} sent, ${ecosystemBlockedNumbers.length} ecosystem-blocked (re-queued), ${permanentlyFailedNumbers.length} permanently failed. ${finalRemaining.length} remaining, next batch at ${tomorrow.toLocaleString()}`,
      },
    });

    console.log(`📱 Bulk queue ${queue.id}: Batch done - ${sentCount} sent, ${ecosystemBlockedNumbers.length} ecosystem-blocked (re-queued), ${permanentlyFailedNumbers.length} permanently failed. ${finalRemaining.length} remaining.`);
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
