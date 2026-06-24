import { Router, Request, Response } from "express";
import settingsRoutes from "./settings";
import socialLinksRoutes from "./social-links";
import socialApiKeysRoutes from "./social-api-keys";
import { requireAuth } from "../../middleware/auth";
import { db } from "../../db";
import { users, publicUsers, userPreferences, insertUserPreferencesSchema } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import { persistImageBuffer } from "../../objectStorage";

const router = Router();

// Configure multer for agent photo uploads
const agentPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Get current user profile
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userType = req.userType;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "User ID not found" });
    }

    if (userType === "agent") {
      // Fetch agent user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId as string))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        type: "agent",
      });
    } else if (userType === "public") {
      // Fetch public user from database
      const [user] = await db
        .select()
        .from(publicUsers)
        .where(eq(publicUsers.id, parseInt(userId as string)))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        id: user.id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        agentSlug: user.agentSlug,
        type: "public",
      });
    }

    return res.status(400).json({ error: "Invalid user type" });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Update preferences validation schema
const updatePreferencesSchema = z.object({
  aiProvider: z.enum(["auto", "openai", "gemini"]).optional(),
  serviceArea: z.string().optional(),
  communities: z.array(z.string()).optional(),
  agentPhotoUrl: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
});

// Get current user's preferences (create default if not exists)
router.get("/preferences", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Try to find existing preferences
    let [preferences] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    // If no preferences exist, create default ones
    if (!preferences) {
      [preferences] = await db
        .insert(userPreferences)
        .values({
          userId,
          aiProvider: "auto",
          onboardingCompleted: false,
        })
        .returning();
    }

    return res.json(preferences);
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    res.status(500).json({ error: "Failed to fetch user preferences" });
  }
});

// Update user preferences
router.put("/preferences", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Validate request body
    const parsed = updatePreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.errors });
    }

    const updates = parsed.data;

    // Check if preferences exist
    const [existing] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    let preferences;
    if (existing) {
      // Update existing preferences
      [preferences] = await db
        .update(userPreferences)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId))
        .returning();
    } else {
      // Create new preferences with provided values
      [preferences] = await db
        .insert(userPreferences)
        .values({
          userId,
          aiProvider: updates.aiProvider ?? "auto",
          serviceArea: updates.serviceArea,
          communities: updates.communities,
          agentPhotoUrl: updates.agentPhotoUrl,
          onboardingCompleted: updates.onboardingCompleted ?? false,
        })
        .returning();
    }

    return res.json(preferences);
  } catch (error) {
    console.error("Error updating user preferences:", error);
    res.status(500).json({ error: "Failed to update user preferences" });
  }
});

// Upload agent photo to object storage
router.post("/photo", requireAuth, agentPhotoUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Generate unique filename
    const ext = file.originalname.split(".").pop() || "jpg";
    const filename = `agent-photos/${userId}-${Date.now()}.${ext}`;

    // Persist to object storage
    const url = await persistImageBuffer(file.buffer, filename, file.mimetype);
    
    if (!url) {
      return res.status(500).json({ error: "Failed to upload photo to storage" });
    }

    // Update user preferences with the new photo URL
    const [existing] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(userPreferences)
        .set({ agentPhotoUrl: url, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId));
    } else {
      await db
        .insert(userPreferences)
        .values({
          userId,
          agentPhotoUrl: url,
          aiProvider: "auto",
          onboardingCompleted: false,
        });
    }

    return res.json({ url });
  } catch (error) {
    console.error("Error uploading agent photo:", error);
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

// Register user-related routes
router.use("/settings", settingsRoutes);
router.use("/social-links", socialLinksRoutes);
router.use(socialApiKeysRoutes);

export default router;
