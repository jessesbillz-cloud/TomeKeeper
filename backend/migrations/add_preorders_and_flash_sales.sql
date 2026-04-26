-- Migration: preorders on editions + flash_sales table
--
-- Run this in the Supabase SQL editor (or `supabase db push` if you wire up
-- the CLI). Idempotent: safe to re-run.
--
-- What this adds:
--   1. preorder_start_at / preorder_end_at on editions
--      -> drives "preorder opens" and "preorder closes" calendar events.
--   2. flash_sales table (per-user)
--      -> drives "flash sale available" events for every day the sale runs.
--      -> linked optionally to an edition; otherwise it's a shop-wide sale.

-- ---------------------------------------------------------------------------
-- 1. editions: preorder window
-- ---------------------------------------------------------------------------

ALTER TABLE public.editions
    ADD COLUMN IF NOT EXISTS preorder_start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS preorder_end_at   TIMESTAMPTZ;

-- Sanity: end must be after start when both are set.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'editions_preorder_window_chk'
    ) THEN
        ALTER TABLE public.editions
            ADD CONSTRAINT editions_preorder_window_chk
            CHECK (
                preorder_end_at IS NULL
                OR preorder_start_at IS NULL
                OR preorder_end_at >= preorder_start_at
            );
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS editions_preorder_start_idx
    ON public.editions (preorder_start_at);
CREATE INDEX IF NOT EXISTS editions_preorder_end_idx
    ON public.editions (preorder_end_at);


-- ---------------------------------------------------------------------------
-- 2. flash_sales (per-user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.flash_sales (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop        TEXT        NOT NULL,
    title       TEXT,
    url         TEXT,
    edition_id  UUID        REFERENCES public.editions(id) ON DELETE SET NULL,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT flash_sales_window_chk CHECK (ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS flash_sales_user_idx       ON public.flash_sales (user_id);
CREATE INDEX IF NOT EXISTS flash_sales_window_idx     ON public.flash_sales (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS flash_sales_shop_idx       ON public.flash_sales (shop);

-- Auto-bump updated_at. Reuses the project's generic trigger if it exists,
-- otherwise creates a small dedicated one. The conditional avoids clobbering
-- a shared `set_updated_at()` if it's already defined.
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

DROP TRIGGER IF EXISTS flash_sales_set_updated_at ON public.flash_sales;
CREATE TRIGGER flash_sales_set_updated_at
    BEFORE UPDATE ON public.flash_sales
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 3. RLS for flash_sales: each row visible only to its owner
-- ---------------------------------------------------------------------------

ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flash_sales_select_own ON public.flash_sales;
CREATE POLICY flash_sales_select_own
    ON public.flash_sales
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS flash_sales_insert_own ON public.flash_sales;
CREATE POLICY flash_sales_insert_own
    ON public.flash_sales
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS flash_sales_update_own ON public.flash_sales;
CREATE POLICY flash_sales_update_own
    ON public.flash_sales
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS flash_sales_delete_own ON public.flash_sales;
CREATE POLICY flash_sales_delete_own
    ON public.flash_sales
    FOR DELETE
    USING (user_id = auth.uid());
