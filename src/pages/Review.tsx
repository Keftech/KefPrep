import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../lib/auth";
import { Badge, Card, DemoBanner, Loading } from "../components/ui";
import { cn } from "../lib/utils";

type Filter = "ALL" | "INCORRECT" | "UNANSWERED";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function Review() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { token } = useAuth();
  const [filter, setFilter] = useState<Filter>("ALL");

  const attempt = useQuery(
    api.cbt.getAttempt,
    token && attemptId
      ? { sessionToken: token, attemptId: attemptId as never }
      : "skip",
  );
  const review = useQuery(
    api.cbt.getReview,
    token && attemptId
      ? { sessionToken: token, attemptId: attemptId as never }
      : "skip",
  );

  if (!attempt || !review) return <Loading label="Loading corrections…" />;

  if (attempt.status === "ACTIVE") {
    return (
      <div className="py-10 text-center">
        <p className="font-semibold text-ink-900">
          Corrections open after submission.
        </p>
        <Link
          to={`/attempts/${attemptId}`}
          className="mt-2 inline-block text-sm text-brand-600 underline"
        >
          Back to the CBT
        </Link>
      </div>
    );
  }

  const items = review.items.filter((item) =>
    filter === "ALL" ? true : item.status === filter,
  );
  const counts = {
    ALL: review.items.length,
    INCORRECT: review.items.filter((i) => i.status === "INCORRECT").length,
    UNANSWERED: review.items.filter((i) => i.status === "UNANSWERED").length,
  };

  return (
    <div className="space-y-4">
      <div>
        <Link
          to={`/attempts/${attemptId}/result`}
          className="text-sm text-brand-600 underline"
        >
          ← Result
        </Link>
        <h1 className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">
          Corrections &amp; explanations
        </h1>
        {review.summary && (
          <p className="mt-1 text-sm text-ink-500">
            Score {review.summary.score}/{review.summary.maxScore} ·{" "}
            {review.summary.percentage}%
          </p>
        )}
      </div>

      <DemoBanner />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ALL", `All (${counts.ALL})`],
            ["INCORRECT", `Incorrect (${counts.INCORRECT})`],
            ["UNANSWERED", `Unanswered (${counts.UNANSWERED})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === key
                ? "bg-ink-900 text-paper"
                : "bg-ink-900/8 text-ink-700 hover:bg-ink-900/15",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <Card>
            <p className="text-sm text-ink-500">
              Nothing in this filter — nice work.
            </p>
          </Card>
        )}
        {items.map((item) => (
          <Card
            key={item.questionId}
            className={cn(
              item.status === "CORRECT" && "border-brand-500/40",
              item.status === "INCORRECT" && "border-danger-600/35",
              item.status === "UNANSWERED" && "border-ink-900/20",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Q{item.index + 1} · {item.topicName}
              </p>
              <Badge
                tone={
                  item.status === "CORRECT"
                    ? "brand"
                    : item.status === "INCORRECT"
                      ? "danger"
                      : "neutral"
                }
              >
                {item.status === "CORRECT"
                  ? "Correct"
                  : item.status === "INCORRECT"
                    ? "Incorrect"
                    : "Unanswered"}
              </Badge>
            </div>

            <p className="mt-2 text-base font-medium leading-relaxed text-ink-900">
              {item.text}
            </p>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-ink-500">Your answer</dt>
                <dd
                  className={cn(
                    "font-medium",
                    item.status === "CORRECT"
                      ? "text-brand-600"
                      : item.yourAnswerIndex === null
                        ? "text-ink-500"
                        : "text-danger-600",
                  )}
                >
                  {item.yourAnswerText !== null
                    ? `${OPTION_LETTERS[item.yourAnswerIndex ?? 0]}. ${item.yourAnswerText}`
                    : "— not answered —"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-ink-500">Correct</dt>
                <dd className="font-semibold text-ink-900">
                  {OPTION_LETTERS[item.correctOptionIndex]}.{" "}
                  {item.correctAnswerText}
                </dd>
              </div>
            </dl>

            {item.explanation && (
              <div className="mt-3 rounded-xl bg-paper-2 px-3.5 py-3 text-sm leading-relaxed text-ink-700">
                <span className="font-semibold text-ink-900">
                  Explanation:{" "}
                </span>
                {item.explanation}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{item.source}</Badge>
              {item.isDemo && <Badge tone="gold">Demo question</Badge>}
              <span className="text-[11px] text-ink-500">
                {item.difficulty.toLowerCase()}
                {item.sourceMeta?.label ? ` · ${item.sourceMeta.label}` : ""}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 pb-4">
        <Link to={`/attempts/${attemptId}`} className="flex-1">
          <button
            type="button"
            className="w-full rounded-xl border border-ink-900/15 bg-surface px-4 py-3 text-sm font-semibold text-ink-900"
          >
            Attempt summary
          </button>
        </Link>
        <Link to="/dashboard" className="flex-1">
          <button
            type="button"
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Done
          </button>
        </Link>
      </div>
    </div>
  );
}
