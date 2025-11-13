import { Router } from "express";
import settingsRoutes from "./settings";
import socialLinksRoutes from "./social-links";
import socialApiKeysRoutes from "./social-api-keys";

const router = Router();

// Register user-related routes
router.use("/settings", settingsRoutes);
router.use("/social-links", socialLinksRoutes);
router.use(socialApiKeysRoutes);

export default router;
