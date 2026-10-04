import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Badge, Button } from "./ui";
import { cn } from "../lib/utils";

/**
 * Authenticated app chrome: sticky header, plan badge, sign-out, and a
 * mobile-first bottom navigation bar.
 */
export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const navItems = [
    { to: "/dashboard", label: "Home" },
    { to: "/courses", label: "Courses" },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-900 text-paper">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white">
              K
            </span>
            <span className="text-base font-bold tracking-tight">KefPrep</span>
          </Link>
          <div className="flex items-center gap-2">
            {user && (
              <span className="hidden text-sm text-paper/70 sm:inline">
                {user.fullName.split(" ")[0]}
              </span>
            )}
            {user && (
              <Badge tone={user.plan === "PLUS" ? "gold" : "brand"}>
                {user.plan}
              </Badge>
            )}
            <Button
              variant="ghost"
              className="text-paper/80 hover:bg-white/10 hover:text-paper"
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-24 sm:pb-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-900/10 bg-surface/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex-1 py-3 text-center text-sm font-semibold",
                  isActive ? "text-brand-600" : "text-ink-500",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
