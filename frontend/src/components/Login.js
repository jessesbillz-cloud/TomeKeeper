import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useAuth } from "../lib/auth";
export function Login() {
    const { signIn } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    async function onSubmit(e) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await signIn(email, password);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center px-4", children: _jsxs("form", { onSubmit: onSubmit, className: "w-full max-w-sm border border-zinc-300 bg-white p-6", children: [_jsx("h1", { className: "text-lg font-semibold mb-4", children: "TomeKeeper" }), _jsx("label", { className: "block text-sm mb-1", htmlFor: "email", children: "Email" }), _jsx("input", { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, autoComplete: "email", className: "w-full border border-zinc-300 px-2 py-1 mb-3" }), _jsx("label", { className: "block text-sm mb-1", htmlFor: "password", children: "Password" }), _jsx("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, autoComplete: "current-password", className: "w-full border border-zinc-300 px-2 py-1 mb-4" }), error && (_jsx("div", { className: "text-sm text-red-700 mb-3 border border-red-300 bg-red-50 p-2", children: error })), _jsx("button", { type: "submit", disabled: submitting, className: "w-full border border-zinc-900 bg-zinc-900 text-white py-1.5 disabled:opacity-50", children: submitting ? "Signing in…" : "Sign in" })] }) }));
}
