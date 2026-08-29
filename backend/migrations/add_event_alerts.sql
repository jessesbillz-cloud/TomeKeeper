-- Migration: "Notify me about this" — per-event opt-in push notifications
-- delivered through ntfy.sh.
--
-- Design, in one paragraph:
--   Every event surface in the app (calendar day rows, flash sales,
--   publisher sales, edition detail, the capture form) gets a bell
--   toggle. Toggling it on writes one row into public.event_alerts
--   keyed by (user_id, kind, source_id). A pg_cron job runs every five
--   minutes, resolves each opted-in alert back to its source row to get
--   the event's CALENDAR DAY, and at 08:00 America/Los_Angeles on that
--   day POSTs a notification straight to ntfy.sh from Postgres via
--   pg_net. One notification per event, ever — public.alert_sends is a
--   ledger with a unique key, so a re-run, a clock skew, or a manual
--   invocation cannot produce a duplicate.
--
-- Why the send happens in Postgres and not in an Edge Function:
--   ntfy needs no API key, so there is no secret to plumb. The existing
--   `subscription-watch-daily` cron job reads app.settings.* values that
--   were never actually set on the database, and has therefore failed on
--   every single run since it was created. This path has no such
--   dependency: the URL is a literal and there is nothing to configure.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ---------------------------------------------------------------------------
-- 1. The user's ntfy topic
--
-- A topic is a public channel name on ntfy.sh — anyone who knows the
-- string can read it. It is therefore generated with 12 hex characters
-- of randomness on the end and should be treated like an unlisted URL.
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS ntfy_topic text UNIQUE;

COMMENT ON COLUMN public.user_profiles.ntfy_topic IS
    'ntfy.sh topic this user''s push notifications are published to. '
    'Generated on first use by public.ensure_ntfy_topic(). Treat as an '
    'unlisted URL: anyone holding the string can subscribe to it.';


-- ---------------------------------------------------------------------------
-- 2. The opt-ins
--
-- `source_id` is polymorphic — which table it points at is decided by
-- `kind` — so there is deliberately no foreign key here. Rows whose
-- source has been deleted are swept by the cron function below.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_alerts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN (
                    'release',
                    'preorder_open',
                    'preorder_close',
                    'flash_sale_start',
                    'flash_sale_end',
                    'publisher_sale_start',
                    'publisher_sale_end',
                    'ship',
                    'deliver')),
    source_id   uuid NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, kind, source_id)
);

CREATE INDEX IF NOT EXISTS event_alerts_user_idx
    ON public.event_alerts (user_id);

COMMENT ON TABLE public.event_alerts IS
    'One row per "Notify me about this" toggle the user has switched on. '
    'source_id points at editions / flash_sales / publisher_sales_events / '
    'orders depending on kind.';


-- ---------------------------------------------------------------------------
-- 3. The send-once ledger
--
-- Keyed on (alert_id, event_date) rather than on time, so that if the
-- underlying event is rescheduled to a different day the notification
-- legitimately fires again for the new day — but never twice for the
-- same one.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.alert_sends (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id    uuid NOT NULL REFERENCES public.event_alerts(id) ON DELETE CASCADE,
    event_date  date NOT NULL,
    sent_at     timestamptz NOT NULL DEFAULT now(),
    request_id  bigint,
    UNIQUE (alert_id, event_date)
);

COMMENT ON TABLE public.alert_sends IS
    'Ledger of notifications actually queued to ntfy. The unique key is '
    'what makes a duplicate notification impossible.';


-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.event_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_alerts_select_own ON public.event_alerts;
CREATE POLICY event_alerts_select_own
    ON public.event_alerts FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS event_alerts_insert_own ON public.event_alerts;
CREATE POLICY event_alerts_insert_own
    ON public.event_alerts FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS event_alerts_delete_own ON public.event_alerts;
CREATE POLICY event_alerts_delete_own
    ON public.event_alerts FOR DELETE TO authenticated
    USING (user_id = auth.uid());

ALTER TABLE public.alert_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alert_sends_select_own ON public.alert_sends;
CREATE POLICY alert_sends_select_own
    ON public.alert_sends FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.event_alerts a
        WHERE a.id = alert_sends.alert_id AND a.user_id = auth.uid()
    ));
-- No insert/update/delete policies: only the SECURITY DEFINER sender writes here.


-- ---------------------------------------------------------------------------
-- 5. Private schema for the sender
--
-- `notify` is deliberately NOT exposed through PostgREST, so the
-- cross-user query below can never be reached from the client.
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS notify;
REVOKE ALL ON SCHEMA notify FROM public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 6. Resolve an alert to its event day, title and body
--
-- Returns one row per enabled alert whose source row still exists. The
-- date is the event's day in Pacific time, which is the only clock this
-- app cares about.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify.resolve_alerts()
RETURNS TABLE (
    alert_id    uuid,
    topic       text,
    event_date  date,
    push_title  text,
    push_body   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    WITH tz AS (SELECT 'America/Los_Angeles'::text AS zone)
    SELECT
        a.id,
        p.ntfy_topic,
        CASE a.kind
            WHEN 'release'              THEN ed.release_date
            WHEN 'preorder_open'        THEN (ed.preorder_start_at AT TIME ZONE tz.zone)::date
            WHEN 'preorder_close'       THEN (ed.preorder_end_at   AT TIME ZONE tz.zone)::date
            WHEN 'flash_sale_start'     THEN (fs.starts_at         AT TIME ZONE tz.zone)::date
            WHEN 'flash_sale_end'       THEN (fs.ends_at           AT TIME ZONE tz.zone)::date
            WHEN 'publisher_sale_start' THEN (pe.starts_at         AT TIME ZONE tz.zone)::date
            WHEN 'publisher_sale_end'   THEN (pe.ends_at           AT TIME ZONE tz.zone)::date
            WHEN 'ship'                 THEN o.ship_date
            WHEN 'deliver'              THEN o.delivery_date
        END AS event_date,
        -- Title line = the thing itself, so the banner is self-explaining
        -- on a locked phone.
        CASE a.kind
            WHEN 'release'              THEN COALESCE(w.title, ed.edition_name, 'Release')
            WHEN 'preorder_open'        THEN COALESCE(w.title, ed.edition_name, 'Pre-order')
            WHEN 'preorder_close'       THEN COALESCE(w.title, ed.edition_name, 'Pre-order')
            WHEN 'flash_sale_start'     THEN COALESCE(NULLIF(fs.title, ''), fs.shop)
            WHEN 'flash_sale_end'       THEN COALESCE(NULLIF(fs.title, ''), fs.shop)
            WHEN 'publisher_sale_start' THEN COALESCE(NULLIF(pe.title, ''), pe.publisher)
            WHEN 'publisher_sale_end'   THEN COALESCE(NULLIF(pe.title, ''), pe.publisher)
            WHEN 'ship'                 THEN COALESCE(ow.title, oed.edition_name, o.vendor, 'Order')
            WHEN 'deliver'              THEN COALESCE(ow.title, oed.edition_name, o.vendor, 'Order')
        END AS push_title,
        -- Body = what is happening to it today.
        CASE a.kind
            WHEN 'release' THEN
                'Releases today'
                || COALESCE(' — ' || NULLIF(ed.edition_name, ''), '')
                || COALESCE(' · ' || COALESCE(ed.publisher_or_shop, ed.retailer), '')
            WHEN 'preorder_open' THEN
                'Pre-orders open today'
                || COALESCE(' — ' || NULLIF(ed.edition_name, ''), '')
                || COALESCE(' · ' || COALESCE(ed.publisher_or_shop, ed.retailer), '')
            WHEN 'preorder_close' THEN
                'Last day to pre-order'
                || COALESCE(' — ' || NULLIF(ed.edition_name, ''), '')
                || COALESCE(' · ' || COALESCE(ed.publisher_or_shop, ed.retailer), '')
            WHEN 'flash_sale_start' THEN 'Flash sale starts today at ' || fs.shop
            WHEN 'flash_sale_end'   THEN 'Last day of the flash sale at ' || fs.shop
            WHEN 'publisher_sale_start' THEN 'Sale starts today at ' || pe.publisher
            WHEN 'publisher_sale_end'   THEN 'Last day of the sale at ' || pe.publisher
            WHEN 'ship'    THEN 'Ships today' || COALESCE(' · ' || o.vendor, '')
            WHEN 'deliver' THEN 'Arrives today' || COALESCE(' · ' || o.vendor, '')
        END AS push_body
    FROM public.event_alerts a
    CROSS JOIN tz
    -- LEFT, not inner: a user who has not provisioned a topic yet must
    -- still resolve, or the housekeeping sweep below would read their
    -- alerts as orphans and delete them.
    LEFT JOIN public.user_profiles p ON p.user_id = a.user_id
    LEFT JOIN public.editions ed
           ON ed.id = a.source_id
          AND a.kind IN ('release', 'preorder_open', 'preorder_close')
    LEFT JOIN public.works w ON w.id = ed.work_id
    LEFT JOIN public.flash_sales fs
           ON fs.id = a.source_id
          AND a.kind IN ('flash_sale_start', 'flash_sale_end')
    LEFT JOIN public.publisher_sales_events pe
           ON pe.id = a.source_id
          AND a.kind IN ('publisher_sale_start', 'publisher_sale_end')
    LEFT JOIN public.orders o
           ON o.id = a.source_id
          AND a.kind IN ('ship', 'deliver')
    LEFT JOIN public.editions oed ON oed.id = o.edition_id
    LEFT JOIN public.works ow ON ow.id = oed.work_id;
$$;


-- ---------------------------------------------------------------------------
-- 7. Publish one notification to ntfy
--
-- JSON publish format rather than headers, because book titles contain
-- characters that are not safe in an HTTP header value. Fire-and-forget
-- by design: pg_net queues the request and returns immediately.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify.publish(
    p_topic   text,
    p_title   text,
    p_message text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    req_id bigint;
BEGIN
    SELECT net.http_post(
        url     := 'https://ntfy.sh',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body    := jsonb_build_object(
            'topic',    p_topic,
            'title',    p_title,
            'message',  p_message,
            'priority', 4,
            'tags',     jsonb_build_array('books'),
            'click',    'https://jessesbillz-cloud.github.io/TomeKeeper/'
        ),
        timeout_milliseconds := 15000
    ) INTO req_id;
    RETURN req_id;
END;
$$;


-- ---------------------------------------------------------------------------
-- 8. The scheduled sender
--
-- Fires everything whose 08:00 Pacific has arrived today and has not
-- already been sent. The 14-hour ceiling means a job that was paused for
-- a day comes back without blasting out a pile of stale notifications.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify.send_due_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    zone     constant text := 'America/Los_Angeles';
    send_at  constant time := '08:00';
    r        record;
    req_id   bigint;
    sent     integer := 0;
BEGIN
    FOR r IN
        SELECT q.*
        FROM notify.resolve_alerts() q
        WHERE q.event_date IS NOT NULL
          AND q.topic IS NOT NULL
          AND now() >= ((q.event_date + send_at) AT TIME ZONE zone)
          AND now() <  ((q.event_date + send_at) AT TIME ZONE zone) + interval '14 hours'
          AND NOT EXISTS (
                SELECT 1 FROM public.alert_sends s
                WHERE s.alert_id = q.alert_id
                  AND s.event_date = q.event_date)
    LOOP
        BEGIN
            req_id := notify.publish(r.topic, r.push_title, r.push_body);

            INSERT INTO public.alert_sends (alert_id, event_date, request_id)
            VALUES (r.alert_id, r.event_date, req_id)
            ON CONFLICT (alert_id, event_date) DO NOTHING;

            sent := sent + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Non-fatal, always. One bad row must never stop the rest of
            -- the batch, and a failed notification must never be able to
            -- take anything else down with it.
            RAISE WARNING 'alert % failed to send: %', r.alert_id, SQLERRM;
        END;
    END LOOP;

    -- Housekeeping, cheap and bounded:
    --   a) alerts whose source row no longer exists (she deleted the sale)
    --   b) alerts for events more than 60 days past
    DELETE FROM public.event_alerts a
    WHERE a.created_at < now() - interval '2 days'
      AND NOT EXISTS (
            SELECT 1 FROM notify.resolve_alerts() q
            WHERE q.alert_id = a.id AND q.event_date IS NOT NULL);

    DELETE FROM public.event_alerts a
    USING notify.resolve_alerts() q
    WHERE q.alert_id = a.id
      AND q.event_date < (now() AT TIME ZONE zone)::date - 60;

    RETURN sent;
END;
$$;


-- ---------------------------------------------------------------------------
-- 9. Client-facing RPCs
-- ---------------------------------------------------------------------------

-- Returns the caller's ntfy topic, generating one on first call.
CREATE OR REPLACE FUNCTION public.ensure_ntfy_topic()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    uid    uuid := auth.uid();
    t      text;
    handle text;
    slug   text;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not signed in';
    END IF;

    SELECT p.ntfy_topic, COALESCE(p.username, split_part(u.email, '@', 1))
      INTO t, handle
      FROM public.user_profiles p
      JOIN auth.users u ON u.id = p.user_id
     WHERE p.user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'no profile row for this user';
    END IF;

    IF t IS NOT NULL THEN
        RETURN t;
    END IF;

    slug := regexp_replace(lower(COALESCE(handle, 'reader')), '[^a-z0-9]+', '-', 'g');
    slug := trim(both '-' FROM slug);
    IF slug = '' THEN
        slug := 'reader';
    END IF;

    -- 12 hex characters of randomness: the topic is a public channel on
    -- ntfy.sh, so it has to be unguessable.
    t := 'tomekeeper-' || left(slug, 20) || '-'
         || substr(md5(gen_random_uuid()::text), 1, 12);

    UPDATE public.user_profiles SET ntfy_topic = t WHERE user_id = uid;
    RETURN t;
END;
$$;

-- Sends a test notification to the caller's own topic and returns it, so
-- she can confirm the phone is set up without waiting for a real event.
CREATE OR REPLACE FUNCTION public.send_test_notification()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    t text;
BEGIN
    t := public.ensure_ntfy_topic();
    PERFORM notify.publish(
        t,
        'TomeKeeper',
        'Notifications are working. You''ll get one at 8 AM on the day of anything you tap the bell on.'
    );
    RETURN t;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_ntfy_topic()      FROM public, anon;
REVOKE ALL ON FUNCTION public.send_test_notification() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_ntfy_topic()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_test_notification() TO authenticated;


-- ---------------------------------------------------------------------------
-- 10. Schedule it — every five minutes.
--
-- Note there is nothing to configure: no functions URL, no service-role
-- key, no session settings. That is the whole point.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    jid integer;
BEGIN
    FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'tomekeeper-event-alerts'
    LOOP
        PERFORM cron.unschedule(jid);
    END LOOP;
END $$;

SELECT cron.schedule(
    'tomekeeper-event-alerts',
    '*/5 * * * *',
    $cron$ SELECT notify.send_due_alerts(); $cron$
);
