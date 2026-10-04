import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const STORAGE_KEY = "kefprep_session";

export type AuthUser = {
  id: string;
  fullName: string;
  phone: string;
  role: "student" | "admin";
  plan: "FREE" | "PLUS";
  universityId: string;
  programmeId: string;
  level: number;
  matricNumber: string | null;
  isDemo: boolean;
  createdAt: number;
};

type AuthContextValue = {
  /** Raw session token (also sent as an explicit arg to every protected call). */
  token: string | null;
  /** Server-verified profile; null when signed out or the token is invalid. */
  user: AuthUser | null;
  /** True while a token exists but the profile has not resolved yet. */
  loading: boolean;
  setSession: (token: string) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );
  const logoutMutation = useMutation(api.users.logout);

  const me = useQuery(
    api.users.me,
    token ? { sessionToken: token } : "skip",
  );

  // Drop stale/invalid sessions instead of keeping the user in a broken state.
  useEffect(() => {
    if (token && me === null) {
      localStorage.removeItem(STORAGE_KEY);
      setToken(null);
    }
  }, [token, me]);

  const setSession = useCallback((next: string) => {
    localStorage.setItem(STORAGE_KEY, next);
    setToken(next);
  }, []);

  const signOut = useCallback(async () => {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      try {
        await logoutMutation({ sessionToken: current });
      } catch {
        // Server-side session may already be gone; clear locally regardless.
      }
    }
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, [logoutMutation]);

  const user: AuthUser | null = me
    ? {
        id: me.id,
        fullName: me.fullName,
        phone: me.phone,
        role: me.role,
        plan: me.plan,
        universityId: me.universityId,
        programmeId: me.programmeId,
        level: me.level,
        matricNumber: me.matricNumber,
        isDemo: me.isDemo,
        createdAt: me.createdAt,
      }
    : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading: token !== null && me === undefined,
      setSession,
      signOut,
    }),
    [token, user, me, setSession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
