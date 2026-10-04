import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../lib/auth";
import { Badge, Button, Card, DemoBanner, ErrorNote, Loading } from "../components/ui";

export default function Courses() {
  const { token } = useAuth();
  const courses = useQuery(
    api.catalog.listCourses,
    token ? { sessionToken: token } : "skip",
  );
  const enroll = useMutation(api.catalog.enrollCourse);
  const unenroll = useMutation(api.catalog.unenrollCourse);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  if (!courses) return <Loading label="Loading courses…" />;

  const { plan, limits, usage, courses: list } = courses;
  const atCourseLimit = usage.enrolledCourses >= limits.maxCourses;

  const toggleEnroll = async (courseId: string, enrolled: boolean) => {
    if (!token) return;
    setError(null);
    setBusyId(courseId);
    try {
      if (enrolled) {
        await unenroll({ sessionToken: token, courseId: courseId as never });
      } else {
        await enroll({ sessionToken: token, courseId: courseId as never });
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Courses</h1>
        <p className="mt-1 text-sm text-ink-500">
          {plan} plan · {usage.enrolledCourses}/{limits.maxCourses} courses
          enrolled · {usage.simulations}/{limits.simulationsPerWeek} simulations
          used this week
        </p>
      </div>

      <DemoBanner />
      {error != null && <ErrorNote error={error} />}

      <div className="space-y-3">
        {list.map((c) => {
          const lockedByPlan = plan === "FREE" && !c.freeDesignated;
          const canAdd = !c.enrolled && !lockedByPlan && !atCourseLimit;
          return (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-brand-600">
                      {c.code}
                    </span>
                    <span className="text-xs text-ink-500">{c.level} Level</span>
                    {c.isDemo && <Badge tone="gold">Demo</Badge>}
                    {c.enrolled && <Badge tone="brand">Enrolled</Badge>}
                  </div>
                  <p className="mt-1 font-semibold text-ink-900">{c.title}</p>
                  {c.description && (
                    <p className="mt-1 text-sm text-ink-500">{c.description}</p>
                  )}
                  <p className="mt-2 text-xs text-ink-500">
                    {c.simulationsThisWeek} simulation
                    {c.simulationsThisWeek === 1 ? "" : "s"} used this week
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {c.enrolled ? (
                    <>
                      <Link to={`/courses/${c.id}`}>
                        <Button variant="primary">Open</Button>
                      </Link>
                      <button
                        type="button"
                        className="text-xs text-ink-500 underline"
                        onClick={() => toggleEnroll(c.id, true)}
                      >
                        Remove
                      </button>
                    </>
                  ) : lockedByPlan ? (
                    <Badge tone="neutral">Plus only</Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      loading={busyId === c.id}
                      disabled={!canAdd}
                      onClick={() => toggleEnroll(c.id, false)}
                    >
                      {atCourseLimit ? "Limit reached" : "Add"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {atCourseLimit && (
        <p className="text-xs text-ink-500">
          Your plan allows {limits.maxCourses} courses. Remove one to add
          another.
        </p>
      )}
    </div>
  );
}
