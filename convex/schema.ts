import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * KefPrep data model.
 *
 * Tables marked "implemented" carry logic in this first vertical slice.
 * Tables marked "structure only" are defined now so later phases can build on a
 * stable schema without migrations; they have no behavior yet.
 */

export const questionSourceValidator = v.union(
  v.literal("PAST_QUESTION"),
  v.literal("LECTURER_PROVIDED"),
  v.literal("KEFPREP_GENERATED"),
  v.literal("PATTERN_BASED"),
  v.literal("OTHER_VERIFIED_SOURCE"),
);

export const difficultyValidator = v.union(
  v.literal("EASY"),
  v.literal("MEDIUM"),
  v.literal("HARD"),
);

export const planValidator = v.union(v.literal("FREE"), v.literal("PLUS"));
export const cbtFormatValidator = v.union(
  v.literal("FORMAT_A"),
  v.literal("FORMAT_B"),
);

export default defineSchema({
  // ── Identity ────────────────────────────────────────────────────────────
  // implemented: signup/login/sessions, role separation for future admin
  users: defineTable({
    fullName: v.string(),
    phone: v.string(), // normalized E.164-ish digits, used as login identifier
    passwordHash: v.string(), // PBKDF2-SHA256 encoded string, never plaintext
    role: v.union(v.literal("student"), v.literal("admin")),
    plan: planValidator,
    universityId: v.id("universities"),
    programmeId: v.id("programmes"),
    level: v.number(),
    matricNumber: v.optional(v.string()),
    isDemo: v.boolean(),
    createdAt: v.number(),
  }).index("by_phone", ["phone"]),

  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(), // SHA-256 of the bearer token; raw token never stored
    createdAt: v.number(),
    lastSeenAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["tokenHash"])
    .index("by_user", ["userId"]),

  // ── Academic structure ──────────────────────────────────────────────────
  // implemented: seeded, used by signup + course browsing
  universities: defineTable({
    name: v.string(),
    code: v.string(),
    isActive: v.boolean(),
    isDemo: v.boolean(),
    sortOrder: v.number(),
  }).index("by_active", ["isActive"]),

  programmes: defineTable({
    universityId: v.id("universities"),
    name: v.string(),
    isActive: v.boolean(),
    isDemo: v.boolean(),
    sortOrder: v.number(),
  }).index("by_university", ["universityId"]),

  levels: defineTable({
    label: v.string(),
    value: v.number(),
    sortOrder: v.number(),
    isDemo: v.boolean(),
  }),

  courses: defineTable({
    universityId: v.id("universities"),
    code: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    level: v.number(),
    // admin designates which courses Free students may enrol in (max per config)
    freeDesignated: v.boolean(),
    isActive: v.boolean(),
    isDemo: v.boolean(),
  })
    .index("by_university", ["universityId"])
    .index("by_university_active", ["universityId", "isActive"]),

  courseVersions: defineTable({
    courseId: v.id("courses"),
    label: v.string(),
    sessionLabel: v.optional(v.string()),
    isActive: v.boolean(),
    isDemo: v.boolean(),
  }).index("by_course", ["courseId"]),

  courseEnrollments: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    enrolledAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_course", ["userId", "courseId"]),

  topics: defineTable({
    courseId: v.id("courses"),
    name: v.string(),
    sortOrder: v.number(),
    isDemo: v.boolean(),
  }).index("by_course", ["courseId"]),

  // ── Question system ─────────────────────────────────────────────────────
  // implemented: demo bank, rotation input, review source labels
  questions: defineTable({
    courseVersionId: v.id("courseVersions"),
    courseId: v.id("courses"),
    topicId: v.id("topics"),
    text: v.string(),
    options: v.array(v.string()),
    correctOptionIndex: v.number(),
    explanation: v.string(),
    source: questionSourceValidator,
    sourceMeta: v.optional(
      v.object({
        year: v.optional(v.string()),
        semester: v.optional(v.string()),
        reference: v.optional(v.string()),
        label: v.optional(v.string()),
      }),
    ),
    difficulty: difficultyValidator,
    status: v.union(v.literal("ACTIVE"), v.literal("DISABLED")),
    isDemo: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_course_version", ["courseVersionId"])
    .index("by_version_topic", ["courseVersionId", "topicId"]),

  // ── CBT ─────────────────────────────────────────────────────────────────
  // implemented: formats/durations/marks are data, not hardcoded
  cbtTests: defineTable({
    courseVersionId: v.id("courseVersions"),
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    format: cbtFormatValidator,
    questionCount: v.number(),
    durationSeconds: v.number(),
    marksPerQuestion: v.number(),
    totalMarks: v.number(),
    isActive: v.boolean(),
    isDemo: v.boolean(),
  })
    .index("by_course_version", ["courseVersionId"])
    .index("by_course", ["courseId"]),

  cbtBlueprints: defineTable({
    testId: v.id("cbtTests"),
    courseVersionId: v.id("courseVersions"),
    topicQuotas: v.array(
      v.object({ topicId: v.id("topics"), count: v.number() }),
    ),
    sourcePriority: v.optional(v.array(questionSourceValidator)),
    notes: v.optional(v.string()),
  }).index("by_test", ["testId"]),

  cbtAttempts: defineTable({
    userId: v.id("users"),
    testId: v.id("cbtTests"),
    courseId: v.id("courses"),
    courseVersionId: v.id("courseVersions"),
    status: v.union(v.literal("ACTIVE"), v.literal("SUBMITTED")),
    submittedBy: v.optional(
      v.union(v.literal("MANUAL"), v.literal("AUTO")),
    ),
    startedAt: v.number(),
    deadlineAt: v.number(),
    submittedAt: v.optional(v.number()),
    // snapshots taken at start so later admin edits cannot rewrite history
    format: cbtFormatValidator,
    durationSeconds: v.number(),
    questionCount: v.number(),
    marksPerQuestion: v.number(),
    totalMarks: v.number(),
    questionIds: v.array(v.id("questions")),
    seed: v.string(), // drives deterministic question rotation for this attempt
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_started", ["userId", "startedAt"])
    .index("by_test", ["testId"]),

  attemptAnswers: defineTable({
    attemptId: v.id("cbtAttempts"),
    userId: v.id("users"),
    questionId: v.id("questions"),
    questionIndex: v.number(),
    selectedOptionIndex: v.union(v.number(), v.null()), // null = unanswered
    answeredAt: v.number(),
  })
    .index("by_attempt", ["attemptId"])
    .index("by_attempt_question", ["attemptId", "questionId"]),

  // implemented: written once at finalization, never modified afterwards
  results: defineTable({
    attemptId: v.id("cbtAttempts"),
    userId: v.id("users"),
    courseId: v.id("courses"),
    testId: v.id("cbtTests"),
    score: v.number(),
    maxScore: v.number(),
    percentage: v.number(),
    correctCount: v.number(),
    incorrectCount: v.number(),
    unansweredCount: v.number(),
    totalQuestions: v.number(),
    timeUsedSeconds: v.number(),
    topicBreakdown: v.array(
      v.object({
        topicId: v.id("topics"),
        topicName: v.string(),
        correct: v.number(),
        total: v.number(),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_attempt", ["attemptId"])
    .index("by_user", ["userId"]),

  questionHistory: defineTable({
    userId: v.id("users"),
    questionId: v.id("questions"),
    courseId: v.id("courses"),
    attemptId: v.id("cbtAttempts"),
    timesSeen: v.number(),
    timesCorrect: v.number(),
    timesIncorrect: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_user_question", ["userId", "questionId"])
    .index("by_user", ["userId"]),

  // ── Commercial (structure only — payments are NOT implemented) ──────────
  examSeasons: defineTable({
    universityId: v.id("universities"),
    name: v.string(),
    sessionLabel: v.string(),
    semester: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    status: v.union(
      v.literal("UPCOMING"),
      v.literal("ACTIVE"),
      v.literal("ENDED"),
    ),
  }).index("by_university", ["universityId"]),

  payments: defineTable({
    userId: v.id("users"),
    examSeasonId: v.optional(v.id("examSeasons")),
    amountNaira: v.number(),
    currency: v.string(),
    provider: v.string(),
    providerReference: v.string(),
    transactionId: v.optional(v.string()),
    status: v.union(
      v.literal("PENDING"),
      v.literal("SUCCESSFUL"),
      v.literal("FAILED"),
      v.literal("CANCELLED"),
    ),
    createdAt: v.number(),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_reference", ["providerReference"]),

  entitlements: defineTable({
    userId: v.id("users"),
    plan: planValidator,
    examSeasonId: v.optional(v.id("examSeasons")),
    sourcePaymentId: v.optional(v.id("payments")),
    grantedAt: v.number(),
    expiresAt: v.optional(v.number()),
    isActive: v.boolean(),
  }).index("by_user", ["userId"]),

  // ── Materials (structure only) ──────────────────────────────────────────
  studentMaterials: defineTable({
    ownerId: v.id("users"),
    courseId: v.id("courses"),
    title: v.string(),
    fileHash: v.string(), // SHA-256, future dedup
    storageKey: v.string(), // future file-storage abstraction
    sizeBytes: v.number(),
    contentType: v.string(),
    processingStatus: v.union(
      v.literal("UPLOADED"),
      v.literal("PROCESSING"),
      v.literal("READY"),
      v.literal("FAILED"),
    ),
    visibility: v.union(v.literal("PRIVATE"), v.literal("SHARED_VERIFIED")),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_hash", ["fileHash"]),

  // ── Communication (structure only) ──────────────────────────────────────
  notifications: defineTable({
    userId: v.optional(v.id("users")),
    kind: v.string(),
    title: v.string(),
    body: v.string(),
    audience: v.union(v.literal("ALL"), v.literal("SEGMENT")),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "readAt"]),

  // ── Analytics (implemented: core events from auth + CBT flow) ───────────
  analyticsEvents: defineTable({
    userId: v.optional(v.id("users")),
    name: v.string(),
    properties: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_name", ["name"]),

  // ── Backend-configurable product configuration ──────────────────────────
  // Limits live here, not in the frontend. Admin editing comes later.
  systemConfig: defineTable({
    key: v.string(),
    free: v.object({
      maxCourses: v.number(),
      simulationsPerWeek: v.number(),
      simulationsPerCoursePerWeek: v.number(),
      allowedFormats: v.array(cbtFormatValidator),
      maxMaterialUploads: v.number(),
    }),
    plus: v.object({
      priceNaira: v.number(),
      maxCourses: v.number(),
      simulationsPerWeek: v.number(),
      simulationsPerCoursePerWeek: v.number(),
      allowedFormats: v.array(cbtFormatValidator),
      maxMaterialUploads: v.number(),
    }),
    weeklyWindow: v.object({
      timezoneLabel: v.string(),
      resetHourLocal: v.number(),
      resetWeekdayLocal: v.number(), // 1 = Monday
    }),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
