import { type ReactNode } from "react";

import { useAuth } from "../lib/auth";

/**
 * Pass-through gate. We DO NOT show a Login page here — this is a personal
 * app for one household and the session is persisted in localStorage by
 * supabase-js. If the session ever lapses, individual API calls will fail
 * with a clean 401 error banner; the user is never bounced to a sign-in
 * screen they didn't ask for.
 *
 * We still wait for the auth state to finish loading so pages don't fire
 * API calls with a `null` session and trip the "Not signed in" path
 * unnecessarily on first paint.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-pink-400 text-sm">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
