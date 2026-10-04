# KefPrep

**EXPERIENCE THE CBT BEFORE YOU ENTER THE REAL EXAM.**

KefPrep is a CBT/exam-preparation platform for university students, initially
targeting Ibrahim Badamasi Babangida University, Lapai (IBBUL). Students pick a
course, take a timed CBT simulation, get a server-calculated score, review
corrections with explanations, and retake.

> **Demo data notice:** this build seeds clearly-labeled demo content
> (`isDemo: true`, source `KEFPREP_GENERATED`) so the CBT can be tested
> end-to-end. Demo courses and questions are **not** IBBUL past questions. Real
> past questions will be imported separately with source `PAST_QUESTION`.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router |
| Backend / API | Convex functions (`convex/`) — queries & mutations, server-side logic |
| Database | Convex (typed schema in `convex/schema.ts`, indexes included) |
| Auth | Custom session auth: PBKDF2-SHA256 password hashing, opaque bearer sessions (see Security) |
| Runtime | Bun (package manager + scripts), Node 22 compatible |

Why Convex: it gives us a typed database, server-authoritative logic, reactive
queries, scheduled functions (auto-submit) and env-var configuration with no
separate API server to operate — the simplest mature setup Freebuff can run
reliably. The local backend is managed by the preview command.

## Quick start

```bash
bun install               # install dependencies
bun convex dev --once     # codegen + push functions to the local deployment
bun run dev               # start Vite + Convex (0.0.0.0:$PORT, default 5173)
bun run smoke             # backend E2E suite — needs the backend running
```

On Freebuff, the preview runs `bun convex dev --start 'bun run dev'` so the
Convex local backend and the web app run together. The smoke suite tests
against that running backend (standalone alternative: keep
`bun convex dev --once --start "bun scripts/smoke.ts"` up instead).

### Demo data

Seeded by `seedDemoData` (idempotent):

- University: IBBUL, 3 programmes, levels 100–500
- 2 demo courses (`DEMO-MTH101`, `DEMO-CSC101`) with 105 demo questions
- 4 demo CBTs: Format A (35Q/15min/2mk), Format B (70Q/30min/1mk),
  and a 45-second "Timing Check" utility for observing auto-submit
- Plan config (`systemConfig`): FREE/PLUS limits — backend-configurable
- **Demo student (PLUS):** phone `08000000000`, password `DemoPass123`

Fresh signups are FREE: 3 courses, 3 simulations/week (1 per course),
Format A only.

## Project layout

```
convex/
  schema.ts          # full data model (slice tables + structure-only tables)
  users.ts           # signup / login / logout / me
  catalog.ts         # universities, programmes, courses, enrolment, CBT list
  cbt.ts             # CBT engine: start, answer, submit, auto-submit, score,
                     # result, review, history, plan status
  seed.ts            # idempotent demo-data seed
  lib/auth.ts        # PBKDF2 hashing, sessions, requireUser/requireAdmin
  lib/plans.ts       # plan limits, Africa/Lagos weekly window, usage
  lib/rotation.ts    # blueprint-aware, history-aware question selection
  lib/types.ts       # shared types + KFP_* error codes
  seedData/          # demo question banks (labeled)
src/
  pages/             # Landing, Auth, Dashboard, Courses, CbtSelect,
                     # AttemptRunner, Result, Review
  components/        # AppShell + small UI kit (ui.tsx)
  lib/               # auth context, convex URL resolution, utils
scripts/
  smoke.ts           # backend E2E test suite
```

## CBT engine guarantees (enforced server-side)

- Start time, deadline and question set are recorded in the database at start;
  the client countdown is display-only (anchored to server timestamps).
- No pause, no restart: a second `startAttempt` resumes the existing active
  attempt. Leaving the page does not stop the clock.
- Auto-submit has two safety nets: a scheduled internal mutation at
  deadline + grace, and deadline checks inside `answerQuestion`/`submitAttempt`.
- While active, queries never return correct answers, explanations, sources or
  scores.
- Score is computed on submission and stored in `results`; submitted attempts
  are immutable (re-submit is idempotent, further answers are rejected).
- Rotation is seeded per attempt and blueprint-driven (topic quotas, source
  priority, question-history penalties) — not pure random.
- FREE/PLUS limits (courses, weekly simulations, allowed formats) are read from
  `systemConfig` and enforced in mutations; the UI only displays them.
  Weekly quota is account-based with a fixed Monday 00:00 Africa/Lagos reset.

## Security

- Passwords: PBKDF2-SHA256, 100k iterations, per-user 128-bit salt. Never
  stored or logged in plaintext.
- Sessions: 256-bit random token returned to the client once; only its
  SHA-256 hash is stored. Protected functions call `requireUser()`; students
  can only access their own attempts/results (ownership checks).
- Admin vs student: `role` field + `requireAdmin()`; no admin surface is
  exposed yet.
- No secrets in frontend code; env vars come from `.env.local` (Convex
  deployment URLs) and are not committed.

## Testing

```bash
bun tsc -b --noEmit       # typecheck (app + backend + scripts)
bun run smoke             # backend E2E: auth, CBT engine, timer, scoring,
                          # review, rotation, plan limits, security
                          # (requires the local backend to be running)
bun run build             # production build check (outputs dist/)
```

The smoke suite prints `SMOKE RESULT: N passed, 0 failed`. Quota-dependent
checks (retake/rotation) SKIP gracefully once the demo account's weekly quota
is exhausted (demo limits: 10 simulations/course/week).

## Intentionally deferred (not built yet)

- Payments/Plus activation (no fake payment flow), entitlements, exam seasons
- Admin dashboard (schema + role separation only)
- Materials upload, AI question generation, notifications, WhatsApp/SMS
- Production deploy: static hosting needs a **hosted** Convex deployment
  (`convex deploy` + non-loopback `VITE_CONVEX_URL`); the local backend is
  development-only.
- Question history currently feeds rotation only; richer performance analytics
  are future work.
