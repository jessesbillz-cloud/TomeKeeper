import { type ReactNode } from "react";

import { useAuth } from "../lib/auth";
import { Login } from "./Login";

/**
 * Auth gate.
 *
 * While the session is loading we show a splash so pages don't fire API calls
 * with a `null` session and trip the "Not signed in" path on first paint.
 *
 * When there is NO active session we render the <Login> screen instead of the
 * app. This is the recovery path: if the persisted session ever lapses (token
 * expiry, a revoked session, cleared PWA storage, etc.) the user gets a real
 * sign-in screen rather than a silently broken app with no way back in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-pink-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <>{children}</>;
}
