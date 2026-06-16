import { useState, type FormEvent } from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const INPUT =
  "w-full border border-zinc-700 bg-zinc-900 text-pink-100 placeholder:text-pink-500/60 px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-pink-400 focus:-outline-offset-1";

// Where the magic link should send the user back to. Resolves to the deployed
// origin + Vite base (e.g. https://jessesbillz-cloud.github.io/TomeKeeper/),
// or the dev server when running locally. The Supabase client is configured
// with detectSessionInUrl, so it picks the session up from the redirect.
const REDIRECT_TO =
  typeof window !== "undefined"
    ? window.location.origin + import.meta.env.BASE_URL
    : undefined;

type Mode = "link" | "password";

export function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>("link");
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
      if (mode === "link") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: REDIRECT_TO },
        });
        if (error) throw error;
        setInfo(
          "Check your email for a sign-in link. Open it on this device and you'll be signed in automatically.",
        );
      } else {
        await signIn(email, password);
        // On success, AuthProvider's onAuthStateChange swaps in the app.
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
          {mode === "link"
            ? "Enter your email and we'll send you a sign-in link"
            : "Sign in with your password"}
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
          className={`${INPUT} ${mode === "link" ? "mb-4" : "mb-3"}`}
        />

        {mode === "password" && (
          <>
            <label
              className="block text-xs text-pink-300 mb-1"
              htmlFor="password"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
              className={`${INPUT} mb-4`}
            />
          </>
        )}

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
            ? mode === "link"
              ? "Sending link…"
              : "Signing in…"
            : mode === "link"
              ? "Email me a sign-in link"
              : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "link" ? "password" : "link"));
            setError(null);
            setInfo(null);
          }}
          className="w-full mt-3 text-xs text-pink-400 hover:text-pink-200 underline"
        >
          {mode === "link"
            ? "Prefer a password? Sign in with password"
            : "Email me a sign-in link instead"}
        </button>
      </form>
    </div>
  );
}
