import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { CbtFormat, Plan } from "./types";

/**
 * Plan/quota service. All limits come from the `systemConfig` table so they
 * are backend-configurable — the frontend never decides entitlements, it only
 * displays what this service reports. Enforcement happens in mutations.
 */

export type PlanLimits = {
  maxCourses: number;
  simulationsPerWeek: number;
  simulationsPerCoursePerWeek: number;
  allowedFormats: CbtFormat[];
  maxMaterialUploads: number;
};

export type SystemConfig = Doc<"systemConfig">;

/**
 * Fallback used only if systemConfig has not been seeded yet. The seed writes
 * the same values; admin editing later replaces this entirely.
 */
export const DEFAULT_FREE_LIMITS: PlanLimits = {
  maxCourses: 3,
  simulationsPerWeek: 3,
  simulationsPerCoursePerWeek: 1,
  allowedFormats: ["FORMAT_A"],
  maxMaterialUploads: 1,
};

export const DEFAULT_PLUS_LIMITS: PlanLimits = {
  maxCourses: 20,
  simulationsPerWeek: 30,
  simulationsPerCoursePerWeek: 10,
  allowedFormats: ["FORMAT_A", "FORMAT_B"],
  maxMaterialUploads: 20,
};

export const DEFAULT_PLUS_PRICE_NAIRA = 1000;

export async function getSystemConfig(
  ctx: QueryCtx,
): Promise<SystemConfig | null> {
  return await ctx.db
    .query("systemConfig")
    .withIndex("by_key", (q) => q.eq("key", "plans"))
    .first();
}

export function limitsForPlan(
  config: SystemConfig | null,
  plan: Plan,
): PlanLimits {
  if (plan === "PLUS") {
    const plus = config?.plus;
    if (!plus) {
      return { ...DEFAULT_PLUS_LIMITS };
    }
    return {
      maxCourses: plus.maxCourses,
      simulationsPerWeek: plus.simulationsPerWeek,
      simulationsPerCoursePerWeek: plus.simulationsPerCoursePerWeek,
      allowedFormats: plus.allowedFormats,
      maxMaterialUploads: plus.maxMaterialUploads,
    };
  }
  const free = config?.free;
  if (!free) {
    return { ...DEFAULT_FREE_LIMITS };
  }
  return {
    maxCourses: free.maxCourses,
    simulationsPerWeek: free.simulationsPerWeek,
    simulationsPerCoursePerWeek: free.simulationsPerCoursePerWeek,
    allowedFormats: free.allowedFormats,
    maxMaterialUploads: free.maxMaterialUploads,
  };
}

/**
 * Fixed weekly window based on Africa/Lagos time (UTC+1, no DST):
 * weeks start Monday 00:00 local. Quota lives on the account, so clearing
 * browser data or switching devices never resets it.
 */
export function lagosWeekStart(nowMs: number): number {
  const LAGOS_OFFSET_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const local = nowMs + LAGOS_OFFSET_MS;
  const localMidnight = Math.floor(local / DAY_MS) * DAY_MS;
  const weekday = new Date(localMidnight).getUTCDay(); // 0=Sun … 6=Sat
  const daysSinceMonday = (weekday + 6) % 7;
  return localMidnight - daysSinceMonday * DAY_MS - LAGOS_OFFSET_MS;
}

export type WeekUsage = {
  weekStart: number;
  simulations: number;
  perCourse: Record<string, number>;
};

/** Counts attempts started in the current Lagos week (active or submitted). */
export async function getWeekUsage(
  ctx: QueryCtx,
  userId: Id<"users">,
  now: number,
): Promise<WeekUsage> {
  const weekStart = lagosWeekStart(now);
  const attempts = await ctx.db
    .query("cbtAttempts")
    .withIndex("by_user_started", (q) =>
      q.eq("userId", userId).gte("startedAt", weekStart),
    )
    .collect();
  const perCourse: Record<string, number> = {};
  for (const attempt of attempts) {
    const key = attempt.courseId as string;
    perCourse[key] = (perCourse[key] ?? 0) + 1;
  }
  return {
    weekStart,
    simulations: attempts.length,
    perCourse,
  };
}

export async function countEnrollments(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<number> {
  const rows = await ctx.db
    .query("courseEnrollments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.length;
}
