import {
  Component,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn, friendlyError } from "../lib/utils";

/* ── Button ─────────────────────────────────────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700",
        variant === "secondary" &&
          "border border-ink-900/15 bg-surface text-ink-900 hover:bg-paper-2",
        variant === "ghost" && "text-ink-700 hover:bg-ink-900/5",
        variant === "danger" && "bg-danger-600 text-white hover:bg-danger-700",
        variant === "gold" && "bg-gold-500 text-ink-900 hover:bg-gold-600",
        className,
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

/* ── Card / sections ────────────────────────────────────────────────── */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-900/8 bg-surface p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Form fields ────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint && !error && (
        <span className="block text-xs text-ink-500">{hint}</span>
      )}
      {error && <span className="block text-xs text-danger-600">{error}</span>}
    </label>
  );
}

const fieldClass =
  "w-full rounded-xl border border-ink-900/15 bg-surface px-3.5 py-3 text-base text-ink-900 placeholder:text-ink-500/70 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(fieldClass, "appearance-none", props.className)} />
  );
}

/* ── Badges ─────────────────────────────────────────────────────────── */

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "brand" | "gold" | "danger" | "ink";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tone === "neutral" && "bg-ink-900/8 text-ink-700",
        tone === "brand" && "bg-brand-100 text-brand-700",
        tone === "gold" && "bg-gold-100 text-gold-600",
        tone === "danger" && "bg-danger-100 text-danger-700",
        tone === "ink" && "bg-ink-900 text-paper",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Feedback ───────────────────────────────────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-5 animate-spin text-current", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"
      />
    </svg>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-ink-500">
      <Spinner className="size-5" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return (
    <div className="rounded-xl border border-danger-600/25 bg-danger-100 px-3.5 py-2.5 text-sm text-danger-700">
      {friendlyError(raw)}
    </div>
  );
}

export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gold-500/40 bg-gold-100 px-3.5 py-2.5 text-xs leading-relaxed text-gold-600",
        className,
      )}
    >
      <strong className="font-semibold">Demo data:</strong> courses and
      questions in this build are KefPrep-generated practice material for
      testing only — they are <strong>not</strong> IBBUL past questions.
    </div>
  );
}

/* ── Error boundary for query failures (bad ids, access denied) ─────── */

type BoundaryProps = {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
};
type BoundaryState = { error: Error | null };

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error);
      return (
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-lg font-semibold text-ink-900">
            {friendlyError(this.state.error.message)}
          </p>
          <a
            href="/dashboard"
            className="mt-4 inline-block text-sm font-semibold text-brand-600 underline"
          >
            Back to dashboard
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
