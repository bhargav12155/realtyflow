import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

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
 * Middleware to verify JWT token and extract user info
 */
export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      req.cookies?.authToken;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const jwtSecret = process.env.JWT_SECRET || "";
    if (!jwtSecret) {
      console.error("JWT_SECRET not configured in environment");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Verify and decode the token
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Add user info to request object
    req.user = {
      id: decoded.id,
      type: decoded.type || "agent",
      username: decoded.username,
      email: decoded.email,
      agentSlug: decoded.agentSlug,
    };

    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
