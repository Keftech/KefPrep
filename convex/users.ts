import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  createSession,
  getUserBySession,
  hashPassword,
  normalizePhone,
  requireUser,
  sha256Hex,
  validatePasswordStrength,
  verifyPassword,
} from "./lib/auth";

const signupArgs = {
  fullName: v.string(),
  phone: v.string(),
  password: v.string(),
  universityId: v.id("universities"),
  programmeId: v.id("programmes"),
  level: v.number(),
  matricNumber: v.optional(v.string()),
};

export const signup = mutation({
  args: signupArgs,
  handler: async (ctx, args) => {
    const fullName = args.fullName.trim();
    if (fullName.length < 3 || fullName.length > 120) {
      throw new Error(
        "KFP_INVALID_NAME: Please enter your full name (3–120 characters).",
      );
    }
    const phone = normalizePhone(args.phone);
    if (!phone) {
      throw new Error(
        "KFP_INVALID_PHONE: Please enter a valid phone number (10–15 digits).",
      );
    }
    const passwordError = validatePasswordStrength(args.password);
    if (passwordError) {
      throw new Error(`KFP_INVALID_PASSWORD: ${passwordError}`);
    }
    if (!args.level || args.level < 100 || args.level > 600) {
      throw new Error("KFP_INVALID_LEVEL: Please select your level.");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    if (existing) {
      throw new Error(
        "KFP_PHONE_TAKEN: An account with this phone number already exists. Try signing in.",
      );
    }

    const university = await ctx.db.get(args.universityId);
    if (!university || !university.isActive) {
      throw new Error("KFP_INVALID_UNIVERSITY: University not found.");
    }
    const programme = await ctx.db.get(args.programmeId);
    if (
      !programme ||
      !programme.isActive ||
      programme.universityId !== args.universityId
    ) {
      throw new Error("KFP_INVALID_PROGRAMME: Programme not found.");
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      fullName,
      phone,
      passwordHash: await hashPassword(args.password),
      role: "student",
      plan: "FREE",
      universityId: args.universityId,
      programmeId: args.programmeId,
      level: args.level,
      matricNumber: args.matricNumber?.trim() || undefined,
      isDemo: false,
      createdAt: now,
    });

    await ctx.db.insert("analyticsEvents", {
      userId,
      name: "signup",
      properties: { level: args.level },
      createdAt: now,
    });

    const { sessionToken } = await createSession(ctx, userId);
    return { userId, sessionToken };
  },
});

export const login = mutation({
  args: {
    phone: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);
    const genericError = new Error(
      "KFP_INVALID_CREDENTIALS: Invalid phone number or password.",
    );
    if (!phone || args.password.length === 0) throw genericError;

    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    if (!user) throw genericError;

    const ok = await verifyPassword(args.password, user.passwordHash);
    if (!ok) throw genericError;

    const now = Date.now();
    await ctx.db.insert("analyticsEvents", {
      userId: user._id,
      name: "login",
      createdAt: now,
    });
    const { sessionToken } = await createSession(ctx, user._id);
    return { userId: user._id, sessionToken };
  },
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySession(ctx, args.sessionToken);
    if (!user) return { ok: true };
    const tokenHash = await sha256Hex(args.sessionToken);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (session) await ctx.db.delete(session._id);
    return { ok: true };
  },
});

/** Current session's user, or null. Never returns password material. */
export const me = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getUserBySession(ctx, args.sessionToken);
    if (!user) return null;
    return {
      id: user._id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      plan: user.plan,
      universityId: user.universityId,
      programmeId: user.programmeId,
      level: user.level,
      matricNumber: user.matricNumber ?? null,
      isDemo: user.isDemo,
      createdAt: user.createdAt,
    };
  },
});

/** Minimal introspection used by tests/tools to confirm auth guards work. */
export const requireUserPing = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    return { userId: user._id, role: user.role };
  },
});
