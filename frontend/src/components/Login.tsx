import { useState, type FormEvent } from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const INPUT =
  "w-full border border-zinc-700 bg-zinc-900 text-pink-100 placeholder:text-pink-500/60 px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-pink-400 focus:-outline-offset-1";

export function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          // Auto-confirmed: AuthProvider's onAuthStateChange will pick it up.
        } else {
          setInfo(
            "Check your email for a confirmation link, then come back and sign in.",
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-black">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-6 shadow-[0_4px_20px_rgba(236,72,153,0.15)]"
      >
        <h1 className="text-lg font-semibold mb-1 text-pink-300 tracking-wide text-center">
          TomeKeeper
        </h1>
        <p className="text-xs text-pink-500 text-center mb-5">
          {mode === "signin" ? "Sign in to continue" : "Create your account"}
        </p>

        <label className="block text-xs text-pink-300 mb-1" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={`${INPUT} mb-3`}
        />

        <label className="block text-xs text-pink-300 mb-1" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={
            mode === "signin" ? "current-password" : "new-password"
          }
          className={`${INPUT} mb-4`}
        />

        {error && (
          <div className="text-xs text-red-300 mb-3 border border-red-800 bg-red-950/40 p-2">
            {error}
          </div>
        )}
        {info && (
          <div className="text-xs text-pink-200 mb-3 border border-pink-500/40 bg-pink-950/40 p-2">
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-pink-500 text-black py-1.5 text-sm font-medium hover:bg-pink-400 disabled:opacity-50"
        >
          {submitting
            ? mode === "signin"
              ? "Signing in…"
              : "Creating account…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
            setInfo(null);
          }}
          className="w-full mt-3 text-xs text-pink-400 hover:text-pink-200 underline"
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
