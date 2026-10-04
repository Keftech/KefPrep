import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import {
  countEnrollments,
  getSystemConfig,
  getWeekUsage,
  limitsForPlan,
} from "./lib/plans";
import { kfp } from "./lib/types";

export const listUniversities = query({
  args: {},
  handler: async (ctx) => {
    const universities = await ctx.db
      .query("universities")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    return universities
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((u) => ({ id: u._id, name: u.name, code: u.code, isDemo: u.isDemo }));
  },
});

export const listProgrammes = query({
  args: { universityId: v.id("universities") },
  handler: async (ctx, args) => {
    const programmes = await ctx.db
      .query("programmes")
      .withIndex("by_university", (q) =>
        q.eq("universityId", args.universityId),
      )
      .collect();
    return programmes
      .filter((p) => p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({ id: p._id, name: p.name }));
  },
});

export const listLevels = query({
  args: {},
  handler: async (ctx) => {
    const levels = await ctx.db.query("levels").collect();
    return levels
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({ value: l.value, label: l.label }));
  },
});

/**
 * Courses available to the signed-in student, with enrolment state and the
 * account's live plan/usage so the UI never hardcodes limits.
 */
export const listCourses = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const config = await getSystemConfig(ctx);
    const limits = limitsForPlan(config, user.plan);
    const now = Date.now();

    const [courses, enrollments, usage, enrolledCount] = await Promise.all([
      ctx.db
        .query("courses")
        .withIndex("by_university_active", (q) =>
          q.eq("universityId", user.universityId).eq("isActive", true),
        )
        .collect(),
      ctx.db
        .query("courseEnrollments")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      getWeekUsage(ctx, user._id, now),
      countEnrollments(ctx, user._id),
    ]);

    const enrolledIds = new Set(enrollments.map((e) => e.courseId as string));
    return {
      plan: user.plan,
      limits,
      usage: {
        weekStart: usage.weekStart,
        simulations: usage.simulations,
        enrolledCourses: enrolledCount,
      },
      courses: courses
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((c) => ({
          id: c._id,
          code: c.code,
          title: c.title,
          description: c.description ?? null,
          level: c.level,
          freeDesignated: c.freeDesignated,
          isDemo: c.isDemo,
          enrolled: enrolledIds.has(c._id as string),
          eligibleForPlan:
            user.plan === "PLUS" || c.freeDesignated,
          simulationsThisWeek: usage.perCourse[c._id as string] ?? 0,
        })),
    };
  },
});

export const enrollCourse = mutation({
  args: { sessionToken: v.string(), courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const course = await ctx.db.get(args.courseId);
    if (!course || !course.isActive || course.universityId !== user.universityId) {
      throw kfp("COURSE_NOT_FOUND", "That course is not available.");
    }

    const existing = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId),
      )
      .first();
    if (existing) return { enrollmentId: existing._id, alreadyEnrolled: true };

    const config = await getSystemConfig(ctx);
    const limits = limitsForPlan(config, user.plan);
    const enrolledCount = await countEnrollments(ctx, user._id);
    if (enrolledCount >= limits.maxCourses) {
      throw kfp(
        "COURSE_LIMIT",
        `Your ${user.plan} plan allows a maximum of ${limits.maxCourses} courses. Remove a course to add another.`,
      );
    }
    if (user.plan === "FREE" && !course.freeDesignated) {
      throw kfp(
        "COURSE_NOT_FREE",
        "This course is not on the Free plan list. PLUS is required.",
      );
    }

    const enrollmentId = await ctx.db.insert("courseEnrollments", {
      userId: user._id,
      courseId: args.courseId,
      enrolledAt: Date.now(),
    });
    await ctx.db.insert("analyticsEvents", {
      userId: user._id,
      name: "course_selected",
      properties: { courseId: args.courseId },
      createdAt: Date.now(),
    });
    return { enrollmentId, alreadyEnrolled: false };
  },
});

export const unenrollCourse = mutation({
  args: { sessionToken: v.string(), courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const existing = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

/** CBT selection data for one course. */
export const listTests = query({
  args: { sessionToken: v.string(), courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const course = await ctx.db.get(args.courseId);
    if (!course || course.universityId !== user.universityId) {
      throw kfp("COURSE_NOT_FOUND", "That course is not available.");
    }

    const enrollment = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId),
      )
      .first();

    const config = await getSystemConfig(ctx);
    const limits = limitsForPlan(config, user.plan);
    const usage = await getWeekUsage(ctx, user._id, Date.now());
    const perCourse = usage.perCourse[course._id as string] ?? 0;

    const tests = await ctx.db
      .query("cbtTests")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const activeAttempts = await ctx.db
      .query("cbtAttempts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "ACTIVE"),
      )
      .collect();
    const activeAttempt = activeAttempts[0]
      ? {
          attemptId: activeAttempts[0]._id,
          testId: activeAttempts[0].testId,
          courseId: activeAttempts[0].courseId,
          deadlineAt: activeAttempts[0].deadlineAt,
        }
      : null;

    return {
      course: {
        id: course._id,
        code: course.code,
        title: course.title,
        isDemo: course.isDemo,
      },
      enrolled: !!enrollment,
      plan: user.plan,
      limits,
      usage: {
        weekStart: usage.weekStart,
        simulationsThisWeek: usage.simulations,
        simulationsThisCourseThisWeek: perCourse,
      },
      activeAttempt,
      tests: tests
        .filter((t) => t.isActive)
        .sort((a, b) => a.questionCount - b.questionCount)
        .map((t) => ({
          id: t._id,
          title: t.title,
          description: t.description ?? null,
          format: t.format,
          questionCount: t.questionCount,
          durationSeconds: t.durationSeconds,
          marksPerQuestion: t.marksPerQuestion,
          totalMarks: t.totalMarks,
          isDemo: t.isDemo,
          formatAllowed: limits.allowedFormats.includes(t.format),
        })),
    };
  },
});
