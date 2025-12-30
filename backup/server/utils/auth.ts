import bcrypt from "bcryptjs";
import { Request } from "express";
import { db } from "../db";
import {
  users,
  publicUsers,
  type User,
  type PublicUser,
  type InsertUser,
  type InsertPublicUser,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { generateToken, type JWTPayload } from "../middleware/auth";

/**
 * Hash password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

/**
 * Verify password against hash
 */
export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Create a new agent user
 */
export const createAgent = async (userData: {
  username: string;
  password: string;
  name: string;
  email: string;
  role?: string;
}): Promise<{ user: User; token: string }> => {
  // Normalize email to lowercase to prevent duplicates
  const normalizedEmail = userData.email.toLowerCase().trim();
  
  // Check if username or email already exists
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.username, userData.username))
    .limit(1);

  if (existingUser.length > 0) {
    throw new Error("Username already exists");
  }

  const existingEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingEmail.length > 0) {
    throw new Error("Email already exists");
  }

  // Hash password
  const hashedPassword = await hashPassword(userData.password);

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      username: userData.username,
      password: hashedPassword,
      name: userData.name,
      email: normalizedEmail,
      role: userData.role || "agent",
    })
    .returning();

  // Generate JWT token
  const tokenPayload: Omit<JWTPayload, "iat" | "exp"> = {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    type: "agent",
  };

  const token = generateToken(tokenPayload);

  return { user: newUser, token };
};

/**
 * Login agent user
 */
export const loginAgent = async (
  username: string,
  password: string
): Promise<{ user: User; token: string }> => {
  // Find user by username
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    throw new Error("Invalid username or password");
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password);

  if (!isValidPassword) {
    throw new Error("Invalid username or password");
  }

  // Generate JWT token
  const tokenPayload: Omit<JWTPayload, "iat" | "exp"> = {
    id: user.id,
    username: user.username,
    email: user.email,
    type: "agent",
  };

  const token = generateToken(tokenPayload);

  return { user, token };
};

/**
 * Create or login a public user (client/visitor)
 */
export const createOrLoginPublicUser = async (
  email: string,
  agentSlug: string,
  name?: string
): Promise<{ user: PublicUser; token: string; isNewUser: boolean }> => {
  // Normalize email to lowercase to prevent duplicates
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check if public user already exists for this agent
  let [existingUser] = await db
    .select()
    .from(publicUsers)
    .where(
      and(eq(publicUsers.email, normalizedEmail), eq(publicUsers.agentSlug, agentSlug))
    )
    .limit(1);

  let isNewUser = false;

  if (!existingUser) {
    // Create new public user
    [existingUser] = await db
      .insert(publicUsers)
      .values({
        email: normalizedEmail,
        agentSlug,
        name: name || null,
      })
      .returning();
    isNewUser = true;
  } else {
    // Update last login
    [existingUser] = await db
      .update(publicUsers)
      .set({ lastLogin: new Date() })
      .where(eq(publicUsers.id, existingUser.id))
      .returning();
  }

  // Generate JWT token
  const tokenPayload: Omit<JWTPayload, "iat" | "exp"> = {
    id: existingUser.id,
    email: existingUser.email,
    type: "public",
    agentSlug: existingUser.agentSlug,
  };

  const token = generateToken(tokenPayload);

  return { user: existingUser, token, isNewUser };
};

/**
 * Get user by ID (works for both user types)
 */
export const getUserById = async (
  userId: string | number,
  userType: "agent" | "public"
) => {
  if (userType === "public") {
    const [user] = await db
      .select()
      .from(publicUsers)
      .where(eq(publicUsers.id, userId as number))
      .limit(1);
    return user;
  } else {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId as string))
      .limit(1);
    return user;
  }
};

/**
 * Build user payload for external API integration
 */
export const buildUserPayload = (req: Request) => {
  if (!req.user) {
    throw new Error("User not authenticated");
  }

  const basePayload = {
    userId: req.user.id,
    userType: req.user.type,
  };

  // Add type-specific context
  if (req.user.type === "public") {
    return {
      ...basePayload,
      agentSlug: req.user.agentSlug,
      context: "client",
    };
  } else {
    return {
      ...basePayload,
      username: req.user.username,
      context: "agent",
    };
  }
};

/**
 * Call external AI SEO service with user identification
 */
export const callAiSeoService = async (
  req: Request,
  additionalParams: any = {}
) => {
  const AI_SEO_SERVICE_URL = process.env.AI_SEO_SERVICE_URL;
  const AI_SEO_SERVICE_API_KEY = process.env.AI_SEO_SERVICE_API_KEY;

  if (!AI_SEO_SERVICE_URL) {
    throw new Error("AI_SEO_SERVICE_URL not configured");
  }

  const userIdentifier = buildUserPayload(req);

  const apiPayload = {
    user: userIdentifier,
    ...additionalParams,
  };

  try {
    const response = await fetch(`${AI_SEO_SERVICE_URL}/api/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AI_SEO_SERVICE_API_KEY && {
          Authorization: `Bearer ${AI_SEO_SERVICE_API_KEY}`,
        }),
      },
      body: JSON.stringify(apiPayload),
    });

    return await response.json();
  } catch (error) {
    console.error("AI SEO Service Error:", error);
    throw error;
  }
};

/**
 * Test user identification - useful for debugging
 */
export const testUserIdentification = (token: string) => {
  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;

    console.log("User ID:", decoded.id);
    console.log("User Type:", decoded.type || "agent");

    if (decoded.type === "public") {
      console.log("Agent Slug:", decoded.agentSlug);
      console.log("Email:", decoded.email);
    } else {
      console.log("Username:", decoded.username);
      console.log("Email:", decoded.email);
    }

    return {
      isValid: true,
      userId: decoded.id,
      userType: decoded.type || "agent",
    };
  } catch (error: any) {
    console.error("Invalid token:", error.message);
    return { isValid: false };
  }
};
