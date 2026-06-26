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

export function lumaCreditCost(genMode: "text-to-video" | "image-to-video" | "video-to-video"): number {
  if (genMode === "image-to-video") return 8;
  if (genMode === "video-to-video") return 10;
  return 6;
}
