import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { hashPassword } from "./lib/auth";
import {
  CSC_QUESTIONS,
  CSC_QUOTA_A,
  CSC_TOPICS,
  MATH_QUESTIONS,
  MATH_QUOTA_A,
  MATH_TOPICS,
  type DemoQuestionSeed,
} from "./seedData/questions";

/**
 * Development seed — idempotent.
 *
 * Everything written here is clearly marked demo data (isDemo = true) and is
 * NEVER represented as IBBUL past questions. The university/programme records
 * are structural only; all course content is KefPrep demo material with
 * source = KEFPREP_GENERATED.
 */

const DEMO_PHONE = "08000000000"; // → normalized 2348000000000
const DEMO_PASSWORD = "DemoPass123";

async function insertDemoQuestions(
  ctx: MutationCtx,
  courseVersionId: Id<"courseVersions">,
  courseId: Id<"courses">,
  topicIds: Record<string, Id<"topics">>,
  questions: DemoQuestionSeed[],
): Promise<Record<string, Id<"questions">[]>> {
  const byTopic: Record<string, Id<"questions">[]> = {};
  const now = Date.now();
  for (const q of questions) {
    const topicId = topicIds[q.t];
    if (!topicId) continue;
    const id = await ctx.db.insert("questions", {
      courseVersionId,
      courseId,
      topicId,
      text: q.q,
      options: [...q.o],
      correctOptionIndex: q.a,
      explanation: q.e,
      source: "KEFPREP_GENERATED",
      sourceMeta: {
        label: "KefPrep demo question — not an IBBUL past question",
      },
      difficulty: q.d,
      status: "ACTIVE",
      isDemo: true,
      createdAt: now,
    });
    (byTopic[q.t] ??= []).push(id);
  }
  return byTopic;
}

export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const existingConfig = await ctx.db
      .query("systemConfig")
      .withIndex("by_key", (q) => q.eq("key", "plans"))
      .first();
    if (existingConfig) {
      return { ok: true, alreadySeeded: true };
    }

    // ── Academic structure ──────────────────────────────────────────────
    const universityId = await ctx.db.insert("universities", {
      name: "Ibrahim Badamasi Babangida University, Lapai",
      code: "IBBUL",
      isActive: true,
      isDemo: false,
      sortOrder: 1,
    });

    const programmeIds: Id<"programmes">[] = [];
    const programmeNames = [
      "B.Sc Computer Science",
      "B.Sc Mathematics",
      "B.Sc Economics",
    ];
    for (let i = 0; i < programmeNames.length; i++) {
      programmeIds.push(
        await ctx.db.insert("programmes", {
          universityId,
          name: programmeNames[i],
          isActive: true,
          isDemo: false,
          sortOrder: i + 1,
        }),
      );
    }

    for (const [i, value] of [100, 200, 300, 400, 500].entries()) {
      await ctx.db.insert("levels", {
        label: `${value} Level`,
        value,
        sortOrder: i + 1,
        isDemo: false,
      });
    }

    // ── Demo courses ────────────────────────────────────────────────────
    const mathCourseId = await ctx.db.insert("courses", {
      universityId,
      code: "DEMO-MTH101",
      title: "General Mathematics (Demo Course)",
      description:
        "Demo course for testing KefPrep. Contains KefPrep-generated practice questions — not past questions.",
      level: 100,
      freeDesignated: true,
      isActive: true,
      isDemo: true,
    });
    const cscCourseId = await ctx.db.insert("courses", {
      universityId,
      code: "DEMO-CSC101",
      title: "Introduction to Computing (Demo Course)",
      description:
        "Demo course for testing KefPrep. Contains KefPrep-generated practice questions — not past questions.",
      level: 100,
      freeDesignated: true,
      isActive: true,
      isDemo: true,
    });

    const mathVersionId = await ctx.db.insert("courseVersions", {
      courseId: mathCourseId,
      label: "Demo Version",
      sessionLabel: "2026/2027 First Semester",
      isActive: true,
      isDemo: true,
    });
    const cscVersionId = await ctx.db.insert("courseVersions", {
      courseId: cscCourseId,
      label: "Demo Version",
      sessionLabel: "2026/2027 First Semester",
      isActive: true,
      isDemo: true,
    });

    // ── Topics ──────────────────────────────────────────────────────────
    const mathTopics: Record<string, Id<"topics">> = {};
    for (const [i, name] of MATH_TOPICS.entries()) {
      mathTopics[name] = await ctx.db.insert("topics", {
        courseId: mathCourseId,
        name,
        sortOrder: i + 1,
        isDemo: true,
      });
    }
    const cscTopics: Record<string, Id<"topics">> = {};
    for (const [i, name] of CSC_TOPICS.entries()) {
      cscTopics[name] = await ctx.db.insert("topics", {
        courseId: cscCourseId,
        name,
        sortOrder: i + 1,
        isDemo: true,
      });
    }

    // ── Demo questions ──────────────────────────────────────────────────
    await insertDemoQuestions(
      ctx,
      mathVersionId,
      mathCourseId,
      mathTopics,
      MATH_QUESTIONS,
    );
    await insertDemoQuestions(
      ctx,
      cscVersionId,
      cscCourseId,
      cscTopics,
      CSC_QUESTIONS,
    );

    // ── CBT tests + blueprints (formats are data, not hardcoded) ────────
    const fmtA = {
      format: "FORMAT_A" as const,
      questionCount: 35,
      durationSeconds: 900,
      marksPerQuestion: 2,
      totalMarks: 70,
    };
    const fmtB = {
      format: "FORMAT_B" as const,
      questionCount: 70,
      durationSeconds: 1800,
      marksPerQuestion: 1,
      totalMarks: 70,
    };

    const mathTestA = await ctx.db.insert("cbtTests", {
      courseVersionId: mathVersionId,
      courseId: mathCourseId,
      title: "Mathematics CBT — 35 Questions (Demo)",
      description: "Format A: 35 questions, 15 minutes, 2 marks each.",
      ...fmtA,
      isActive: true,
      isDemo: true,
    });
    const mathTestB = await ctx.db.insert("cbtTests", {
      courseVersionId: mathVersionId,
      courseId: mathCourseId,
      title: "Mathematics CBT — 70 Questions (Demo)",
      description: "Format B: 70 questions, 30 minutes, 1 mark each.",
      ...fmtB,
      isActive: true,
      isDemo: true,
    });
    const cscTestA = await ctx.db.insert("cbtTests", {
      courseVersionId: cscVersionId,
      courseId: cscCourseId,
      title: "Computing CBT — 35 Questions (Demo)",
      description: "Format A: 35 questions, 15 minutes, 2 marks each.",
      ...fmtA,
      isActive: true,
      isDemo: true,
    });
    // Short demo utility used to observe the server timer + auto-submission.
    const timingTest = await ctx.db.insert("cbtTests", {
      courseVersionId: cscVersionId,
      courseId: cscCourseId,
      title: "Timing Check — 45s Auto-Submit (Demo utility)",
      description:
        "Short demo test (5 questions, 45 seconds) for verifying the server timer and automatic submission.",
      format: "FORMAT_A",
      questionCount: 5,
      durationSeconds: 45,
      marksPerQuestion: 2,
      totalMarks: 10,
      isActive: true,
      isDemo: true,
    });

    const sourcePriority = [
      "PAST_QUESTION",
      "LECTURER_PROVIDED",
      "OTHER_VERIFIED_SOURCE",
      "PATTERN_BASED",
      "KEFPREP_GENERATED",
    ] as const;

    await ctx.db.insert("cbtBlueprints", {
      testId: mathTestA,
      courseVersionId: mathVersionId,
      topicQuotas: MATH_TOPICS.map((name) => ({
        topicId: mathTopics[name],
        count: MATH_QUOTA_A[name],
      })),
      sourcePriority: [...sourcePriority],
      notes: "Demo blueprint (Format A): Algebra 10, Trig 8, Functions 7, Stats 5, Other 5.",
    });
    await ctx.db.insert("cbtBlueprints", {
      testId: mathTestB,
      courseVersionId: mathVersionId,
      topicQuotas: MATH_TOPICS.map((name) => ({
        topicId: mathTopics[name],
        count: MATH_QUESTIONS.filter((q) => q.t === name).length,
      })),
      sourcePriority: [...sourcePriority],
      notes: "Demo blueprint (Format B): full demo bank distributed by topic.",
    });
    await ctx.db.insert("cbtBlueprints", {
      testId: cscTestA,
      courseVersionId: cscVersionId,
      topicQuotas: CSC_TOPICS.map((name) => ({
        topicId: cscTopics[name],
        count: CSC_QUOTA_A[name],
      })),
      sourcePriority: [...sourcePriority],
      notes: "Demo blueprint (Format A): Fundamentals 10, Hardware 8, Software 8, Data 9.",
    });
    await ctx.db.insert("cbtBlueprints", {
      testId: timingTest,
      courseVersionId: cscVersionId,
      // Sum (35) is proportionally scaled down to the test's 5 questions.
      topicQuotas: CSC_TOPICS.map((name) => ({
        topicId: cscTopics[name],
        count: CSC_QUOTA_A[name],
      })),
      sourcePriority: [...sourcePriority],
      notes: "Timing-check blueprint — scaled from the Format A distribution.",
    });

    // ── Backend-configurable FREE/PLUS limits ───────────────────────────
    await ctx.db.insert("systemConfig", {
      key: "plans",
      free: {
        maxCourses: 3,
        simulationsPerWeek: 3,
        simulationsPerCoursePerWeek: 1,
        allowedFormats: ["FORMAT_A"],
        maxMaterialUploads: 1,
      },
      plus: {
        priceNaira: 1000,
        maxCourses: 20,
        simulationsPerWeek: 30,
        simulationsPerCoursePerWeek: 10,
        allowedFormats: ["FORMAT_A", "FORMAT_B"],
        maxMaterialUploads: 20,
      },
      weeklyWindow: {
        timezoneLabel: "Africa/Lagos",
        resetHourLocal: 0,
        resetWeekdayLocal: 1,
      },
      updatedAt: Date.now(),
    });

    // ── Demo student (PLUS) so the full loop incl. retake can be tested ─
    const existingDemo = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", "2348000000000"))
      .first();
    if (!existingDemo) {
      const demoUserId = await ctx.db.insert("users", {
        fullName: "Demo Student",
        phone: "2348000000000",
        passwordHash: await hashPassword(DEMO_PASSWORD),
        role: "student",
        plan: "PLUS",
        universityId,
        programmeId: programmeIds[0],
        level: 100,
        isDemo: true,
        createdAt: Date.now(),
      });
      for (const courseId of [mathCourseId, cscCourseId]) {
        await ctx.db.insert("courseEnrollments", {
          userId: demoUserId,
          courseId,
          enrolledAt: Date.now(),
        });
      }
    }

    return {
      ok: true,
      alreadySeeded: false,
      demoLogin: { phone: DEMO_PHONE, password: DEMO_PASSWORD },
    };
  },
});
