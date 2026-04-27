-- Migration: RLS policies for core tables (works, editions, library_entries,
-- orders, forwarded_emails)
--
-- Run this in the Supabase SQL editor (or `supabase db push` if the CLI is
-- wired up). Idempotent: safe to re-run.
--
-- Why this exists:
--   The original FastAPI backend used the service-role key, which bypasses
--   RLS. After porting to Supabase Edge Functions (which run as the calling
--   user), every query started failing with "row-level security" errors
--   because the tables either had RLS enabled with no policies, or the
--   policies were never defined.
--
-- Data-model assumptions (matches backend/tomekeeper/models/*.py):
--   * works            -> shared catalog (no owner column)
--   * editions         -> shared catalog (column: submitted_by_user_id)
--   * library_entries  -> per-user (column: user_id)
--   * orders           -> per-user (column: user_id)
--   * forwarded_emails -> per-user (column: user_id)


-- ---------------------------------------------------------------------------
-- 1. works: shared catalog. Any authenticated user may read and add.
-- ---------------------------------------------------------------------------

ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS works_select_authenticated ON public.works;
CREATE POLICY works_select_authenticated
    ON public.works
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS works_insert_authenticated ON public.works;
CREATE POLICY works_insert_authenticated
    ON public.works
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS works_update_authenticated ON public.works;
CREATE POLICY works_update_authenticated
    ON public.works
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 2. editions: shared catalog stamped with submitter.
--    Any authenticated user may read; insert must stamp the caller as
--    submitted_by_user_id; update is restricted to the original submitter.
-- ---------------------------------------------------------------------------

ALTER TABLE public.editions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS editions_select_authenticated ON public.editions;
CREATE POLICY editions_select_authenticated
    ON public.editions
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS editions_insert_own_submission ON public.editions;
CREATE POLICY editions_insert_own_submission
    ON public.editions
    FOR INSERT
    TO authenticated
    WITH CHECK (submitted_by_user_id = auth.uid());

DROP POLICY IF EXISTS editions_update_own_submission ON public.editions;
CREATE POLICY editions_update_own_submission
    ON public.editions
    FOR UPDATE
    TO authenticated
    USING (submitted_by_user_id = auth.uid())
    WITH CHECK (submitted_by_user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 3. library_entries: per-user; full CRUD on own rows only.
-- ---------------------------------------------------------------------------

ALTER TABLE public.library_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_entries_select_own ON public.library_entries;
CREATE POLICY library_entries_select_own
    ON public.library_entries
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS library_entries_insert_own ON public.library_entries;
CREATE POLICY library_entries_insert_own
    ON public.library_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS library_entries_update_own ON public.library_entries;
CREATE POLICY library_entries_update_own
    ON public.library_entries
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS library_entries_delete_own ON public.library_entries;
CREATE POLICY library_entries_delete_own
    ON public.library_entries
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 4. orders: per-user; full CRUD on own rows only.
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own
    ON public.orders
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS orders_insert_own ON public.orders;
CREATE POLICY orders_insert_own
    ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS orders_update_own ON public.orders;
CREATE POLICY orders_update_own
    ON public.orders
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS orders_delete_own ON public.orders;
CREATE POLICY orders_delete_own
    ON public.orders
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 5. forwarded_emails: per-user; full CRUD on own rows only.
-- ---------------------------------------------------------------------------

ALTER TABLE public.forwarded_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forwarded_emails_select_own ON public.forwarded_emails;
CREATE POLICY forwarded_emails_select_own
    ON public.forwarded_emails
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS forwarded_emails_insert_own ON public.forwarded_emails;
CREATE POLICY forwarded_emails_insert_own
    ON public.forwarded_emails
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS forwarded_emails_update_own ON public.forwarded_emails;
CREATE POLICY forwarded_emails_update_own
    ON public.forwarded_emails
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS forwarded_emails_delete_own ON public.forwarded_emails;
CREATE POLICY forwarded_emails_delete_own
    ON public.forwarded_emails
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
