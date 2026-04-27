-- Migration: subscriptions table
--
-- Run this in the Supabase SQL editor (or `supabase db push` if you wire up
-- the CLI). Idempotent: safe to re-run.
--
-- What this adds:
--   1. subscriptions table (per-user)
--      -> tracks recurring book-box / shop subscriptions: provider, monthly
--         cost, renewal date, optional website. The website (when present)
--         is polled by the daily `subscription-watch` edge function which
--         tries to find the next box/release date and writes it to
--         next_known_release / next_known_title for the UI to surface.
--
-- ---------------------------------------------------------------------------
-- 1. subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider            TEXT         NOT NULL,
    monthly_cost        NUMERIC(10,2),
    renewal_date        DATE,
    website             TEXT,
    notes               TEXT,
    last_checked_at     TIMESTAMPTZ,
    next_known_release  DATE,
    next_known_title    TEXT,
    next_known_notes    TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_renewal_idx ON public.subscriptions (renewal_date);
CREATE INDEX IF NOT EXISTS subscriptions_next_release_idx ON public.subscriptions (next_known_release);

-- Reuse the shared updated_at trigger function if it exists; otherwise
-- create it. Mirrors the pattern in add_preorders_and_flash_sales.sql.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
    ) THEN
        CREATE FUNCTION public.set_updated_at() RETURNS trigger AS $fn$
        BEGIN
            NEW.updated_at := now();
            RETURN NEW;
        END;
        $fn$ LANGUAGE plpgsql;
    END IF;
END$$;

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. RLS: each row visible only to its owner
-- ---------------------------------------------------------------------------

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own
    ON public.subscriptions
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;
CREATE POLICY subscriptions_insert_own
    ON public.subscriptions
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;
CREATE POLICY subscriptions_update_own
    ON public.subscriptions
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_delete_own ON public.subscriptions;
CREATE POLICY subscriptions_delete_own
    ON public.subscriptions
    FOR DELETE
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. service-role read for the watcher
-- ---------------------------------------------------------------------------
-- The subscription-watch edge function runs with the service-role key (no
-- per-user JWT) so it can scan everyone's subscriptions and update
-- next_known_release. The service role bypasses RLS by default in Supabase,
-- so no extra policy is needed here. Documenting it so it's not surprising.
