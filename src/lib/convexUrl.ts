/**
 * The Convex client URL used in the browser.
 *
 * In development the configured VITE_CONVEX_URL points at the local backend
 * (127.0.0.1), which a remote browser cannot reach directly — so we use the
 * current origin and let the Vite dev server proxy /api and /version to the
 * backend. When a hosted (non-loopback) Convex deployment is configured, its
 * URL is used as-is.
 */
export function resolveConvexUrl(): string {
  const raw = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!raw) {
    return window.location.origin;
  }
  try {
    const parsed = new URL(raw);
    const loopback =
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "::1" ||
      parsed.hostname === "[::1]";
    return loopback ? window.location.origin : parsed.toString();
  } catch {
    return raw;
  }
}
