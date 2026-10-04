import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Authentication service.
 *
 * - Passwords: PBKDF2-SHA256 (100k iterations, per-user 128-bit salt).
 *   Plaintext passwords are never stored or logged.
 * - Sessions: opaque 256-bit random token returned once to the client and
 *   stored client-side; only its SHA-256 hash is persisted server-side.
 * - Every protected function calls requireUser(), which validates the token
 *   server-side. Students can only ever act as themselves.
 */

const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MIN_PASSWORD_LENGTH = 8;

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function deriveKey(
  password: string,
  saltHex: string,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex),
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

/** Returns `pbkdf2$<iterations>$<saltHex>$<hashHex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesToHex(salt);
  const hashHex = await deriveKey(password, saltHex, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

/** Constant-time-ish verification of a stored password record. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [scheme, iterationsStr, saltHex, expectedHex] = stored.split("$");
    if (scheme !== "pbkdf2" || !iterationsStr || !saltHex || !expectedHex) {
      return false;
    }
    const iterations = parseInt(iterationsStr, 10);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    const candidateHex = await deriveKey(password, saltHex, iterations);
    if (candidateHex.length !== expectedHex.length) return false;
    let diff = 0;
    for (let i = 0; i < candidateHex.length; i++) {
      diff |= candidateHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (password.length > 200) {
    return "Password must be 200 characters or fewer.";
  }
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasLetter || !hasDigit) {
    return "Password must contain at least one letter and one number.";
  }
  return null;
}

/**
 * Phone numbers are the V1 login identifier (no email required).
 * Normalizes Nigerian local format (0…) to international digits (234…).
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  let normalized = digits;
  if (digits.length === 11 && digits.startsWith("0")) {
    normalized = `234${digits.slice(1)}`;
  } else if (digits.length === 13 && digits.startsWith("234")) {
    normalized = digits;
  }
  return normalized;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(input),
  );
  return bytesToHex(new Uint8Array(digest));
}

function randomHex(bytes: number): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function createSession(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ sessionToken: string; expiresAt: number }> {
  const sessionToken = randomHex(32);
  const tokenHash = await sha256Hex(sessionToken);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await ctx.db.insert("sessions", {
    userId,
    tokenHash,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  });
  return { sessionToken, expiresAt };
}

/** Returns the authenticated user for a session token, or null. */
export async function getUserBySession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string | null | undefined,
): Promise<Doc<"users"> | null> {
  if (!sessionToken) return null;
  const tokenHash = await sha256Hex(sessionToken);
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (!session) return null;
  if (session.expiresAt <= Date.now()) return null;
  const user = await ctx.db.get(session.userId);
  if (!user) return null;
  return user;
}

/** Throws unless a valid session is supplied. */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string | null | undefined,
): Promise<Doc<"users">> {
  const user = await getUserBySession(ctx, sessionToken);
  if (!user) {
    throw new Error("KFP_UNAUTHENTICATED: Please sign in to continue.");
  }
  return user;
}

/**
 * Separates student functionality from admin functionality.
 * Admin surfaces must call this before performing privileged work.
 */
export function requireAdmin(user: Doc<"users">): Doc<"users"> {
  if (user.role !== "admin") {
    throw new Error("KFP_FORBIDDEN: Admin access required.");
  }
  return user;
}

export const sessionTokenArg = v.string();
