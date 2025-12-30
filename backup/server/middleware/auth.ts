import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

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
  iat?: number;
  exp?: number;
}

/**
 * Middleware to extract user ID from JWT token
 * Works with both agent and public user tokens
 */
export const extractUserId = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      req.cookies?.authToken;

    if (!token) {
      console.log("🔐 [AUTH] No token provided");
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    console.log("🔐 [AUTH] Token decoded:", {
      id: decoded.id,
      email: decoded.email,
      type: decoded.type,
      username: decoded.username,
    });

    // Determine user type and extract information
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
      console.log("🔐 [AUTH] Public user authenticated:", req.user.id);
    } else {
      req.userId = decoded.id;
      req.userType = "agent";
      req.username = decoded.username;
      req.user = {
        id: decoded.id,
        type: "agent",
        username: decoded.username,
        email: decoded.email,
      };
      console.log("🔐 [AUTH] Agent user authenticated:", req.user.id, `(${req.user.email})`);
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
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") || req.cookies?.authToken;

  if (!token) {
    return next(); // Continue without authentication
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

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
      };
    }
  } catch (error) {
    // Invalid token, but don't fail - just continue without authentication
    console.warn("Invalid token in optional auth:", error);
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
