import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../lib/auth";
import { errorCodeOf } from "../lib/utils";
import { Badge, Button, Card, ErrorNote, Loading, Spinner } from "../components/ui";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AttemptRunner() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const attempt = useQuery(
    api.cbt.getAttempt,
    token && attemptId
      ? { sessionToken: token, attemptId: attemptId as never }
      : "skip",
  );
  const answerMutation = useMutation(api.cbt.answerQuestion);
  const submitMutation = useMutation(api.cbt.submitAttempt);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [localSelected, setLocalSelected] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<unknown>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Server-anchored countdown: remainingMs comes from the server when data
  // refreshes; between refreshes we subtract real local elapsed time. The
  // server (deadline + scheduler) remains the authority — this is display.
  const anchorRef = useRef<{ remaining: number; at: number } | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const expiryHandled = useRef(false);

  const isActive = attempt?.status === "ACTIVE";

  // Re-anchor whenever the subscription delivers fresh server data.
  useEffect(() => {
    if (attempt && attempt.status === "ACTIVE") {
      anchorRef.current = { remaining: attempt.remainingMs, at: Date.now() };
      setTick(Date.now());
    }
  }, [attempt]);

  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => setTick(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [isActive]);

  const remainingMs = useMemo(() => {
    if (!anchorRef.current) return 0;
    const elapsed = tick - anchorRef.current.at;
    return Math.max(0, anchorRef.current.remaining - elapsed);
  }, [tick, attempt]);

  const goToResult = useCallback(() => {
    navigate(`/attempts/${attemptId}/result`, { replace: true });
  }, [navigate, attemptId]);

  const finalizeExpiry = useCallback(async () => {
    if (expiryHandled.current) return;
    expiryHandled.current = true;
    if (token && attemptId) {
      try {
        // Server decides MANUAL vs AUTO based on its own clock.
        await submitMutation({
          sessionToken: token,
          attemptId: attemptId as never,
        });
      } catch {
        // Already finalized server-side (scheduled auto-submit) — proceed.
      }
    }
    goToResult();
  }, [token, attemptId, submitMutation, goToResult]);

  // Local countdown reached zero → hand over to the server for finalization.
  useEffect(() => {
    if (isActive && remainingMs <= 0 && anchorRef.current) {
      void finalizeExpiry();
    }
  }, [isActive, remainingMs, finalizeExpiry]);

  // Server says the deadline already passed (e.g. returning after expiry).
  useEffect(() => {
    if (attempt && attempt.status === "ACTIVE" && attempt.expired) {
      void finalizeExpiry();
    }
  }, [attempt, finalizeExpiry]);

  const questions = isActive ? attempt.questions : [];

  // A submitted attempt (manually, by scheduler, or by the expiry flow above)
  // always belongs on the result screen.
  if (attempt && attempt.status === "SUBMITTED") {
    return <Navigate to={`/attempts/${attemptId}/result`} replace />;
  }
  if (!attempt) return <Loading label="Loading your CBT…" />;
  if (!isActive) return null;

  const total = questions.length;
  const current = questions[Math.min(currentIndex, total - 1)];
  const answeredCount = questions.filter((q) => {
    const selected = q.id in localSelected ? localSelected[q.id] : q.selectedOptionIndex;
    return selected !== null && selected !== undefined;
  }).length;

  const selectAnswer = async (optionIndex: number | null) => {
    if (!token || !attemptId || !current) return;
    setError(null);
    // Optimistic UI; the server is the source of truth (it echoes back).
    setLocalSelected((prev) => ({ ...prev, [current.id]: optionIndex }));
    try {
      await answerMutation({
        sessionToken: token,
        attemptId: attemptId as never,
        questionId: current.id,
        selectedOptionIndex: optionIndex,
      });
    } catch (err) {
      const code = errorCodeOf(err instanceof Error ? err.message : null);
      if (code === "TIME_EXPIRED" || code === "ATTEMPT_CLOSED") {
        goToResult();
        return;
      }
      setError(err);
    }
  };

  const submitNow = async () => {
    if (!token || !attemptId) return;
    setSubmitting(true);
    try {
      await submitMutation({
        sessionToken: token,
        attemptId: attemptId as never,
      });
      goToResult();
    } catch (err) {
      setError(err);
      setSubmitting(false);
      setConfirming(false);
    }
  };

  const urgent = remainingMs <= 60_000;
  const currentSelected =
    current
      ? current.id in localSelected
        ? localSelected[current.id]
        : current.selectedOptionIndex
      : null;

  return (
    <div className="space-y-4">
      {/* Timer + progress strip */}
      <div className="sticky top-14 z-10 -mx-4 bg-paper/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">
              {attempt.testTitle}
            </p>
            <p className="text-xs text-ink-500">
              Q {currentIndex + 1}/{total} · {answeredCount} answered ·{" "}
              {attempt.marksPerQuestion} mk each
            </p>
          </div>
          <div
            className={
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-lg font-bold tabular-nums " +
              (urgent
                ? "bg-danger-100 text-danger-700"
                : "bg-ink-900 text-paper")
            }
            role="timer"
            aria-label="Time remaining"
          >
            {urgent && <Spinner className="size-3.5" />}
            {fmtClock(remainingMs)}
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-900/10">
          <div
            className={
              "h-full rounded-full transition-[width] " +
              (urgent ? "bg-danger-600" : "bg-brand-600")
            }
            style={{
              width: `${(answeredCount / Math.max(total, 1)) * 100}%`,
            }}
          />
        </div>
      </div>

      {error != null && <ErrorNote error={error} />}

      {/* Question */}
      <Card className="p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Question {currentIndex + 1}
        </p>
        <p className="mt-2 text-base font-medium leading-relaxed text-ink-900 sm:text-lg">
          {current?.text}
        </p>

        <div className="mt-4 space-y-2.5">
          {current?.options.map((option, idx) => {
            const selected = currentSelected === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => selectAnswer(idx)}
                className={
                  "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-base transition-colors " +
                  (selected
                    ? "border-brand-600 bg-brand-100 ring-2 ring-brand-500/40"
                    : "border-ink-900/15 bg-surface hover:border-ink-900/30")
                }
              >
                <span
                  className={
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold " +
                    (selected
                      ? "bg-brand-600 text-white"
                      : "bg-ink-900/8 text-ink-700")
                  }
                >
                  {OPTION_LETTERS[idx]}
                </span>
                <span className="pt-0.5 text-ink-900">{option}</span>
              </button>
            );
          })}
        </div>

        {currentSelected !== null && currentSelected !== undefined && (
          <button
            type="button"
            className="mt-3 text-xs text-ink-500 underline"
            onClick={() => selectAnswer(null)}
          >
            Clear answer
          </button>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        >
          ← Previous
        </Button>
        <Button
          variant="ghost"
          onClick={() => setShowPalette((v) => !v)}
        >
          {showPalette ? "Hide palette" : "Questions"}
        </Button>
        <Button
          variant="secondary"
          disabled={currentIndex >= total - 1}
          onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
        >
          Next →
        </Button>
      </div>

      {showPalette && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-ink-900">
            Question palette
          </p>
          <div className="grid grid-cols-7 gap-2 sm:grid-cols-10">
            {questions.map((q, idx) => {
              const answered =
                q.id in localSelected
                  ? localSelected[q.id] !== null
                  : q.selectedOptionIndex !== null;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(idx);
                    setShowPalette(false);
                  }}
                  className={
                    "aspect-square rounded-lg text-xs font-bold " +
                    (idx === currentIndex
                      ? "bg-gold-500 text-ink-900 ring-2 ring-ink-900"
                      : answered
                        ? "bg-brand-600 text-white"
                        : "bg-ink-900/8 text-ink-700")
                  }
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Submit */}
      <div className="rounded-2xl bg-ink-900 p-4 text-paper">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-semibold">
              {answeredCount} of {total} answered
            </p>
            <p className="text-paper/60">
              Time keeps running until you submit or it hits 00:00.
            </p>
          </div>
          <Button variant="gold" onClick={() => setConfirming(true)}>
            Submit CBT
          </Button>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirming && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-900/60 p-4 sm:items-center">
          <Card className="w-full max-w-md">
            <h2 className="text-lg font-bold text-ink-900">
              Submit your CBT?
            </h2>
            <p className="mt-2 text-sm text-ink-700">
              {answeredCount} of {total} questions answered ·{" "}
              {fmtClock(remainingMs)} remaining.
            </p>
            <p className="mt-1 text-sm text-ink-500">
              After submission your answers are locked and scored — you cannot
              change them.
            </p>
            <div className="mt-4 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Keep working
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={submitting}
                onClick={submitNow}
              >
                Submit now
              </Button>
            </div>
          </Card>
        </div>
      )}

      <p className="text-center text-xs text-ink-500">
        <Badge tone="neutral">Server-timed</Badge> Leaving this page does not
        pause the CBT.
      </p>
    </div>
  );
}
