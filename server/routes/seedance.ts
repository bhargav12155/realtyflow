import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import {
  seedanceService,
  type SeedanceModel,
  type SeedanceAspectRatio,
  type SeedanceDuration,
} from "../services/seedance";

const MODELS: SeedanceModel[] = [
  "seedance-1-0-pro-250528",
  "seedance-1-0-lite-t2v-250428",
  "seedance-1-0-lite-i2v-250428",
];
const ASPECTS: SeedanceAspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "3:4"];
const DURATIONS: SeedanceDuration[] = [5, 10];

const createVideoSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("text"),
    prompt: z.string().min(1).max(4000),
    model: z.enum(MODELS as [SeedanceModel, ...SeedanceModel[]]).optional(),
    aspectRatio: z.enum(ASPECTS as [SeedanceAspectRatio, ...SeedanceAspectRatio[]]).optional(),
    durationSeconds: z
      .union([z.literal(5), z.literal(10)])
      .optional(),
    resolution: z.enum(["480p", "720p", "1080p"]).optional(),
    seed: z.number().int().optional(),
  }),
  z.object({
    mode: z.literal("image"),
    prompt: z.string().min(1).max(4000),
    sourceImageUrl: z.string().url(),
    model: z.enum(MODELS as [SeedanceModel, ...SeedanceModel[]]).optional(),
    aspectRatio: z.enum(ASPECTS as [SeedanceAspectRatio, ...SeedanceAspectRatio[]]).optional(),
    durationSeconds: z.union([z.literal(5), z.literal(10)]).optional(),
    resolution: z.enum(["480p", "720p", "1080p"]).optional(),
    seed: z.number().int().optional(),
  }),
]);

type SeedanceAuthedRequest = Request & {
  user?: { id?: string | number; claims?: { sub?: string } };
};

export function registerSeedanceRoutes(app: Express, requireAuth: RequestHandler) {
  const seedanceTaskOwners = new Map<string, string>();

  app.post(
    "/api/seedance/create-video",
    requireAuth,
    async (req: SeedanceAuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id ?? req.user?.claims?.sub ?? "");
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const parsed = createVideoSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Invalid request",
            details: parsed.error.flatten(),
          });
        }
        const body = parsed.data;

        const result =
          body.mode === "text"
            ? await seedanceService.createTextToVideo({
                prompt: body.prompt,
                model: body.model,
                aspectRatio: body.aspectRatio,
                durationSeconds: body.durationSeconds,
                resolution: body.resolution,
                seed: body.seed,
              })
            : await seedanceService.createImageToVideo({
                prompt: body.prompt,
                sourceImageUrl: body.sourceImageUrl,
                model: body.model,
                aspectRatio: body.aspectRatio,
                durationSeconds: body.durationSeconds,
                resolution: body.resolution,
                seed: body.seed,
              });

        seedanceTaskOwners.set(result.taskId, userId);
        return res.json({ taskId: result.taskId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to start Seedance video task";
        console.error("Seedance create-video error:", err);
        return res.status(500).json({ error: message });
      }
    }
  );

  app.get(
    "/api/seedance/status/:taskId",
    requireAuth,
    async (req: SeedanceAuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id ?? req.user?.claims?.sub ?? "");
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { taskId } = req.params;
        if (!taskId) return res.status(400).json({ error: "taskId is required" });

        const owner = seedanceTaskOwners.get(taskId);
        if (!owner) {
          return res
            .status(403)
            .json({ error: "Task ownership expired. Please create a new video." });
        }
        if (owner !== userId) {
          return res.status(403).json({ error: "Not authorized to view this task" });
        }

        const status = await seedanceService.getStatus(taskId);
        if (status.status === "ready" || status.status === "failed") {
          seedanceTaskOwners.delete(taskId);
        }
        return res.json(status);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to get Seedance task status";
        console.error("Seedance status error:", err);
        return res.status(500).json({ error: message });
      }
    }
  );
}
