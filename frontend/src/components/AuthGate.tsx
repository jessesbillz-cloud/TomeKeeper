import { type ReactNode } from "react";

import { useAuth } from "../lib/auth";
import { Login } from "./Login";

/**
 * Gates the rest of the app behind a Supabase session. While we're loading
 * the session from localStorage we show a tiny "Loading…" placeholder; if
 * there's no session we mount <Login>; otherwise we render children.
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
