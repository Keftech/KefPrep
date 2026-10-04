import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./lib/auth";
import { getSystemConfig, getWeekUsage, limitsForPlan } from "./lib/plans";
import { selectQuestions } from "./lib/rotation";
import { kfp } from "./lib/types";

/**
 * CBT engine.
 *
 * Server is authoritative for: start time, deadline, allowed question set,
 * answer recording, submission state and scoring. The client only mirrors a
 * countdown for display; it can never read correct answers, explanations or
 * scores while an attempt is active, and it can never modify a submission.
 *
 * Auto-submit has two independent safety nets:
 *   1. a scheduled internal mutation at deadline + grace (works even if the
 *      student closes the browser), and
 *   2. deadline enforcement inside answerQuestion/submitAttempt (works even
 *      if the scheduler is delayed).
 */

const AUTO_SUBMIT_GRACE_MS = 2000;

function assertOwner(attempt: Doc<"cbtAttempts">, userId: Id<"users">) {
  if (attempt.userId !== userId) {
    throw kfp("NOT_OWNER", "You do not have access to this attempt.");
  }
}

/**
 * Finalize an attempt exactly once: compute the score server-side, persist
 * the immutable result, close the attempt and update question history.
 */
async function finalizeAttempt(
  ctx: MutationCtx,
  attempt: Doc<"cbtAttempts">,
  submittedBy: "MANUAL" | "AUTO",
  now: number,
): Promise<void> {
  if (attempt.status === "SUBMITTED") return; // already finalized (idempotent)

  const answers = await ctx.db
    .query("attemptAnswers")
    .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id))
    .collect();
  const answerByQuestion = new Map<string, Doc<"attemptAnswers">>();
  for (const a of answers) answerByQuestion.set(a.questionId, a);

  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  const topicStats = new Map<string, { correct: number; total: number }>();

  for (const questionId of attempt.questionIds) {
    const question = await ctx.db.get(questionId);
    if (!question) continue;
    const topicKey = question.topicId as string;
    const stats = topicStats.get(topicKey) ?? { correct: 0, total: 0 };
    stats.total += 1;

    const answer = answerByQuestion.get(questionId);
    const answered = answer != null && answer.selectedOptionIndex !== null;
    if (!answered) {
      unanswered += 1;
    } else if (answer!.selectedOptionIndex === question.correctOptionIndex) {
      correct += 1;
      stats.correct += 1;
    } else {
      incorrect += 1;
    }
    topicStats.set(topicKey, stats);
  }

  const score = correct * attempt.marksPerQuestion;
  const maxScore = attempt.totalMarks;
  const percentage =
    maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;
  const effectiveEnd = Math.min(now, attempt.deadlineAt);
  const timeUsedSeconds = Math.max(
    0,
    Math.round((effectiveEnd - attempt.startedAt) / 1000),
  );

  const topicBreakdown: {
    topicId: Id<"topics">;
    topicName: string;
    correct: number;
    total: number;
  }[] = [];
  for (const [topicId, stats] of topicStats) {
    const topic = await ctx.db.get(topicId as Id<"topics">);
    topicBreakdown.push({
      topicId: topicId as Id<"topics">,
      topicName: topic?.name ?? "Unknown topic",
      correct: stats.correct,
      total: stats.total,
    });
  }

  await ctx.db.insert("results", {
    attemptId: attempt._id,
    userId: attempt.userId,
    courseId: attempt.courseId,
    testId: attempt.testId,
    score,
    maxScore,
    percentage,
    correctCount: correct,
    incorrectCount: incorrect,
    unansweredCount: unanswered,
    totalQuestions: attempt.questionCount,
    timeUsedSeconds,
    topicBreakdown,
    createdAt: now,
  });

  await ctx.db.patch(attempt._id, {
    status: "SUBMITTED",
    submittedBy,
    submittedAt: now,
  });

  // Question history feeds rotation + future performance analytics.
  for (const questionId of attempt.questionIds) {
    const question = await ctx.db.get(questionId);
    const row = await ctx.db
      .query("questionHistory")
      .withIndex("by_user_question", (q) =>
        q.eq("userId", attempt.userId).eq("questionId", questionId),
      )
      .first();
    const answered = answerByQuestion.get(questionId);
    const isCorrect =
      answered != null &&
      answered.selectedOptionIndex !== null &&
      question != null &&
      answered.selectedOptionIndex === question.correctOptionIndex;
    if (row) {
      await ctx.db.patch(row._id, {
        timesSeen: row.timesSeen + 1,
        timesCorrect: row.timesCorrect + (isCorrect ? 1 : 0),
        timesIncorrect:
          row.timesIncorrect +
          (answered != null &&
          answered.selectedOptionIndex !== null &&
          !isCorrect
            ? 1
            : 0),
        lastSeenAt: now,
        attemptId: attempt._id,
      });
    } else {
      await ctx.db.insert("questionHistory", {
        userId: attempt.userId,
        questionId,
        courseId: attempt.courseId,
        attemptId: attempt._id,
        timesSeen: 1,
        timesCorrect: isCorrect ? 1 : 0,
        timesIncorrect:
          answered != null && answered.selectedOptionIndex !== null && !isCorrect
            ? 1
            : 0,
        lastSeenAt: now,
      });
    }
  }

  await ctx.db.insert("analyticsEvents", {
    userId: attempt.userId,
    name: submittedBy === "AUTO" ? "cbt_auto_submitted" : "cbt_submitted",
    properties: {
      attemptId: attempt._id,
      testId: attempt.testId,
      courseId: attempt.courseId,
      score,
      maxScore,
    },
    createdAt: now,
  });
}

function randomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export const startAttempt = mutation({
  args: { sessionToken: v.string(), testId: v.id("cbtTests") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const test = await ctx.db.get(args.testId);
    if (!test || !test.isActive) {
      throw kfp("TEST_NOT_FOUND", "That CBT is not available.");
    }
    const enrollment = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", user._id).eq("courseId", test.courseId),
      )
      .first();
    if (!enrollment) {
      throw kfp(
        "NOT_ENROLLED",
        "Enrol in this course before starting a CBT.",
      );
    }

    const now = Date.now();

    // Cannot create a second active attempt: resume the existing one instead
    // (no pause, no restart, elapsed time keeps running).
    const activeList = await ctx.db
      .query("cbtAttempts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "ACTIVE"),
      )
      .collect();
    if (activeList.length > 0) {
      const active = activeList[0];
      if (now <= active.deadlineAt) {
        return {
          attemptId: active._id,
          resumed: true,
          startedNew: false,
          deadlineAt: active.deadlineAt,
          serverNow: now,
        };
      }
      // Expired while away: finalize (auto-submit) before starting anew.
      await finalizeAttempt(ctx, active, "AUTO", now);
    }

    const config = await getSystemConfig(ctx);
    const limits = limitsForPlan(config, user.plan);
    if (!limits.allowedFormats.includes(test.format)) {
      throw kfp(
        "FORMAT_NOT_ALLOWED",
        `Your ${user.plan} plan cannot take this test format yet.`,
      );
    }

    const usage = await getWeekUsage(ctx, user._id, now);
    if (usage.simulations >= limits.simulationsPerWeek) {
      throw kfp(
        "WEEKLY_LIMIT",
        `You have used all ${limits.simulationsPerWeek} simulations allowed on the ${user.plan} plan this week.`,
      );
    }
    const perCourse = usage.perCourse[test.courseId as string] ?? 0;
    if (perCourse >= limits.simulationsPerCoursePerWeek) {
      throw kfp(
        "COURSE_WEEKLY_LIMIT",
        `You have already used your ${limits.simulationsPerCoursePerWeek} simulation(s) for this course this week.`,
      );
    }

    const blueprint = await ctx.db
      .query("cbtBlueprints")
      .withIndex("by_test", (q) => q.eq("testId", test._id))
      .first();
    if (!blueprint) {
      throw kfp(
        "NO_BLUEPRINT",
        "This test has no blueprint configured yet. Contact support.",
      );
    }

    const candidateDocs = await ctx.db
      .query("questions")
      .withIndex("by_course_version", (q) =>
        q.eq("courseVersionId", test.courseVersionId),
      )
      .collect();
    const candidates = candidateDocs.filter((q) => q.status === "ACTIVE");

    const historyRows = await ctx.db
      .query("questionHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const seed = randomSeed();
    const questionIds = selectQuestions({
      candidates,
      quotas: blueprint.topicQuotas,
      questionCount: test.questionCount,
      seed,
      history: historyRows.map((h) => ({
        questionId: h.questionId,
        timesSeen: h.timesSeen,
        lastSeenAt: h.lastSeenAt,
      })),
      sourcePriority: blueprint.sourcePriority,
      now,
    });

    const deadlineAt = now + test.durationSeconds * 1000;
    const priorAttempts = await ctx.db
      .query("cbtAttempts")
      .withIndex("by_test", (q) => q.eq("testId", test._id))
      .collect();
    const isRetake = priorAttempts.some(
      (a) => a.userId === user._id && a.status === "SUBMITTED",
    );

    const attemptId = await ctx.db.insert("cbtAttempts", {
      userId: user._id,
      testId: test._id,
      courseId: test.courseId,
      courseVersionId: test.courseVersionId,
      status: "ACTIVE",
      startedAt: now,
      deadlineAt,
      format: test.format,
      durationSeconds: test.durationSeconds,
      questionCount: test.questionCount,
      marksPerQuestion: test.marksPerQuestion,
      totalMarks: test.totalMarks,
      questionIds,
      seed,
    });

    // Safety net #1: server-side auto-submission at the deadline.
    ctx.scheduler.runAfter(
      test.durationSeconds * 1000 + AUTO_SUBMIT_GRACE_MS,
      internal.cbt.autoSubmit,
      { attemptId },
    );

    await ctx.db.insert("analyticsEvents", {
      userId: user._id,
      name: isRetake ? "cbt_retake" : "cbt_started",
      properties: { attemptId, testId: test._id, courseId: test.courseId },
      createdAt: now,
    });

    return {
      attemptId,
      resumed: false,
      startedNew: true,
      deadlineAt,
      serverNow: now,
    };
  },
});

export const answerQuestion = mutation({
  args: {
    sessionToken: v.string(),
    attemptId: v.id("cbtAttempts"),
    questionId: v.id("questions"),
    selectedOptionIndex: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) throw kfp("ATTEMPT_NOT_FOUND", "Attempt not found.");
    assertOwner(attempt, user._id);
    if (attempt.status !== "ACTIVE") {
      throw kfp("ATTEMPT_CLOSED", "This attempt has already been submitted.");
    }

    const now = Date.now();
    if (now > attempt.deadlineAt) {
      // Safety net #2: enforce the deadline even if the scheduler lagged.
      await finalizeAttempt(ctx, attempt, "AUTO", now);
      throw kfp("TIME_EXPIRED", "Time is up. Your attempt was auto-submitted.");
    }

    const questionIndex = attempt.questionIds.indexOf(args.questionId);
    if (questionIndex < 0) {
      throw kfp(
        "QUESTION_NOT_IN_ATTEMPT",
        "That question is not part of this attempt.",
      );
    }
    const question = await ctx.db.get(args.questionId);
    if (!question) throw kfp("QUESTION_NOT_FOUND", "Question not found.");
    if (
      args.selectedOptionIndex !== null &&
      (args.selectedOptionIndex < 0 ||
        args.selectedOptionIndex >= question.options.length ||
        !Number.isInteger(args.selectedOptionIndex))
    ) {
      throw kfp("INVALID_ANSWER", "Invalid answer option.");
    }

    const existing = await ctx.db
      .query("attemptAnswers")
      .withIndex("by_attempt_question", (q) =>
        q.eq("attemptId", attempt._id).eq("questionId", args.questionId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        selectedOptionIndex: args.selectedOptionIndex,
        answeredAt: now,
      });
    } else {
      await ctx.db.insert("attemptAnswers", {
        attemptId: attempt._id,
        userId: user._id,
        questionId: args.questionId,
        questionIndex,
        selectedOptionIndex: args.selectedOptionIndex,
        answeredAt: now,
      });
    }
    return { saved: true, serverNow: now };
  },
});

export const submitAttempt = mutation({
  args: { sessionToken: v.string(), attemptId: v.id("cbtAttempts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) throw kfp("ATTEMPT_NOT_FOUND", "Attempt not found.");
    assertOwner(attempt, user._id);

    const now = Date.now();
    if (attempt.status === "SUBMITTED") {
      return {
        attemptId: attempt._id,
        status: "SUBMITTED" as const,
        alreadySubmitted: true,
        submittedBy: attempt.submittedBy ?? "MANUAL",
      };
    }
    const submittedBy: "MANUAL" | "AUTO" =
      now > attempt.deadlineAt ? "AUTO" : "MANUAL";
    await finalizeAttempt(ctx, attempt, submittedBy, now);
    return {
      attemptId: attempt._id,
      status: "SUBMITTED" as const,
      alreadySubmitted: false,
      submittedBy,
    };
  },
});

/** Scheduled at start time (deadline + grace). Idempotent. */
export const autoSubmit = internalMutation({
  args: { attemptId: v.id("cbtAttempts") },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.status !== "ACTIVE") return;
    await finalizeAttempt(ctx, attempt, "AUTO", Date.now());
  },
});

/**
 * Live attempt payload for the runner. While ACTIVE this never includes
 * correct answers, explanations, sources or scores.
 */
export const getAttempt = query({
  args: { sessionToken: v.string(), attemptId: v.id("cbtAttempts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) throw kfp("ATTEMPT_NOT_FOUND", "Attempt not found.");
    assertOwner(attempt, user._id);

    if (attempt.status === "SUBMITTED") {
      return {
        status: "SUBMITTED" as const,
        attemptId: attempt._id,
        submittedBy: attempt.submittedBy ?? null,
        serverNow: Date.now(),
      };
    }

    const now = Date.now();
    const [test, answers] = await Promise.all([
      ctx.db.get(attempt.testId),
      ctx.db
        .query("attemptAnswers")
        .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id))
        .collect(),
    ]);
    const selectedByQuestion = new Map<string, number | null>();
    for (const a of answers) {
      selectedByQuestion.set(a.questionId, a.selectedOptionIndex);
    }

    const questions = [];
    for (let i = 0; i < attempt.questionIds.length; i++) {
      const q = await ctx.db.get(attempt.questionIds[i]);
      if (!q) continue;
      questions.push({
        id: q._id,
        index: i,
        text: q.text,
        options: q.options,
        selectedOptionIndex: selectedByQuestion.get(q._id) ?? null,
      });
    }

    return {
      status: "ACTIVE" as const,
      attemptId: attempt._id,
      testId: attempt.testId,
      testTitle: test?.title ?? "CBT",
      format: attempt.format,
      questionCount: attempt.questionCount,
      marksPerQuestion: attempt.marksPerQuestion,
      totalMarks: attempt.totalMarks,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      serverNow: now,
      remainingMs: Math.max(0, attempt.deadlineAt - now),
      expired: now > attempt.deadlineAt,
      questions,
    };
  },
});

export const getResult = query({
  args: { sessionToken: v.string(), attemptId: v.id("cbtAttempts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) throw kfp("ATTEMPT_NOT_FOUND", "Attempt not found.");
    assertOwner(attempt, user._id);
    if (attempt.status !== "SUBMITTED") {
      throw kfp("NOT_READY", "This attempt has not been submitted yet.");
    }
    const [result, test, course] = await Promise.all([
      ctx.db
        .query("results")
        .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id))
        .first(),
      ctx.db.get(attempt.testId),
      ctx.db.get(attempt.courseId),
    ]);
    if (!result) throw kfp("RESULT_PENDING", "Result is being processed.");
    return {
      attemptId: attempt._id,
      status: attempt.status,
      submittedBy: attempt.submittedBy ?? null,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt ?? null,
      courseId: attempt.courseId,
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      unansweredCount: result.unansweredCount,
      totalQuestions: result.totalQuestions,
      timeUsedSeconds: result.timeUsedSeconds,
      topicBreakdown: result.topicBreakdown,
      format: attempt.format,
      testTitle: test?.title ?? "CBT",
      courseCode: course?.code ?? "",
      courseTitle: course?.title ?? "",
      courseDemo: course?.isDemo ?? false,
    };
  },
});

/** Corrections/explanations — available only after submission. */
export const getReview = query({
  args: { sessionToken: v.string(), attemptId: v.id("cbtAttempts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) throw kfp("ATTEMPT_NOT_FOUND", "Attempt not found.");
    assertOwner(attempt, user._id);
    if (attempt.status !== "SUBMITTED") {
      throw kfp(
        "NOT_READY",
        "Corrections become available only after the attempt is submitted.",
      );
    }

    const [result, answers] = await Promise.all([
      ctx.db
        .query("results")
        .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id))
        .first(),
      ctx.db
        .query("attemptAnswers")
        .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id))
        .collect(),
    ]);
    const answerByQuestion = new Map<string, Doc<"attemptAnswers">>();
    for (const a of answers) answerByQuestion.set(a.questionId, a);

    const items = [];
    for (let i = 0; i < attempt.questionIds.length; i++) {
      const q = await ctx.db.get(attempt.questionIds[i]);
      if (!q) continue;
      const topic = await ctx.db.get(q.topicId);
      const answer = answerByQuestion.get(q._id);
      const selectedIndex =
        answer != null ? answer.selectedOptionIndex : null;
      const status =
        selectedIndex === null
          ? ("UNANSWERED" as const)
          : selectedIndex === q.correctOptionIndex
            ? ("CORRECT" as const)
            : ("INCORRECT" as const);
      items.push({
        index: i,
        questionId: q._id,
        text: q.text,
        options: q.options,
        yourAnswerIndex: selectedIndex,
        yourAnswerText:
          selectedIndex === null ? null : q.options[selectedIndex] ?? null,
        correctOptionIndex: q.correctOptionIndex,
        correctAnswerText: q.options[q.correctOptionIndex] ?? "",
        status,
        explanation: q.explanation,
        source: q.source,
        sourceMeta: q.sourceMeta ?? null,
        isDemo: q.isDemo,
        topicName: topic?.name ?? "Unknown topic",
        difficulty: q.difficulty,
      });
    }

    return {
      attemptId: attempt._id,
      submittedBy: attempt.submittedBy ?? null,
      summary: result
        ? {
            score: result.score,
            maxScore: result.maxScore,
            percentage: result.percentage,
            correctCount: result.correctCount,
            incorrectCount: result.incorrectCount,
            unansweredCount: result.unansweredCount,
            totalQuestions: result.totalQuestions,
            timeUsedSeconds: result.timeUsedSeconds,
          }
        : null,
      items,
    };
  },
});

export const listMyAttempts = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const attempts = await ctx.db
      .query("cbtAttempts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    attempts.sort((a, b) => b.startedAt - a.startedAt);

    const out = [];
    for (const attempt of attempts.slice(0, 20)) {
      const [test, course, result] = await Promise.all([
        ctx.db.get(attempt.testId),
        ctx.db.get(attempt.courseId),
        ctx.db
          .query("results")
          .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id))
          .first(),
      ]);
      out.push({
        attemptId: attempt._id,
        status: attempt.status,
        submittedBy: attempt.submittedBy ?? null,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt ?? null,
        deadlineAt: attempt.deadlineAt,
        testId: attempt.testId,
        testTitle: test?.title ?? "CBT",
        format: attempt.format,
        courseId: attempt.courseId,
        courseCode: course?.code ?? "",
        courseTitle: course?.title ?? "",
        score: result?.score ?? null,
        maxScore: result?.maxScore ?? null,
        percentage: result?.percentage ?? null,
      });
    }
    return out;
  },
});

/** Live plan + quota state; the UI displays it, mutations enforce it. */
export const getPlanStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const config = await getSystemConfig(ctx);
    const limits = limitsForPlan(config, user.plan);
    const usage = await getWeekUsage(ctx, user._id, Date.now());
    const enrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return {
      plan: user.plan,
      limits,
      plusPriceNaira: config?.plus?.priceNaira ?? 1000,
      usage: {
        weekStart: usage.weekStart,
        simulationsThisWeek: usage.simulations,
        enrolledCourses: enrollments.length,
        perCourse: usage.perCourse,
      },
    };
  },
});
