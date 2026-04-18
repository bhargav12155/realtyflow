import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import type { BoardAsset } from "@shared/schema";
import { assertSafePublicUrl, safePublicFetch } from "../utils/safeFetch";

export interface AutoEvalInput {
  prompt: string;
  assets: BoardAsset[];
}

export interface AutoEvalResult {
  winnerAssetId: string;
  rejected: Array<{ assetId: string; reason: string }>;
  modelUsed: "gpt-4o" | "gemini" | "heuristic";
}

const SYSTEM_PROMPT = `You are an expert creative director auto-evaluating a batch of generated media variations.
You are given the original creative prompt and a numbered list of variations (with thumbnails when available).
Pick the single strongest variation and reject the rest with a short, concrete reason.

Respond with STRICT JSON:
{
  "winnerIndex": <number, 1-based>,
  "rejected": [{"index": <number, 1-based>, "reason": "<one short sentence>"}]
}
Reasons should reference visual fidelity, prompt adherence, motion quality, composition, or face/identity consistency when relevant.`;

interface EvalShape {
  winnerAssetId: string;
  rejected: Array<{ assetId: string; reason: string }>;
}

function parseEvalResponse(raw: string, assets: BoardAsset[]): EvalShape | null {
  try {
    const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const winnerIdx = Number(parsed.winnerIndex);
    if (!winnerIdx || winnerIdx < 1 || winnerIdx > assets.length) return null;
    const winner = assets[winnerIdx - 1];
    const rejected: EvalShape["rejected"] = [];
    if (Array.isArray(parsed.rejected)) {
      for (const r of parsed.rejected) {
        const idx = Number(r.index);
        if (!idx || idx < 1 || idx > assets.length) continue;
        if (idx === winnerIdx) continue;
        const a = assets[idx - 1];
        rejected.push({
          assetId: a.id,
          reason: String(r.reason || "Lower overall quality vs winner").slice(0, 280),
        });
      }
    }
    // Backfill any missing non-winners so the caller always gets a complete rejection set.
    for (let i = 0; i < assets.length; i++) {
      if (i === winnerIdx - 1) continue;
      const a = assets[i];
      if (!rejected.find((x) => x.assetId === a.id)) {
        rejected.push({ assetId: a.id, reason: "Lower overall quality vs winner" });
      }
    }
    return { winnerAssetId: winner.id, rejected };
  } catch {
    return null;
  }
}

function describeAsset(a: BoardAsset, index: number): string {
  const parts = [`Variation ${index} — id=${a.id}`, `provider=${a.provider}`];
  if (a.modelLabel) parts.push(`model=${a.modelLabel}`);
  parts.push(`kind=${a.kind}`);
  if (a.assetUrl) parts.push(`url=${a.assetUrl}`);
  if (a.thumbnailUrl && a.thumbnailUrl !== a.assetUrl) parts.push(`thumbnail=${a.thumbnailUrl}`);
  if (a.durationSeconds) parts.push(`duration=${a.durationSeconds}s`);
  return parts.join(" ");
}

function pickPreviewUrl(a: BoardAsset): string | null {
  // Prefer thumbnail (likely an image) over the asset itself (likely a video).
  return a.thumbnailUrl || a.assetUrl || null;
}

async function tryOpenAiVisionEval(input: AutoEvalInput): Promise<AutoEvalResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];
  userContent.push({
    type: "text",
    text: `Original prompt:\n"""${input.prompt}"""\n\nVariations (1-${input.assets.length}):`,
  });
  for (let i = 0; i < input.assets.length; i++) {
    const a = input.assets[i];
    userContent.push({ type: "text", text: `\n${describeAsset(a, i + 1)}` });
    const preview = pickPreviewUrl(a);
    if (preview) {
      // Only let the model dereference URLs that pass our SSRF guard.
      try {
        await assertSafePublicUrl(preview);
        userContent.push({ type: "image_url", image_url: { url: preview } });
      } catch (err) {
        console.warn(
          `[boardAutoEval] Skipping unsafe preview URL for asset ${a.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }
  userContent.push({
    type: "text",
    text: `\n\nReturn STRICT JSON with winnerIndex and rejected[] as instructed.`,
  });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
    const text = completion.choices?.[0]?.message?.content || "";
    const parsed = parseEvalResponse(text, input.assets);
    if (!parsed) return null;
    return { ...parsed, modelUsed: "gpt-4o" };
  } catch (err) {
    console.error("[boardAutoEval] OpenAI eval failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchAssetAsImagePart(
  asset: BoardAsset,
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  const url = pickPreviewUrl(asset);
  if (!url) return null;
  try {
    const resp = await safePublicFetch(url);
    if (!resp.ok) return null;
    const ct = (resp.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    return { inlineData: { mimeType: ct, data: buf.toString("base64") } };
  } catch (err) {
    console.warn(
      `[boardAutoEval] Skipping unsafe/unfetchable preview for asset ${asset.id}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function tryGeminiVisionEval(input: AutoEvalInput): Promise<AutoEvalResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const client = new GoogleGenAI({ apiKey });

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];
  parts.push({
    text: `Original prompt:\n"""${input.prompt}"""\n\nVariations (1-${input.assets.length}):`,
  });
  for (let i = 0; i < input.assets.length; i++) {
    const a = input.assets[i];
    parts.push({ text: `\n${describeAsset(a, i + 1)}` });
    const imgPart = await fetchAssetAsImagePart(a);
    if (imgPart) parts.push(imgPart);
  }
  parts.push({ text: `\n\nReturn JSON with winnerIndex and rejected[] as instructed.` });

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        maxOutputTokens: 800,
      },
    });
    const text = response.text || "";
    const parsed = parseEvalResponse(text, input.assets);
    if (!parsed) return null;
    return { ...parsed, modelUsed: "gemini" };
  } catch (err) {
    console.error("[boardAutoEval] Gemini eval failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

function heuristicFallback(input: AutoEvalInput): AutoEvalResult {
  const [winner, ...rest] = input.assets;
  return {
    winnerAssetId: winner.id,
    rejected: rest.map((a) => ({
      assetId: a.id,
      reason: "Auto-eval unavailable — defaulted to first variation",
    })),
    modelUsed: "heuristic",
  };
}

export async function autoEvaluateBatch(input: AutoEvalInput): Promise<AutoEvalResult> {
  if (input.assets.length < 2) {
    throw new Error("autoEvaluateBatch requires at least 2 assets");
  }
  // Primary: GPT-4o vision (per task contract).
  const primary = await tryOpenAiVisionEval(input);
  if (primary) return primary;
  // Fallback: Gemini vision.
  const secondary = await tryGeminiVisionEval(input);
  if (secondary) return secondary;
  // Last resort: deterministic heuristic so the batch still resolves.
  console.warn("[boardAutoEval] Falling back to heuristic evaluation");
  return heuristicFallback(input);
}
