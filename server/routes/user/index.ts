import { Router } from "express";
import settingsRoutes from "./settings";

const router = Router();

// Register user-related routes
router.use("/settings", settingsRoutes);

export default router;
