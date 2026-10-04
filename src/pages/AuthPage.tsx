import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../lib/auth";
import { Badge, Button, Card, DemoBanner, ErrorNote, Field, Input, Select } from "../components/ui";

const LEVELS_FALLBACK = [100, 200, 300, 400, 500];

export default function AuthPage() {
  const [params] = useSearchParams();
  const mode0 = params.get("mode") === "login" ? "login" : "signup";
  const returnTo = params.get("returnTo") || "/dashboard";
  const { token, setSession, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"signup" | "login">(mode0);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  // Signup form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [universityId, setUniversityId] = useState<string>("");
  const [programmeId, setProgrammeId] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [matricNumber, setMatricNumber] = useState("");
  // Login form state
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const universities = useQuery(api.catalog.listUniversities);
  const programmes = useQuery(
    api.catalog.listProgrammes,
    universityId
      ? { universityId: universityId as Id<"universities"> }
      : "skip",
  );
  const levels = useQuery(api.catalog.listLevels);

  const signup = useMutation(api.users.signup);
  const login = useMutation(api.users.login);

  // Already signed in (e.g. opened /auth while logged in) → go to destination.
  useEffect(() => {
    if (token && !authLoading) navigate(returnTo, { replace: true });
  }, [token, authLoading, navigate, returnTo]);

  const levelOptions = useMemo(
    () =>
      levels && levels.length > 0
        ? levels.map((l) => l.value)
        : LEVELS_FALLBACK,
    [levels],
  );

  const switchMode = (next: "signup" | "login") => {
    setMode(next);
    setError(null);
    window.history.replaceState(
      null,
      "",
      `/auth?mode=${next}&returnTo=${encodeURIComponent(returnTo)}`,
    );
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(new Error("KFP_INVALID_PASSWORD: Passwords do not match."));
      return;
    }
    setSubmitting(true);
    try {
      const result = await signup({
        fullName,
        phone,
        password,
        universityId: universityId as Id<"universities">,
        programmeId: programmeId as Id<"programmes">,
        level: Number(level),
        matricNumber: matricNumber.trim() || undefined,
      });
      setSession(result.sessionToken);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login({
        phone: loginPhone,
        password: loginPassword,
      });
      setSession(result.sessionToken);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = () => {
    setLoginPhone("08000000000");
    setLoginPassword("DemoPass123");
    switchMode("login");
  };

  return (
    <div className="min-h-dvh bg-ink-900">
      <header className="mx-auto flex h-14 max-w-lg items-center justify-between px-4 text-paper">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white">
            K
          </span>
          <span className="text-base font-bold tracking-tight">KefPrep</span>
        </Link>
        <Link to="/" className="text-sm text-paper/70 hover:text-paper">
          ← Back
        </Link>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-16">
        <div className="mb-5">
          <h1 className="text-2xl font-black text-paper">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-paper/70">
            {mode === "signup"
              ? "Sign up with your phone number — no email required."
              : "Sign in to continue your preparation."}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-4 grid grid-cols-2 rounded-xl bg-white/10 p-1">
          {(["signup", "login"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={
                mode === m
                  ? "rounded-lg bg-surface py-2.5 text-sm font-semibold text-ink-900"
                  : "rounded-lg py-2.5 text-sm font-semibold text-paper/70"
              }
            >
              {m === "signup" ? "Sign up" : "Sign in"}
            </button>
          ))}
        </div>

        {error != null && <div className="mb-4"><ErrorNote error={error} /></div>}

        {mode === "signup" ? (
          <Card className="border-0">
            <form onSubmit={submitSignup} className="space-y-4">
              <Field label="Full name">
                <Input
                  required
                  autoComplete="name"
                  placeholder="e.g. Amina Yusuf"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
              <Field label="Phone number" hint="Used to sign in">
                <Input
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="080…"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Password" hint="Min. 8 chars, letter + number">
                  <Input
                    required
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Field label="Confirm password">
                  <Input
                    required
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="University">
                <Select
                  required
                  value={universityId}
                  onChange={(e) => {
                    setUniversityId(e.target.value);
                    setProgrammeId("");
                  }}
                >
                  <option value="" disabled>
                    Select university…
                  </option>
                  {universities?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Programme">
                  <Select
                    required
                    disabled={!universityId}
                    value={programmeId}
                    onChange={(e) => setProgrammeId(e.target.value)}
                  >
                    <option value="" disabled>
                      {universityId ? "Select…" : "Pick university first"}
                    </option>
                    {programmes?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Level">
                  <Select
                    required
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="" disabled>
                      Select level…
                    </option>
                    {levelOptions.map((l) => (
                      <option key={l} value={l}>
                        {l} Level
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Matric number (optional)">
                <Input
                  placeholder="e.g. ICS/22/0001"
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value)}
                />
              </Field>
              <Button type="submit" loading={submitting} className="w-full min-h-12">
                Create account
              </Button>
              <p className="text-center text-sm text-ink-500">
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-semibold text-brand-600 underline"
                  onClick={() => switchMode("login")}
                >
                  Sign in
                </button>
              </p>
            </form>
          </Card>
        ) : (
          <Card className="border-0">
            <form onSubmit={submitLogin} className="space-y-4">
              <Field label="Phone number">
                <Input
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="080…"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                />
              </Field>
              <Field label="Password">
                <Input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </Field>
              <Button type="submit" loading={submitting} className="w-full min-h-12">
                Sign in
              </Button>
              <p className="text-center text-sm text-ink-500">
                New to KefPrep?{" "}
                <button
                  type="button"
                  className="font-semibold text-brand-600 underline"
                  onClick={() => switchMode("signup")}
                >
                  Create an account
                </button>
              </p>
            </form>

            <div className="mt-4 rounded-xl bg-paper-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Demo account
                </span>
                <Badge tone="gold">Demo</Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-ink-700">
                08000000000 · DemoPass123
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-brand-600 underline"
                onClick={fillDemo}
              >
                Fill demo credentials
              </button>
            </div>
          </Card>
        )}

        <div className="mt-5">
          <DemoBanner />
        </div>
      </main>
    </div>
  );
}
