import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../lib/auth";
import { Badge, Button, Card, DemoBanner, Loading } from "../components/ui";

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const { user, token } = useAuth();
  const planStatus = useQuery(
    api.cbt.getPlanStatus,
    token ? { sessionToken: token } : "skip",
  );
  const courses = useQuery(
    api.catalog.listCourses,
    token ? { sessionToken: token } : "skip",
  );
  const attempts = useQuery(
    api.cbt.listMyAttempts,
    token ? { sessionToken: token } : "skip",
  );

  if (!planStatus || !courses || !attempts) {
    return <Loading label="Loading your dashboard…" />;
  }

  const activeAttempt = attempts.find(
    (a) => a.status === "ACTIVE" && a.deadlineAt > Date.now(),
  );
  const enrolled = courses.courses.filter((c) => c.enrolled);
  const recent = attempts.slice(0, 5);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">
          Hello, {user?.fullName?.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {user?.level} Level · {planStatus.plan} plan
        </p>
      </div>

      <DemoBanner />

      {activeAttempt && (
        <Card className="border-brand-500/50 bg-brand-100/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand-700">
                Attempt in progress
              </p>
              <p className="text-sm text-ink-700">
                {activeAttempt.testTitle} · {activeAttempt.courseCode}
              </p>
            </div>
            <Link to={`/attempts/${activeAttempt.attemptId}`}>
              <Button>Resume CBT</Button>
            </Link>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            The clock keeps running even while you are away — finishing by
            time-up is automatic.
          </p>
        </Card>
      )}

      {/* Plan usage */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center sm:p-4">
          <p className="text-2xl font-black text-ink-900">
            {planStatus.usage.enrolledCourses}
            <span className="text-sm font-semibold text-ink-500">
              /{planStatus.limits.maxCourses}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-ink-500">Courses</p>
        </Card>
        <Card className="p-3 text-center sm:p-4">
          <p className="text-2xl font-black text-ink-900">
            {planStatus.usage.simulationsThisWeek}
            <span className="text-sm font-semibold text-ink-500">
              /{planStatus.limits.simulationsPerWeek}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-ink-500">CBTs this week</p>
        </Card>
        <Card className="p-3 text-center sm:p-4">
          <p className="text-2xl font-black text-ink-900">
            {planStatus.limits.allowedFormats.length}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            Format{planStatus.limits.allowedFormats.length > 1 ? "s" : ""}
          </p>
        </Card>
      </div>

      {/* Enrolled courses */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold text-ink-900">Your courses</h2>
          <Link
            to="/courses"
            className="text-sm font-semibold text-brand-600 underline"
          >
            Browse all
          </Link>
        </div>
        {enrolled.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-500">
              You have not enrolled in any course yet.
            </p>
            <Link to="/courses">
              <Button className="mt-3">Choose courses</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {enrolled.map((c) => (
              <Link key={c.id} to={`/courses/${c.id}`}>
                <Card className="h-full transition-colors hover:border-brand-500/50">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-brand-600">
                      {c.code}
                    </span>
                    {c.isDemo && <Badge tone="gold">Demo</Badge>}
                  </div>
                  <p className="mt-1 font-semibold text-ink-900">{c.title}</p>
                  <p className="mt-2 text-xs text-ink-500">
                    {c.simulationsThisWeek} simulation
                    {c.simulationsThisWeek === 1 ? "" : "s"} this week ·{" "}
                    {planStatus.limits.simulationsPerCoursePerWeek} allowed
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent attempts */}
      <section>
        <h2 className="mb-2 font-bold text-ink-900">Recent activity</h2>
        {recent.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-500">
              No attempts yet. Pick a course and start your first simulation.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((a) => {
              const submitted = a.status === "SUBMITTED";
              const href = submitted
                ? `/attempts/${a.attemptId}/result`
                : `/attempts/${a.attemptId}`;
              return (
                <Link key={a.attemptId} to={href}>
                  <Card className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {a.testTitle}
                      </p>
                      <p className="text-xs text-ink-500">
                        {a.courseCode} · {formatWhen(a.startedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {submitted ? (
                        <>
                          <span className="text-sm font-bold text-ink-900">
                            {a.score}/{a.maxScore}
                          </span>
                          <Badge
                            tone={
                              (a.percentage ?? 0) >= 50 ? "brand" : "danger"
                            }
                          >
                            {a.percentage}%
                          </Badge>
                        </>
                      ) : (
                        <Badge tone="ink">In progress</Badge>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
