import type { IStorage } from "../storage";

export class InsufficientCreditsError extends Error {
  readonly required: number;
  readonly balance: number;

  constructor(required: number, balance: number) {
    super(`Insufficient credits: required=${required}, balance=${balance}`);
    this.name = "InsufficientCreditsError";
    this.required = required;
    this.balance = balance;
  }
}

export type CreditChargeInput = {
  userId: string;
  provider: string;
  feature: string;
  credits: number;
  requestId: string;
  metadata?: Record<string, unknown> | null;
};

export async function chargeCredits(
  storage: IStorage,
  input: CreditChargeInput,
): Promise<{ balance: number }> {
  const normalized = Math.max(0, Math.trunc(input.credits));
  const debit = await storage.debitWalletCredits(
    input.userId,
    normalized,
    `${input.provider}:${input.feature}`,
    {
      requestId: input.requestId,
      metadata: input.metadata ?? null,
    },
  );

  if (!debit.success) {
    await storage.recordAiUsageEvent({
      userId: input.userId,
      provider: input.provider,
      feature: input.feature,
      status: "blocked",
      estimatedCredits: normalized,
      actualCredits: 0,
      requestId: input.requestId,
      metadata: {
        ...(input.metadata ?? {}),
        reason: "insufficient_credits",
        balance: debit.balance,
      },
    });
    throw new InsufficientCreditsError(normalized, debit.balance);
  }

  await storage.recordAiUsageEvent({
    userId: input.userId,
    provider: input.provider,
    feature: input.feature,
    status: "charged",
    estimatedCredits: normalized,
    actualCredits: normalized,
    requestId: input.requestId,
    metadata: input.metadata ?? null,
  });

  return { balance: debit.balance };
}

export async function refundCredits(
  storage: IStorage,
  input: CreditChargeInput & { reason: string },
): Promise<{ balance: number }> {
  const normalized = Math.max(0, Math.trunc(input.credits));
  const credit = await storage.creditWalletCredits(
    input.userId,
    normalized,
    `${input.provider}:${input.feature}:refund:${input.reason}`,
    {
      requestId: input.requestId,
      metadata: input.metadata ?? null,
    },
  );

  await storage.recordAiUsageEvent({
    userId: input.userId,
    provider: input.provider,
    feature: input.feature,
    status: "refunded",
    estimatedCredits: normalized,
    actualCredits: -normalized,
    requestId: input.requestId,
    metadata: {
      ...(input.metadata ?? {}),
      reason: input.reason,
    },
  });

  return credit;
}

export function brainstormCreditCost(imageCount: number): number {
  return imageCount > 0 ? 2 : 1;
}

export type LumaGenerationMode = "text-to-video" | "image-to-video" | "video-to-video";
export type LumaResolution = "540p" | "720p" | "1080p" | "4k";
export type VideoBillingProvider = "luma" | "veo";

export interface LumaCreditOptions {
  resolution?: LumaResolution;
  duration?: string;
}

const BASE_CREDITS_BY_MODE: Record<LumaGenerationMode, number> = {
  "text-to-video": 6,
  "image-to-video": 8,
  "video-to-video": 10,
};

const RESOLUTION_MULTIPLIER: Record<LumaResolution, number> = {
  "540p": 0.5625,
  "720p": 1,
  "1080p": 2.25,
  "4k": 9,
};

function parseDurationSeconds(duration?: string): number {
  if (!duration) return 5;
  const match = duration.trim().toLowerCase().match(/^(\d+)s$/);
  if (!match) return 5;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return 5;
  return seconds;
}

export function lumaCreditCost(
  genMode: LumaGenerationMode,
  options: LumaCreditOptions = {},
): number {
  const baseCredits = BASE_CREDITS_BY_MODE[genMode] ?? 6;
  const resolutionMultiplier = options.resolution
    ? (RESOLUTION_MULTIPLIER[options.resolution] ?? 1)
    : 1;
  const durationMultiplier = parseDurationSeconds(options.duration) / 5;
  const scaled = baseCredits * resolutionMultiplier * durationMultiplier;
  return Math.max(1, Math.ceil(scaled));
}

export function videoCreditCost(
  provider: VideoBillingProvider,
  genMode: LumaGenerationMode,
  options: LumaCreditOptions = {},
): number {
  const base = lumaCreditCost(genMode, options);
  const multiplier = provider === "veo" ? 2 : 1;
  return Math.max(1, Math.ceil(base * multiplier));
}
