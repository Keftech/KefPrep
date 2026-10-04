import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../lib/auth";
import { Badge, Button, Card, DemoBanner, ErrorNote, Loading } from "../components/ui";

function durationLabel(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export default function CbtSelect() {
  const { courseId } = useParams<{ courseId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const tests = useQuery(
    api.catalog.listTests,
    token && courseId
      ? { sessionToken: token, courseId: courseId as never }
      : "skip",
  );
  const attempts = useQuery(
    api.cbt.listMyAttempts,
    token ? { sessionToken: token } : "skip",
  );
  const startAttempt = useMutation(api.cbt.startAttempt);

  const [busyTestId, setBusyTestId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  if (!tests || !attempts) return <Loading label="Loading CBTs…" />;

  const submittedCounts = new Map<string, number>();
  for (const a of attempts) {
    if (a.status === "SUBMITTED") {
      submittedCounts.set(a.testId, (submittedCounts.get(a.testId) ?? 0) + 1);
    }
  }

  const start = async (testId: string) => {
    if (!token) return;
    setError(null);
    setBusyTestId(testId);
    try {
      const result = await startAttempt({ sessionToken: token, testId: testId as never });
      navigate(`/attempts/${result.attemptId}`, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusyTestId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/courses" className="text-sm text-brand-600 underline">
          ← Courses
        </Link>
        <h1 className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">
          {tests.course.code} — choose a CBT
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {tests.course.title} · {tests.plan} plan ·{" "}
          {tests.usage.simulationsThisCourseThisWeek}/
          {tests.limits.simulationsPerCoursePerWeek} simulations used this week
        </p>
      </div>

      <DemoBanner />
      {error != null && <ErrorNote error={error} />}

      {!tests.enrolled && (
        <Card>
          <p className="text-sm text-ink-700">
            Enrol in this course before starting a CBT.
          </p>
          <Link to="/courses">
            <Button className="mt-3" variant="secondary">
              Back to courses
            </Button>
          </Link>
        </Card>
      )}

      {tests.activeAttempt && (
        <Card className="border-brand-500/50 bg-brand-100/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand-700">
                You have an attempt in progress
              </p>
              <p className="text-sm text-ink-700">
                The timer is still running — resume to continue.
              </p>
            </div>
            <Link to={`/attempts/${tests.activeAttempt.attemptId}`}>
              <Button>Resume</Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {tests.tests.map((t) => {
          const prior = submittedCounts.get(t.id) ?? 0;
          const blocked = !t.formatAllowed;
          const usedUp =
            tests.usage.simulationsThisCourseThisWeek >=
            tests.limits.simulationsPerCoursePerWeek;
          return (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={t.format === "FORMAT_A" ? "brand" : "gold"}>
                      {t.format === "FORMAT_A" ? "Format A" : "Format B"}
                    </Badge>
                    {t.isDemo && <Badge tone="neutral">Demo</Badge>}
                    {prior > 0 && <Badge tone="ink">{prior}× taken</Badge>}
                  </div>
                  <p className="mt-1.5 font-semibold text-ink-900">
                    {t.title}
                  </p>
                  {t.description && (
                    <p className="mt-0.5 text-sm text-ink-500">{t.description}</p>
                  )}
                  <p className="mt-2 text-xs font-medium text-ink-700">
                    {t.questionCount} questions · {durationLabel(t.durationSeconds)} ·{" "}
                    {t.marksPerQuestion} mark{t.marksPerQuestion > 1 ? "s" : ""} each ·{" "}
                    {t.totalMarks} marks total
                  </p>
                </div>
                <div className="shrink-0">
                  <Button
                    loading={busyTestId === t.id}
                    disabled={
                      blocked || usedUp || !!tests.activeAttempt || !tests.enrolled
                    }
                    onClick={() => start(t.id)}
                  >
                    {prior > 0 ? "Retake" : "Start"}
                  </Button>
                </div>
              </div>
              {blocked && (
                <p className="mt-2 text-xs text-gold-600">
                  Not available on your {tests.plan} plan yet.
                </p>
              )}
              {!blocked && usedUp && (
                <p className="mt-2 text-xs text-ink-500">
                  Weekly per-course limit reached — resets every Monday
                  (Africa/Lagos).
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-ink-500">
        The timer is set by the server when you press start and cannot be
        paused or reset. If you leave, time keeps running — at time-up the
        attempt is submitted and scored automatically.
      </p>
    </div>
  );
}
