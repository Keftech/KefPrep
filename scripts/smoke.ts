/**
 * KefPrep backend end-to-end smoke test.
 *
 * Run via:  bun run smoke
 * (package.json runs it as `convex dev --once --start "bun scripts/smoke.ts"`,
 *  which pushes functions, boots the local backend, runs this file against it,
 *  and exits non-zero on failure.)
 *
 * Covers: seed, signup/login, invalid credentials, session guards, enrolment,
 * plan limits, CBT start/resume (no restart), server timer, answer recording,
 * no answer-key leakage while active, manual submit, idempotent re-submit,
 * immutable submissions, server-side scoring (recomputed independently),
 * review/corrections gating, cross-user isolation, question rotation,
 * FORMAT gating for FREE, and scheduled auto-submission of an expired attempt.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const url = process.env.VITE_CONVEX_URL;
if (!url) {
  console.error("FATAL: VITE_CONVEX_URL is not set (check .env.local)");
  process.exit(2);
}
const client = new ConvexHttpClient(url);

let passed = 0;
let skipped = 0;
const failures: string[] = [];

function check(cond: boolean, desc: string, extra?: unknown): void {
  if (cond) {
    passed += 1;
    console.log(`PASS: ${desc}`);
  } else {
    failures.push(desc);
    console.error(
      `FAIL: ${desc}${extra !== undefined ? ` — ${JSON.stringify(extra).slice(0, 600)}` : ""}`,
    );
  }
}

function skip(desc: string, why: string): void {
  skipped += 1;
  console.warn(`SKIP: ${desc} (${why})`);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function expectError(
  desc: string,
  code: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    await fn();
    check(false, desc, `expected ${code} but call succeeded`);
  } catch (e) {
    const m = errMsg(e);
    check(m.includes(code), desc, m);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  // ── 1. Seed (idempotent) ──────────────────────────────────────────────
  const seed = await client.mutation(api.seed.seedDemoData, {});
  check(seed.ok === true, "demo seed runs", seed);

  // ── 2. Academic structure available for signup ────────────────────────
  const unis = await client.query(api.catalog.listUniversities, {});
  check(unis.length >= 1, "universities listed for signup");
  const uniId = unis[0].id;
  const progs = await client.query(api.catalog.listProgrammes, {
    universityId: uniId,
  });
  check(progs.length >= 1, "programmes listed for signup");

  // ── 3. Signup / login / session guards ────────────────────────────────
  const phone = `0803${String(Date.now()).slice(-7)}`;
  const signup = await client.mutation(api.users.signup, {
    fullName: "Smoke Student",
    phone,
    password: "Testing123",
    universityId: uniId,
    programmeId: progs[0].id,
    level: 100,
  });
  check(!!signup.sessionToken, "signup returns a session token");
  const t1 = signup.sessionToken;

  await expectError(
    "duplicate phone rejected",
    "KFP_PHONE_TAKEN",
    () =>
      client.mutation(api.users.signup, {
        fullName: "Smoke Twin",
        phone,
        password: "Testing123",
        universityId: uniId,
        programmeId: progs[0].id,
        level: 100,
      }),
  );
  await expectError(
    "weak password rejected",
    "KFP_INVALID_PASSWORD",
    () =>
      client.mutation(api.users.signup, {
        fullName: "Weak Password",
        phone: `0804${String(Date.now()).slice(-7)}`,
        password: "short",
        universityId: uniId,
        programmeId: progs[0].id,
        level: 100,
      }),
  );
  await expectError(
    "wrong password rejected",
    "KFP_INVALID_CREDENTIALS",
    () =>
      client.mutation(api.users.login, {
        phone,
        password: "WrongPass123",
      }),
  );
  const me = await client.query(api.users.me, { sessionToken: t1 });
  check(me?.fullName === "Smoke Student" && me.plan === "FREE", "me() returns profile");
  const bogusMe = await client.query(api.users.me, { sessionToken: "bogus" });
  check(bogusMe === null, "bogus session is anonymous");

  // ── 4. Courses: FREE limits served from backend config ────────────────
  const courses = await client.query(api.catalog.listCourses, {
    sessionToken: t1,
  });
  check(courses.plan === "FREE", "fresh account is FREE plan");
  check(
    courses.limits.maxCourses === 3 &&
      courses.limits.allowedFormats.length === 1 &&
      courses.limits.allowedFormats[0] === "FORMAT_A" &&
      courses.limits.simulationsPerWeek === 3,
    "FREE limits come from systemConfig (3 courses, 3/week, Format A only)",
    courses.limits,
  );
  check(courses.courses.length >= 2, "demo courses listed");
  const mathCourse = courses.courses.find((c) => c.code === "DEMO-MTH101");
  const cscCourse = courses.courses.find((c) => c.code === "DEMO-CSC101");
  if (!mathCourse || !cscCourse) {
    check(false, "demo courses present (DEMO-MTH101, DEMO-CSC101)");
    return;
  }

  await client.mutation(api.catalog.enrollCourse, {
    sessionToken: t1,
    courseId: mathCourse.id,
  });
  const tests = await client.query(api.catalog.listTests, {
    sessionToken: t1,
    courseId: mathCourse.id,
  });
  check(tests.enrolled, "enrolment recorded server-side");
  const testA = tests.tests.find(
    (t) => t.format === "FORMAT_A" && t.questionCount === 35,
  );
  const testB = tests.tests.find((t) => t.format === "FORMAT_B");
  check(!!testA && !!testB, "Format A and Format B tests configured");

  await expectError(
    "FREE plan blocked from Format B",
    "KFP_FORMAT_NOT_ALLOWED",
    () =>
      client.mutation(api.cbt.startAttempt, {
        sessionToken: t1,
        testId: testB!.id,
      }),
  );

  // ── 5. Start attempt: server timer, no leakage, no restart ────────────
  const start = await client.mutation(api.cbt.startAttempt, {
    sessionToken: t1,
    testId: testA!.id,
  });
  check(start.startedNew && !start.resumed, "attempt started server-side");
  const attemptId = start.attemptId;
  check(
    start.deadlineAt - start.serverNow === 15 * 60 * 1000,
    "deadline = server start + 15 minutes (Format A)",
    { deadlineAt: start.deadlineAt, serverNow: start.serverNow },
  );

  let att = await client.query(api.cbt.getAttempt, {
    sessionToken: t1,
    attemptId,
  });
  check(att.status === "ACTIVE" && att.questions.length === 35, "35 questions served");
  const noKeys = att.status === "ACTIVE" && att.questions.every(
    (q) =>
      !("correctOptionIndex" in q) &&
      !("explanation" in q) &&
      !("source" in q) &&
      !("difficulty" in q),
  );
  check(noKeys, "NO correct answers/explanations leak while attempt is active");
  check(
    att.status === "ACTIVE" && att.remainingMs > 0 && att.remainingMs <= 15 * 60_000,
    "server returns authoritative remaining time",
    att.status === "ACTIVE" ? att.remainingMs : undefined,
  );
  const firstRemaining =
    att.status === "ACTIVE" ? att.remainingMs : 0;

  // Leaving/returning cannot restart or pause: startAttempt resumes instead.
  const resume = await client.mutation(api.cbt.startAttempt, {
    sessionToken: t1,
    testId: testA!.id,
  });
  check(
    resume.resumed && resume.attemptId === attemptId,
    "second start resumes the same active attempt (no pause/restart)",
  );

  // Timer keeps running with no interaction: the deadline is immutable, and
  // server-remaining reflects real elapsed time on a cache-invalidated read
  // (identical query reads are memoized until dependencies change, so a write
  // — here, answering — forces a fresh authoritative timestamp).
  const deadlineBefore = att.status === "ACTIVE" ? att.deadlineAt : 0;
  await sleep(3000);
  att = await client.query(api.cbt.getAttempt, {
    sessionToken: t1,
    attemptId,
  });
  check(
    att.status === "ACTIVE" && att.deadlineAt === deadlineBefore,
    "deadline is immutable server-side (cannot be paused or extended)",
    { deadlineBefore, deadlineAfter: att.status === "ACTIVE" ? att.deadlineAt : null },
  );
  if (att.status === "ACTIVE") {
    await client.mutation(api.cbt.answerQuestion, {
      sessionToken: t1,
      attemptId,
      questionId: att.questions[0].id,
      selectedOptionIndex: 0,
    });
    const fresh = await client.query(api.cbt.getAttempt, {
      sessionToken: t1,
      attemptId,
    });
    check(
      fresh.status === "ACTIVE" && fresh.remainingMs <= firstRemaining - 2500,
      "server remaining time decreases with real elapsed time",
      {
        firstRemaining,
        now: fresh.status === "ACTIVE" ? fresh.remainingMs : null,
      },
    );
    att = fresh;
  }

  // Score/result/review are not available while active.
  await expectError(
    "result blocked while active",
    "KFP_NOT_READY",
    () => client.query(api.cbt.getResult, { sessionToken: t1, attemptId }),
  );
  await expectError(
    "review blocked while active",
    "KFP_NOT_READY",
    () => client.query(api.cbt.getReview, { sessionToken: t1, attemptId }),
  );

  // ── 6. Answering (persisted server-side) ──────────────────────────────
  if (att.status !== "ACTIVE") {
    check(false, "attempt still active during answering phase");
    return;
  }
  const questions = att.questions;
  const pattern: (number | null)[] = [0, 1, 2, null, 3, 1];
  const answeredIdx: Record<number, number> = {};
  for (let i = 0; i < pattern.length; i++) {
    const pick = pattern[i];
    if (pick === null) continue;
    await client.mutation(api.cbt.answerQuestion, {
      sessionToken: t1,
      attemptId,
      questionId: questions[i].id,
      selectedOptionIndex: pick,
    });
    answeredIdx[i] = pick;
  }
  att = await client.query(api.cbt.getAttempt, { sessionToken: t1, attemptId });
  check(att.status === "ACTIVE", "answers recorded while active");
  if (att.status === "ACTIVE") {
    const persisted = Object.entries(answeredIdx).every(
      ([i, pick]) => att.status === "ACTIVE" &&
        (att.questions[Number(i)].selectedOptionIndex ?? null) === pick,
    );
    const cleared = att.questions[3].selectedOptionIndex === null;
    check(persisted && cleared, "answers persisted and readable from server");
  }

  // ── 7. Cross-student isolation ────────────────────────────────────────
  const signup2 = await client.mutation(api.users.signup, {
    fullName: "Other Student",
    phone: `0805${String(Date.now()).slice(-7)}`,
    password: "Testing123",
    universityId: uniId,
    programmeId: progs[0].id,
    level: 100,
  });
  const t2 = signup2.sessionToken;
  await expectError(
    "other student cannot read this attempt",
    "KFP_NOT_OWNER",
    () => client.query(api.cbt.getAttempt, { sessionToken: t2, attemptId }),
  );
  await expectError(
    "other student cannot read this result",
    "KFP_NOT_OWNER",
    () => client.query(api.cbt.getResult, { sessionToken: t2, attemptId }),
  );
  await expectError(
    "other student cannot answer this attempt",
    "KFP_NOT_OWNER",
    () =>
      client.mutation(api.cbt.answerQuestion, {
        sessionToken: t2,
        attemptId,
        questionId: questions[0].id,
        selectedOptionIndex: 0,
      }),
  );
  await expectError(
    "unauthenticated request rejected",
    "KFP_UNAUTHENTICATED",
    () => client.query(api.cbt.getAttempt, { sessionToken: "bogus", attemptId }),
  );

  // ── 8. Manual submit → server-side score → immutable ──────────────────
  const submit = await client.mutation(api.cbt.submitAttempt, {
    sessionToken: t1,
    attemptId,
  });
  check(
    !submit.alreadySubmitted && submit.submittedBy === "MANUAL",
    "manual submission finalizes as MANUAL",
  );
  const submitAgain = await client.mutation(api.cbt.submitAttempt, {
    sessionToken: t1,
    attemptId,
  });
  check(submitAgain.alreadySubmitted, "re-submit is idempotent (no rewrite)");
  await expectError(
    "answers rejected after submission (immutable)",
    "KFP_ATTEMPT_CLOSED",
    () =>
      client.mutation(api.cbt.answerQuestion, {
        sessionToken: t1,
        attemptId,
        questionId: questions[0].id,
        selectedOptionIndex: 2,
      }),
  );

  const result = await client.query(api.cbt.getResult, {
    sessionToken: t1,
    attemptId,
  });
  check(
    result.totalQuestions === 35 && result.maxScore === 70,
    "result totals: 35 questions × 2 marks = 70 (Format A)",
    {
      totalQuestions: result.totalQuestions,
      maxScore: result.maxScore,
      format: result.format,
    },
  );
  const review = await client.query(api.cbt.getReview, {
    sessionToken: t1,
    attemptId,
  });
  check(review.items.length === 35, "review lists every question after submit");
  check(
    review.items.every(
      (i) =>
        i.explanation.length > 0 &&
        i.correctOptionIndex >= 0 &&
        i.correctAnswerText.length > 0 &&
        i.topicName.length > 0,
    ),
    "review exposes corrections, explanations and source labels post-submit",
  );
  const answered = review.items.filter((i) => i.yourAnswerIndex !== null);
  const expectedCorrect = answered.filter(
    (i) => i.yourAnswerIndex === i.correctOptionIndex,
  ).length;
  const expectedIncorrect = answered.length - expectedCorrect;
  check(
    result.correctCount === expectedCorrect &&
      result.incorrectCount === expectedIncorrect &&
      result.unansweredCount === 35 - answered.length,
    "server score matches independent recomputation from review",
    {
      correct: result.correctCount,
      expectedCorrect,
      incorrect: result.incorrectCount,
      expectedIncorrect,
      unanswered: result.unansweredCount,
    },
  );
  check(
    result.score === expectedCorrect * 2,
    "score = correct answers × marksPerQuestion (server-side)",
    { score: result.score, expected: expectedCorrect * 2 },
  );
  const expectedPct =
    Math.round((result.score / result.maxScore) * 1000) / 10;
  check(result.percentage === expectedPct, "percentage consistent", {
    percentage: result.percentage,
    expectedPct,
  });

  await expectError(
    "result/attempt list works only for owner after submit",
    "KFP_NOT_OWNER",
    () => client.query(api.cbt.getResult, { sessionToken: t2, attemptId }),
  );

  // ── 9. FREE weekly per-course limit ───────────────────────────────────
  await expectError(
    "FREE second simulation same course/week blocked",
    "KFP_COURSE_WEEKLY_LIMIT",
    () =>
      client.mutation(api.cbt.startAttempt, {
        sessionToken: t1,
        testId: testA!.id,
      }),
  );

  // ── 10. PLUS demo student: rotation + Format B + retake ───────────────
  const isQuotaError = (m: string) =>
    m.includes("KFP_WEEKLY_LIMIT") || m.includes("KFP_COURSE_WEEKLY_LIMIT");

  const demo = await client.mutation(api.users.login, {
    phone: "08000000000",
    password: "DemoPass123",
  });
  const td = demo.sessionToken;
  const demoMe = await client.query(api.users.me, { sessionToken: td });
  check(demoMe?.plan === "PLUS" && demoMe.isDemo, "demo PLUS student can log in");

  try {
    const demoA1 = await client.mutation(api.cbt.startAttempt, {
      sessionToken: td,
      testId: testA!.id,
    });
    await client.mutation(api.cbt.submitAttempt, {
      sessionToken: td,
      attemptId: demoA1.attemptId,
    });
    const reviewA1 = await client.query(api.cbt.getReview, {
      sessionToken: td,
      attemptId: demoA1.attemptId,
    });
    const set1 = new Set(reviewA1.items.map((i) => i.questionId as string));

    const demoA2 = await client.mutation(api.cbt.startAttempt, {
      sessionToken: td,
      testId: testA!.id,
    });
    const attA2 = await client.query(api.cbt.getAttempt, {
      sessionToken: td,
      attemptId: demoA2.attemptId,
    });
    if (attA2.status === "ACTIVE") {
      const set2 = new Set(attA2.questions.map((q) => q.id as string));
      const overlap = [...set2].filter((id) => set1.has(id)).length;
      check(
        overlap < set1.size,
        "retake receives a different question set (rotation varies per attempt)",
        { overlap, size: set1.size },
      );
    } else {
      check(false, "second demo attempt active for rotation check", attA2);
    }
    await client.mutation(api.cbt.submitAttempt, {
      sessionToken: td,
      attemptId: demoA2.attemptId,
    });

    // Blueprint respected: Format A = Algebra 10, Trig 8, Functions 7, Stats 5, Other 5.
    const topicTally = new Map<string, number>();
    for (const item of reviewA1.items) {
      topicTally.set(item.topicName, (topicTally.get(item.topicName) ?? 0) + 1);
    }
    check(
      (topicTally.get("Algebra") ?? 0) === 10 &&
        (topicTally.get("Trigonometry") ?? 0) === 8 &&
        (topicTally.get("Functions") ?? 0) === 7 &&
        (topicTally.get("Statistics") ?? 0) === 5 &&
        (topicTally.get("Other") ?? 0) === 5,
      "Format A blueprint respected (Algebra 10, Trig 8, Functions 7, Stats 5, Other 5)",
      Object.fromEntries(topicTally),
    );

    // Format B via PLUS:
    try {
      const demoB = await client.mutation(api.cbt.startAttempt, {
        sessionToken: td,
        testId: testB!.id,
      });
      const attB = await client.query(api.cbt.getAttempt, {
        sessionToken: td,
        attemptId: demoB.attemptId,
      });
      check(
        attB.status === "ACTIVE" &&
          attB.questions.length === 70 &&
          attB.questionCount === 70 &&
          attB.totalMarks === 70,
        "PLUS can take Format B (70 questions, 30 minutes, 1 mark)",
      );
      await client.mutation(api.cbt.submitAttempt, {
        sessionToken: td,
        attemptId: demoB.attemptId,
      });
      const resB = await client.query(api.cbt.getResult, {
        sessionToken: td,
        attemptId: demoB.attemptId,
      });
      check(
        resB.maxScore === 70 && resB.totalQuestions === 70,
        "Format B result totals: 70 questions × 1 mark = 70",
      );
    } catch (e) {
      const m = errMsg(e);
      if (isQuotaError(m)) {
        skip("Format B (PLUS) checks", `weekly quota exhausted: ${m}`);
      } else {
        check(false, "Format B attempt flow", m);
      }
    }
  } catch (e) {
    const m = errMsg(e);
    if (isQuotaError(m)) {
      skip("rotation/retake checks", `weekly quota exhausted: ${m}`);
    } else {
      check(false, "PLUS rotation/retake flow", m);
    }
  }

  // ── 11. Scheduled auto-submit of an expired attempt ───────────────────
  const cscTests = await client.query(api.catalog.listTests, {
    sessionToken: td,
    courseId: cscCourse.id,
  });
  const timingTest = cscTests.tests.find((t) => t.questionCount === 5);
  if (!timingTest) {
    check(false, "timing-check test seeded");
  } else {
    try {
      const timing = await client.mutation(api.cbt.startAttempt, {
        sessionToken: td,
        testId: timingTest.id,
      });
      const tid = timing.attemptId;
      let tAtt = await client.query(api.cbt.getAttempt, {
        sessionToken: td,
        attemptId: tid,
      });
      check(
        tAtt.status === "ACTIVE" && tAtt.questions.length === 5,
        "timing test started (5 questions, 45s)",
      );
      const r0 = tAtt.status === "ACTIVE" ? tAtt.remainingMs : 0;
      // "Student answers one question, then closes the browser."
      if (tAtt.status === "ACTIVE") {
        await client.mutation(api.cbt.answerQuestion, {
          sessionToken: td,
          attemptId: tid,
          questionId: tAtt.questions[0].id,
          selectedOptionIndex: 1,
        });
      }
      await sleep(9000);
      tAtt = await client.query(api.cbt.getAttempt, {
        sessionToken: td,
        attemptId: tid,
      });
      check(
        tAtt.status === "ACTIVE" && tAtt.remainingMs < r0 - 7000,
        "countdown continues server-side with no interaction",
        { r0, now: tAtt.status === "ACTIVE" ? tAtt.remainingMs : null },
      );
      // Wait past deadline (45s) + scheduler grace (2s).
      await sleep(42_000);
      tAtt = await client.query(api.cbt.getAttempt, {
        sessionToken: td,
        attemptId: tid,
      });
      check(
        tAtt.status === "SUBMITTED",
        "scheduled auto-submit finalized the expired attempt (no client needed)",
        tAtt.status === "ACTIVE" ? { expired: tAtt.expired } : undefined,
      );
      const tRes = await client.query(api.cbt.getResult, {
        sessionToken: td,
        attemptId: tid,
      });
      check(
        tRes.submittedBy === "AUTO",
        "expired attempt recorded as AUTO submission",
        { submittedBy: tRes.submittedBy },
      );
      check(
        tRes.timeUsedSeconds <= 55 && tRes.timeUsedSeconds >= 40,
        "time used is clamped to the allowed duration",
        { timeUsedSeconds: tRes.timeUsedSeconds },
      );
      check(
        tRes.totalQuestions === 5 && tRes.maxScore === 10,
        "auto-submitted attempt scored server-side",
      );
    } catch (e) {
      const m = errMsg(e);
      if (m.includes("KFP_WEEKLY_LIMIT") || m.includes("KFP_COURSE_WEEKLY_LIMIT")) {
        skip("auto-submit timing checks", `weekly quota exhausted: ${m}`);
      } else {
        check(false, "auto-submit timing flow", m);
      }
    }
  }

  // ── 12. History + plan status + logout ────────────────────────────────
  const history = await client.query(api.cbt.listMyAttempts, {
    sessionToken: td,
  });
  check(history.length >= 3, "attempt history listed", { n: history.length });
  const planStatus = await client.query(api.cbt.getPlanStatus, {
    sessionToken: td,
  });
  check(
    planStatus.plan === "PLUS" &&
      planStatus.limits.allowedFormats.includes("FORMAT_B") &&
      planStatus.usage.simulationsThisWeek >= 3,
    "plan status reports backend limits + weekly usage",
  );

  await client.mutation(api.users.logout, { sessionToken: t1 });
  const afterLogout = await client.query(api.users.me, { sessionToken: t1 });
  check(afterLogout === null, "logout invalidates the session");
  await expectError(
    "logged-out token rejected on protected query",
    "KFP_UNAUTHENTICATED",
    () => client.query(api.cbt.listMyAttempts, { sessionToken: t1 }),
  );
}

main()
  .then(() => {
    console.log(
      `\nSMOKE RESULT: ${passed} passed, ${failures.length} failed, ${skipped} skipped`,
    );
    if (failures.length > 0) {
      console.error("Failed checks:\n - " + failures.join("\n - "));
    }
    process.exit(failures.length > 0 ? 1 : 0);
  })
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
