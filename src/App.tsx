import type { ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary, Loading } from "./components/ui";
import { useAuth } from "./lib/auth";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import CbtSelect from "./pages/CbtSelect";
import AttemptRunner from "./pages/AttemptRunner";
import Result from "./pages/Result";
import Review from "./pages/Review";

/** Guards authenticated student routes; preserves the intended destination. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { token, user, loading } = useAuth();
  const location = useLocation();

  if (!token) {
    const returnTo = encodeURIComponent(
      location.pathname + location.search,
    );
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
  }
  if (loading) return <Loading label="Checking your session…" />;
  if (!user) {
    const returnTo = encodeURIComponent(
      location.pathname + location.search,
    );
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-4xl font-black text-ink-900">404</p>
      <p className="mt-2 text-ink-500">That page does not exist.</p>
      <a
        href="/"
        className="mt-4 inline-block text-sm font-semibold text-brand-600 underline"
      >
        Go to KefPrep
      </a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:courseId" element={<CbtSelect />} />
          <Route
            path="/attempts/:attemptId"
            element={
              <ErrorBoundary>
                <AttemptRunner />
              </ErrorBoundary>
            }
          />
          <Route
            path="/attempts/:attemptId/result"
            element={
              <ErrorBoundary>
                <Result />
              </ErrorBoundary>
            }
          />
          <Route
            path="/attempts/:attemptId/review"
            element={
              <ErrorBoundary>
                <Review />
              </ErrorBoundary>
            }
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
