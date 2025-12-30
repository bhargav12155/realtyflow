import { Request, Response, Router } from "express";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth";
import {
  createAgent,
  createOrLoginPublicUser,
  loginAgent,
  testUserIdentification,
} from "../utils/auth";

const router = Router();

// Validation schemas
const agentRegistrationSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.string().optional().default("agent"),
});

const agentLoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const publicUserSchema = z.object({
  email: z.string().email(),
  agentSlug: z.string().min(1),
  name: z.string().optional(),
});

// =====================================================
// AGENT AUTHENTICATION ROUTES
// =====================================================

/**
 * POST /api/auth/agent/register
 * Register a new real estate agent
 */
router.post("/agent/register", async (req: Request, res: Response) => {
  try {
    const validatedData = agentRegistrationSchema.parse(req.body);

    const { user, token } = await createAgent(validatedData);

    // Set HTTP-only cookie for token (SameSite=None for iframe/mobile, conditional secure for dev)
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Always secure in production for SameSite=None
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for production iframe support
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      message: "Agent registered successfully",
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        type: "agent",
      },
      token,
    });
  } catch (error: any) {
    console.error("Agent registration error:", error);

    if (error.message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to register agent",
    });
  }
});

/**
 * POST /api/auth/agent/login
 * Login a real estate agent
 */
router.post("/agent/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = agentLoginSchema.parse(req.body);

    const { user, token } = await loginAgent(username, password);

    // Set HTTP-only cookie for token (SameSite=None for iframe/mobile, conditional secure for dev)
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Always secure in production for SameSite=None
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for production iframe support
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        type: "agent",
      },
      token,
    });
  } catch (error: any) {
    console.error("Agent login error:", error);

    if (error.message.includes("Invalid username or password")) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password",
      });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
});

// =====================================================
// PUBLIC USER AUTHENTICATION ROUTES
// =====================================================

/**
 * POST /api/auth/public/login
 * Create or login a public user (client/visitor)
 */
router.post("/public/login", async (req: Request, res: Response) => {
  try {
    const { email, agentSlug, name } = publicUserSchema.parse(req.body);

    const { user, token, isNewUser } = await createOrLoginPublicUser(
      email,
      agentSlug,
      name,
    );

    // Set HTTP-only cookie for token (SameSite=None for iframe/mobile, conditional secure for dev)
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Always secure in production for SameSite=None
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for production iframe support
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for public users
    });

    res.json({
      success: true,
      message: isNewUser ? "Account created successfully" : "Login successful",
      isNewUser,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        agentSlug: user.agentSlug,
        type: "public",
      },
      token,
    });
  } catch (error: any) {
    console.error("Public user login error:", error);

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
});

// =====================================================
// SHARED AUTHENTICATION ROUTES
// =====================================================

/**
 * POST /api/auth/logout
 * Logout user (clears cookie)
 */
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("authToken");

  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get("/me", requireAuth, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Not authenticated",
    });
  }

  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * GET /api/auth/check
 * Check if user is authenticated (optional auth)
 */
router.get("/check", optionalAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    authenticated: !!req.user,
    user: req.user || null,
  });
});

// =====================================================
// UNIVERSAL LOGIN ROUTE
// =====================================================

/**
 * POST /api/auth/login
 * Universal login endpoint that auto-detects user type
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;

    if (!identifier || typeof identifier !== "string") {
      return res.status(400).json({
        success: false,
        error: "User identifier is required",
      });
    }

    const cleanIdentifier = identifier.trim();
    let loginResult;

    // Strategy 1: If it contains @, treat as email for public user
    if (cleanIdentifier.includes("@")) {
      loginResult = await createOrLoginPublicUser(
        cleanIdentifier,
        "default", // Default agent slug for email-based access
        cleanIdentifier.split("@")[0], // Use part before @ as name
      );

      if (loginResult.user) {
        const token = loginResult.token!;

        // Set HTTP-only cookie for token (SameSite=None for iframe/mobile, conditional secure for dev)
        res.cookie("authToken", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", // Always secure in production for SameSite=None
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for production iframe support
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.json({
          success: true,
          message: `Welcome ${
            loginResult.isNewUser ? "to RealtyFlow" : "back"
          }!`,
          user: {
            id: loginResult.user.id,
            email: loginResult.user.email,
            name: loginResult.user.name,
            type: "public",
            agentSlug: loginResult.user.agentSlug,
          },
          isNewUser: loginResult.isNewUser,
        });
      }
    }

    // Strategy 2: Treat as agent slug for public user access
    loginResult = await createOrLoginPublicUser(
      `${cleanIdentifier}@client.temp`,
      cleanIdentifier,
      cleanIdentifier,
    );

    if (loginResult.user) {
      const token = loginResult.token!;

      // Set HTTP-only cookie for token (SameSite=None for iframe/mobile, conditional secure for dev)
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Always secure in production for SameSite=None
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for production iframe support
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.json({
        success: true,
        message: `Welcome to ${cleanIdentifier}'s portal!`,
        user: {
          id: loginResult.user.id,
          email: loginResult.user.email,
          name: loginResult.user.name,
          type: "public",
          agentSlug: loginResult.user.agentSlug,
        },
        isNewUser: loginResult.isNewUser,
      });
    }

    // If we get here, no strategy worked
    return res.status(401).json({
      success: false,
      error: "Could not authenticate with the provided identifier",
    });
  } catch (error) {
    console.error("Universal login error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
});

// =====================================================
// DEVELOPMENT/DEBUG ROUTES
// =====================================================

/**
 * POST /api/auth/test-token
 * Test token validation (development only)
 */
if (process.env.NODE_ENV === "development") {
  router.post("/test-token", (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: "Token required",
        });
      }

      const result = testUserIdentification(token);

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Token test failed",
      });
    }
  });
}

export default router;
