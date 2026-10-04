import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Badge, Button, Card, DemoBanner } from "../components/ui";

const STEPS = [
  { n: 1, title: "Choose your course", text: "Enrol in up to your plan's courses." },
  { n: 2, title: "Choose a CBT", text: "Pick a format — 35 or 70 questions." },
  { n: 3, title: "Start the simulation", text: "Server-set timer begins. No pause, no restart." },
  { n: 4, title: "Submit or auto-submit", text: "Finish early, or the server submits you at time-up." },
  { n: 5, title: "Score & corrections", text: "Instant score, explanations, then retake." },
];

const FORMAT_A = {
  name: "Format A",
  questions: "35 questions",
  time: "15 minutes",
  marks: "2 marks each · 70 total",
  note: "Free plan format",
};
const FORMAT_B = {
  name: "Format B",
  questions: "70 questions",
  time: "30 minutes",
  marks: "1 mark each · 70 total",
  note: "Plus plan",
};

export default function Landing() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const startHref = token ? "/dashboard" : "/auth";

  return (
    <div className="min-h-dvh bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-ink-900 text-paper">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white">
              K
            </span>
            <span className="text-base font-bold tracking-tight">KefPrep</span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/auth?mode=login" className="rounded-lg px-3 py-2 text-paper/80 hover:bg-white/10 hover:text-paper">
              Sign in
            </Link>
            <Link to="/auth" className="rounded-lg bg-brand-600 px-3 py-2 font-semibold text-white hover:bg-brand-700">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-ink-900 text-paper">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:py-20">
          <Badge tone="gold" className="mb-5">CBT exam preparation</Badge>
          <h1 className="max-w-2xl text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl">
            Experience the CBT before you enter the{" "}
            <span className="text-gold-500">real exam.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-paper/75 sm:text-lg">
            Realistic, timed CBT simulations for university students. Built for
            smartphones, scored by the server, with full corrections the moment
            you submit.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              variant="gold"
              className="min-h-12 px-6 text-base"
              onClick={() => navigate(startHref)}
            >
              {token ? "Open dashboard" : "Start practising free"}
            </Button>
            <Link
              to="/auth?mode=login"
              className="inline-flex min-h-12 items-center rounded-xl border border-white/25 px-6 text-base font-semibold text-paper hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-xs uppercase tracking-widest text-paper/50">
            Free plan: 3 courses · 3 simulations per week · Format A
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <DemoBanner />
      </div>

      {/* How it works */}
      <section className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">
          How KefPrep works
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {STEPS.map((step) => (
            <li key={step.n}>
              <Card className="h-full">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-bold text-paper">
                    {step.n}
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">{step.title}</p>
                    <p className="mt-0.5 text-sm text-ink-500">{step.text}</p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Formats */}
      <section className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">
          Two CBT formats, exam conditions
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[FORMAT_A, FORMAT_B].map((fmt) => (
            <Card key={fmt.name} className="bg-ink-900 text-paper">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{fmt.name}</h3>
                <Badge tone="gold">{fmt.note}</Badge>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm text-paper/80">
                <div className="flex justify-between border-b border-white/10 pb-1.5">
                  <dt>Questions</dt>
                  <dd className="font-semibold text-paper">{fmt.questions}</dd>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1.5">
                  <dt>Time limit</dt>
                  <dd className="font-semibold text-paper">{fmt.time}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Marks</dt>
                  <dd className="font-semibold text-paper">{fmt.marks}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-500">
          The timer is enforced by the server. Leave the page and time keeps
          running; at time-up your script is submitted automatically and scored
          — answers and explanations unlock only after submission.
        </p>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">
          Simple plans
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink-900">Free</h3>
              <Badge tone="brand">₦0</Badge>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-700">
              <li>✓ Up to 3 designated Free courses</li>
              <li>✓ 3 simulations per week (1 per course)</li>
              <li>✓ Format A — 35 questions</li>
              <li>✓ Corrections &amp; explanations after submission</li>
              <li>✓ Account-level weekly quota (works across devices)</li>
            </ul>
          </Card>
          <Card className="border-gold-500/60">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink-900">Plus</h3>
              <Badge tone="gold">₦1,000 · exam season</Badge>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-700">
              <li>✓ All available courses</li>
              <li>✓ Format A (35Q) and Format B (70Q)</li>
              <li>✓ Higher weekly simulation limits</li>
              <li>✓ Full history &amp; performance tracking</li>
              <li>✓ More materials &amp; question-generation quota</li>
            </ul>
            <p className="mt-3 rounded-lg bg-paper-2 px-3 py-2 text-xs text-ink-500">
              Online payment is <strong>not live yet</strong> — Plus activates
              only after a verified payment in a later release.
            </p>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl bg-brand-700 px-6 py-8 text-center text-white">
          <h2 className="text-xl font-bold sm:text-2xl">
            Ready to walk into the exam hall early?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
            Create your free account, pick a course and start your first
            simulation in minutes.
          </p>
          <div className="mt-5">
            <Button
              variant="gold"
              className="min-h-12 px-8 text-base"
              onClick={() => navigate(startHref)}
            >
              {token ? "Open dashboard" : "Create free account"}
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-900/10 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <strong className="text-ink-700">KefPrep</strong> — experience the
            CBT before you enter the real exam.
          </p>
          <p>Demo build · Ibrahim Badamasi Babangida University, Lapai</p>
        </div>
      </footer>
    </div>
  );
}
