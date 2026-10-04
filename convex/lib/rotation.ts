import type { Doc, Id } from "../_generated/dataModel";

/**
 * Question-selection (rotation) service.
 *
 * Design goals for V1:
 * - Deterministic per attempt (seeded PRNG), NOT pure random: different
 *   attempts receive different sets, but selection is driven by blueprint
 *   quotas, source priority and the student's question history.
 * - Rotation happens *within* blueprint topic quotas so tests built from the
 *   same blueprint stay reasonably comparable.
 * - The interface (candidates + blueprint + seed + history in, ordered ids
 *   out) can grow smarter later without touching the CBT engine.
 */

export type RotationCandidate = Doc<"questions">;

export type BlueprintQuota = { topicId: Id<"topics">; count: number };

export type RotationHistoryRow = {
  questionId: Id<"questions">;
  timesSeen: number;
  lastSeenAt: number;
};

export type RotationInput = {
  candidates: RotationCandidate[];
  quotas: BlueprintQuota[];
  questionCount: number;
  seed: string;
  history: RotationHistoryRow[];
  sourcePriority?: string[];
  now: number;
};

/** xmur3 string hash → 32-bit seed, then mulberry32 PRNG. */
function seedFrom(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOURCE_WEIGHT: Record<string, number> = {
  PAST_QUESTION: 0.12,
  LECTURER_PROVIDED: 0.1,
  OTHER_VERIFIED_SOURCE: 0.08,
  PATTERN_BASED: 0.06,
  KEFPREP_GENERATED: 0.05,
};

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_HISTORY_PENALTY = 0.45;
const RECENT_SEEN_PENALTY = 0.5;
const JITTER = 0.3;

/**
 * Scale quotas proportionally to reach `questionCount`
 * (largest-remainder method), never exceeding a topic's availability.
 */
export function scaleQuotas(
  quotas: BlueprintQuota[],
  questionCount: number,
  availability: Record<string, number>,
): BlueprintQuota[] {
  const active = quotas.filter((q) => q.count > 0);
  const total = active.reduce((sum, q) => sum + q.count, 0);
  if (total === 0) {
    // No blueprint information: spread evenly across available topics.
    const topics = Object.keys(availability).filter((t) => availability[t] > 0);
    if (topics.length === 0) return [];
    const base = Math.floor(questionCount / topics.length);
    let remainder = questionCount - base * topics.length;
    return topics.map((t) => ({
      topicId: t as Id<"topics">,
      count: base + (remainder-- > 0 ? 1 : 0),
    }));
  }
  const factor = questionCount / total;
  const scaled = active.map((q) => {
    const raw = q.count * factor;
    const floor = Math.floor(raw);
    return { ...q, count: floor, fraction: raw - floor };
  });
  let assigned = scaled.reduce((sum, q) => sum + q.count, 0);
  scaled.sort((a, b) => b.fraction - a.fraction);
  let i = 0;
  while (assigned < questionCount && i < scaled.length * 2) {
    const target = scaled[i % scaled.length];
    if (target.count < (availability[target.topicId as string] ?? 0)) {
      target.count += 1;
      assigned += 1;
    }
    i += 1;
    if (i > scaled.length * 4 && assigned < questionCount) break;
  }
  return scaled.map(({ topicId, count }) => ({ topicId, count }));
}

/**
 * Core selection: score every candidate, then greedily take the best per
 * topic quota. Score = source priority − student-history penalties +
 * seed-stable jitter (small enough that history and blueprint dominate).
 */
export function selectQuestions(input: RotationInput): Id<"questions">[] {
  const {
    candidates,
    quotas,
    questionCount,
    seed,
    history,
    sourcePriority,
    now,
  } = input;
  const random = seedFrom(seed);

  const historyByQuestion = new Map<string, RotationHistoryRow>();
  for (const row of history) historyByQuestion.set(row.questionId, row);

  const availability: Record<string, number> = {};
  for (const c of candidates) {
    const key = c.topicId as string;
    availability[key] = (availability[key] ?? 0) + 1;
  }

  const finalQuotas = scaleQuotas(quotas, questionCount, availability);

  const scored = candidates.map((c) => {
    let score = 1;
    const source = c.source as string;
    if (sourcePriority && sourcePriority.includes(source)) {
      const idx = sourcePriority.indexOf(source);
      score +=
        0.35 * ((sourcePriority.length - idx) / sourcePriority.length);
    } else {
      score += SOURCE_WEIGHT[source] ?? 0.05;
    }
    const historyRow = historyByQuestion.get(c._id);
    if (historyRow) {
      const seenFactor = Math.min(historyRow.timesSeen, 5) / 5;
      score -= MAX_HISTORY_PENALTY * seenFactor;
      if (now - historyRow.lastSeenAt < RECENT_WINDOW_MS) {
        score -= RECENT_SEEN_PENALTY;
      }
    }
    score += (random() - 0.5) * JITTER;
    return { question: c, score };
  });

  const byTopic = new Map<string, typeof scored>();
  for (const entry of scored) {
    const key = entry.question.topicId as string;
    const list = byTopic.get(key);
    if (list) list.push(entry);
    else byTopic.set(key, [entry]);
  }
  for (const list of byTopic.values()) {
    list.sort((a, b) => b.score - a.score);
  }

  const chosen = new Map<string, number>(); // questionId → index
  const leftovers: typeof scored = [];

  for (const quota of finalQuotas) {
    const pool = byTopic.get(quota.topicId as string) ?? [];
    let taken = 0;
    for (const entry of pool) {
      if (taken >= quota.count) {
        leftovers.push(entry);
        continue;
      }
      if (chosen.has(entry.question._id)) continue;
      chosen.set(entry.question._id, taken);
      taken += 1;
    }
  }
  // Topics with unfilled quotas borrow from the best remaining candidates.
  leftovers.sort((a, b) => b.score - a.score);
  for (const entry of leftovers) {
    if (chosen.size >= questionCount) break;
    if (chosen.has(entry.question._id)) continue;
    chosen.set(entry.question._id, chosen.size);
  }

  if (chosen.size < questionCount) {
    throw new Error(
      `KFP_NOT_ENOUGH_QUESTIONS: Only ${chosen.size} of ${questionCount} required questions are available for this test.`,
    );
  }

  const ordered = [...chosen.keys()].slice(0, questionCount);
  // Light seed-stable shuffle so presentation order also varies per attempt.
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered as Id<"questions">[];
}

