import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState, } from "react";
import { supabase } from "./supabase";
const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data }) => {
            if (!mounted)
                return;
            setSession(data.session);
            setLoading(false);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
            setSession(s);
        });
        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, []);
    const value = useMemo(() => ({
        loading,
        session,
        user: session?.user ?? null,
        signIn: async (email, password) => {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error)
                throw error;
        },
        signOut: async () => {
            await supabase.auth.signOut();
        },
    }), [loading, session]);
    return _jsx(AuthCtx.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthCtx);
    if (!ctx)
        throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
