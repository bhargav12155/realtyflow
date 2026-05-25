import dotenv from "dotenv";
// Load environment variables first
dotenv.config();

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, type Request, Response } from "express";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { log, serveStatic, setupVite } from "./vite";
import { realtimeService } from "./websocket";

const app = express();

// Trust proxy in production (for Replit, Elastic Beanstalk, etc.)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Increase payload limit to handle property tour photo uploads (multiple high-res images as base64)
// Capture raw body for webhook signature verification
app.use(express.json({ 
  limit: "50mb",
  verify: (req: any, res, buf) => {
    // Store raw body for webhook signature verification
    if (req.url?.startsWith('/api/webhooks/')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(cookieParser());

// CORS configuration for NebraskaHomeHub integration
app.use(
  cors({
    origin: [
      "http://localhost:5000", // RealtyFlow dev
      "http://localhost:5173", // NebraskaHomeHub dev
      "http://localhost:3001", // NebraskaHomeHub dev alternative
      "http://gb-home-template-env-dev.eba-pisu79mx.us-east-2.elasticbeanstalk.com",
      "https://gb-home-template-env-dev.eba-pisu79mx.us-east-2.elasticbeanstalk.com",
      "https://bjorkhomes.com",
      "https://mandy.bjorkhomes.com",
      "https://www.imakepage.com",
      "https://imakepage.com",
      "https://joinkeep.ai",
      "https://www.joinkeep.ai",
      "https://imakeblogs.ai",
      "https://www.imakeblogs.ai",
      // Add other NebraskaHomeHub domains as needed
    ],
    credentials: true,
  })
);

// Allow iframe embedding and microphone access
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  // Allow microphone and camera access for audio/video recording features
  // Correct syntax: feature=(allowlist) where * means all origins
  res.setHeader("Permissions-Policy", "microphone=(*), camera=(*)");
  next();
});

// Serve uploaded files
const uploadsPath = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use("/uploads", express.static(uploadsPath));

// Serve attached assets (demo images, etc.)
const attachedAssetsPath = path.resolve(process.cwd(), "attached_assets");
app.use("/attached_assets", express.static(attachedAssetsPath));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Initialize WebSocket server for real-time updates
  realtimeService.initialize(server);

  // Wire HeyGen response-validation failures into structured logs and the
  // realtime admin alert channel so operators see HeyGen shape drift fast.
  const { registerHeygenValidationReporter, setHeygenAlertsSettingsProvider } =
    await import("./services/heygen-validation-reporter");
  registerHeygenValidationReporter();

  // Let admins override the Slack webhook from the dashboard. The
  // provider reads from `platform_settings.heygen_alerts` (cached in
  // memory and refreshed on each save in admin-heygen-alerts route).
  const { loadHeygenAlertsSettings } = await import(
    "./services/heygen-alerts-settings"
  );
  setHeygenAlertsSettingsProvider(() => loadHeygenAlertsSettings());

  // Initialize automatic post scheduler
  const { PostScheduler } = await import("./services/post-scheduler");
  const { storage } = await import("./storage");
  const { socialMediaService } = await import("./services/socialMedia");
  const postScheduler = new PostScheduler(storage, socialMediaService);
  postScheduler.start();

  // Initialize WhatsApp bulk queue scheduler
  const { BulkQueueScheduler } = await import("./services/bulk-queue-scheduler");
  const bulkQueueScheduler = new BulkQueueScheduler(storage, realtimeService);
  bulkQueueScheduler.start();

  // Initialize background video job worker
  const { startVideoJobWorker } = await import("./services/videoJobWorker.js");
  startVideoJobWorker();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error for debugging
    console.error(`❌ [ERROR] ${status}: ${message}`);
    console.error(err.stack);

    res.status(status).json({ message });
    // Don't throw - just log and send response
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  
  // Must bind to 0.0.0.0 for both Replit and local dev to work
  // Browser connects via the domain it's accessing (Replit URL or localhost:5000)
  // not via the bind address
  server.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(
        `🚀 RealtyFlow Multi-User Server running on http://0.0.0.0:${port}`
      );
      log(`📊 Database: Connected to Neon PostgreSQL`);
      log(`🔐 Authentication: JWT Multi-User System Active`);
      log(`\n🔗 Available endpoints:`);
      log(`   • Universal Login: POST /api/auth/login`);
      log(`   • Agent Registration: POST /api/auth/agent/register`);
      log(`   • Agent Login: POST /api/auth/agent/login`);
      log(`   • Public User Login: POST /api/auth/public/login`);
      log(`   • Check Auth: GET /api/auth/check`);
      log(`   • Dashboard: GET /api/dashboard/overview`);
      log(`   • WebSocket: ws://0.0.0.0:${port}/ws`);
    }
  );
})();
