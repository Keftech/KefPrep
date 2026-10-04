import { Link, useParams } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../lib/auth";
import { Badge, Button, Card, DemoBanner, Loading } from "../components/ui";

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default function Result() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { token } = useAuth();

  const attempt = useQuery(
    api.cbt.getAttempt,
    token && attemptId
      ? { sessionToken: token, attemptId: attemptId as never }
      : "skip",
  );
  const result = useQuery(
    api.cbt.getResult,
    token && attemptId
      ? { sessionToken: token, attemptId: attemptId as never }
      : "skip",
  );

  if (!attempt || !result) return <Loading label="Loading your result…" />;

  // Still running → this page must not exist; back to the runner.
  if (attempt.status === "ACTIVE") {
    return <Navigate to={`/attempts/${attemptId}`} replace />;
  }

  const strong = result.percentage >= 50;
  const maxBar = Math.max(1, result.totalQuestions);

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/dashboard"
          className="text-sm text-brand-600 underline"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">
          {result.testTitle}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {result.courseCode} — {result.courseTitle}
        </p>
      </div>

      <DemoBanner />

      {/* Score hero */}
      <Card className={strong ? "bg-brand-700 text-white" : "bg-ink-900 text-paper"}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/60">
              Your score
            </p>
            <p className="mt-1 text-4xl font-black tabular-nums sm:text-5xl">
              {result.score}
              <span className="text-xl font-bold text-white/60">
                /{result.maxScore}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black tabular-nums">
              {result.percentage}%
            </p>
            <p className="mt-1 text-xs text-white/70">
              {result.submittedBy === "AUTO"
                ? "Auto-submitted at time-up"
                : "Submitted by you"}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-gold-500"
            style={{ width: `${result.percentage}%` }}
          />
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3 text-center">
          <p className="text-2xl font-black text-brand-600">
            {result.correctCount}
          </p>
          <p className="text-xs text-ink-500">Correct</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-black text-danger-600">
            {result.incorrectCount}
          </p>
          <p className="text-xs text-ink-500">Incorrect</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-black text-ink-500">
            {result.unansweredCount}
          </p>
          <p className="text-xs text-ink-500">Unanswered</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-black text-ink-900">
            {fmtDuration(result.timeUsedSeconds)}
          </p>
          <p className="text-xs text-ink-500">Time used</p>
        </Card>
      </div>

      {/* Topic breakdown */}
      <Card>
        <h2 className="font-bold text-ink-900">By topic</h2>
        <div className="mt-3 space-y-3">
          {result.topicBreakdown.map((t) => {
            const pct = Math.round((t.correct / Math.max(t.total, 1)) * 100);
            return (
              <div key={t.topicId}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{t.topicName}</span>
                  <span className="font-semibold text-ink-900">
                    {t.correct}/{t.total}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-900/10">
                  <div
                    className={
                      "h-full rounded-full " +
                      (pct >= 50 ? "bg-brand-600" : "bg-gold-500")
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-xs text-ink-500">
            {result.correctCount} of {maxBar} questions correct overall.
          </p>
        </div>
      </Card>

      {/* Actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to={`/attempts/${attemptId}/review`}>
          <Button className="w-full min-h-12">Review corrections</Button>
        </Link>
        <Link to={`/courses/${result.courseId}`}>
          <Button variant="secondary" className="w-full min-h-12">
            Retake / other CBTs
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-ink-500">
        <Badge tone="neutral">Server-scored</Badge>
        <span>Calculated on submission — not in your browser.</span>
      </div>
    </div>
  );
}
