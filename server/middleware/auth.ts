import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const DEBUG_AUTH_LOGS =
  process.env.DEBUG_AUTH_LOGS === "1"
  || process.env.DEBUG_AUTH_LOGS === "true"
  || (process.env.DEBUG || "").split(",").map((v) => v.trim()).includes("auth");

// Extend Express Request interface to include user information
declare global {
  namespace Express {
    interface Request {
      userId?: string | number;
      userType?: "agent" | "public";
      username?: string;
      agentSlug?: string;
      user?: {
        id: string | number;
        type: "agent" | "public";
        username?: string;
        email?: string;
        agentSlug?: string;
        name?: string;
        isDemo?: boolean;
      };
    }
  }
}

export interface JWTPayload {
  id: string | number;
  username?: string;
  email: string;
  type?: "agent" | "public";
  agentSlug?: string;
  name?: string;
  isDemo?: boolean;
  iat?: number;
  exp?: number;
}

async function tryRefreshExpiredToken(token: string): Promise<{ decoded: JWTPayload; newToken: string } | null> {
  try {
    const decoded = jwt.decode(token) as JWTPayload | null;
    if (!decoded || !decoded.id || !decoded.email) return null;

    if (decoded.type === "public") {
      const rows = await db.execute(
        sql`SELECT id, email FROM public_users WHERE id = ${Number(decoded.id) || 0} AND email = ${decoded.email} LIMIT 1`
      );
      if (rows.rows.length === 0) return null;
    } else {
      const rows = await db.execute(
        sql`SELECT id, email FROM users WHERE id = ${String(decoded.id)} AND email = ${decoded.email} LIMIT 1`
      );
      if (rows.rows.length === 0) return null;
    }

    const { iat, exp, ...payload } = decoded;
    const newToken = generateToken(payload);
    if (DEBUG_AUTH_LOGS) {
      console.log(`🔐 [AUTH] Token refreshed for ${decoded.email} (${decoded.type})`);
    }
    return { decoded, newToken };
  } catch (e) {
    return null;
  }
}

function applyDecodedToRequest(req: Request, decoded: JWTPayload) {
  if (decoded.type === "public") {
    req.userId = decoded.id;
    req.userType = "public";
    req.agentSlug = decoded.agentSlug;
    req.user = {
      id: decoded.id,
      type: "public",
      email: decoded.email,
      agentSlug: decoded.agentSlug,
    };
  } else {
    req.userId = decoded.id;
    req.userType = "agent";
    req.username = decoded.username;
    req.user = {
      id: decoded.id,
      type: "agent",
      username: decoded.username,
      email: decoded.email,
      name: decoded.name,
      isDemo: decoded.isDemo,
    };
  }
}

/**
 * Middleware to extract user ID from JWT token
 * Works with both agent and public user tokens
 */
export const extractUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      req.cookies?.authToken;

    if (!token) {
      if (DEBUG_AUTH_LOGS) {
        console.log("🔐 [AUTH] No token provided");
      }
      return res.status(401).json({ error: "No token provided" });
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (verifyError: any) {
      if (verifyError.name === "TokenExpiredError") {
        const refreshed = await tryRefreshExpiredToken(token);
        if (refreshed) {
          applyDecodedToRequest(req, refreshed.decoded);
          (req as any)._refreshedToken = refreshed.newToken;
          res.cookie("authToken", refreshed.newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });
          return next();
        }
      }
      console.error("🔐 [AUTH] Token verification failed:", verifyError.message);
      return res.status(401).json({ error: "Invalid token" });
    }

    if (DEBUG_AUTH_LOGS) {
      console.log("🔐 [AUTH] Token decoded:", {
        id: decoded.id,
        email: decoded.email,
        type: decoded.type,
        username: decoded.username,
      });
    }

    applyDecodedToRequest(req, decoded);

    if (decoded.type === "public") {
      if (DEBUG_AUTH_LOGS) {
        console.log("🔐 [AUTH] Public user authenticated:", req.user!.id);
      }
    } else {
      if (DEBUG_AUTH_LOGS) {
        console.log("🔐 [AUTH] Agent user authenticated:", req.user!.id, `(${req.user!.email})`, decoded.isDemo ? "[DEMO]" : "");
      }
    }

    next();
  } catch (error) {
    console.error("🔐 [AUTH] Token verification failed:", error);
    return res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * Middleware to require authentication (any user type)
 */
export const requireAuth = extractUserId;

/**
 * Middleware to require agent authentication only
 */
export const requireAgent = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  extractUserId(req, res, (err) => {
    if (err) return;

    if (req.userType !== "agent") {
      return res.status(403).json({ error: "Agent access required" });
    }

    next();
  });
};

/**
 * Middleware to require public user authentication only
 */
export const requirePublicUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  extractUserId(req, res, (err) => {
    if (err) return;

    if (req.userType !== "public") {
      return res.status(403).json({ error: "Public user access required" });
    }

    next();
  });
};

/**
 * Factory function to create admin middleware with storage access
 * Must be called with storage instance from routes.ts
 */
export const createRequireAdmin = (storage: { 
  getUser: (id: string) => Promise<any>;
  getPublicUserById: (id: number) => Promise<{ role?: string | null } | undefined>;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    extractUserId(req, res, async (err) => {
      if (err) return;
      
      try {
        // Check agent users
        if (req.userType === "agent") {
          const user = await storage.getUser(String(req.userId));
          if (user?.role === "admin") {
            return next();
          }
        }
        
        // Check public users
        if (req.userType === "public") {
          const publicUser = await storage.getPublicUserById(Number(req.userId));
          if (publicUser?.role === "admin") {
            return next();
          }
        }
        
        return res.status(403).json({ error: "Admin access required" });
      } catch (error) {
        console.error("Admin auth check failed:", error);
        return res.status(500).json({ error: "Failed to verify admin access" });
      }
    });
  };
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") || req.cookies?.authToken;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    applyDecodedToRequest(req, decoded);
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      const refreshed = await tryRefreshExpiredToken(token);
      if (refreshed) {
        applyDecodedToRequest(req, refreshed.decoded);
        (req as any)._refreshedToken = refreshed.newToken;
        res.cookie("authToken", refreshed.newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }
    }
  }

  next();
};

/**
 * Generate JWT token for user
 */
export const generateToken = (
  payload: Omit<JWTPayload, "iat" | "exp">
): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  return jwt.sign(payload as object, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
};
