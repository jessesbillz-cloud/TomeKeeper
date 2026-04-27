-- Migration: schedule the subscription-watch edge function once per day.
--
-- Uses Supabase's bundled pg_cron + pg_net extensions. Idempotent: safe
-- to re-run; we unschedule any prior version of the same job before
-- creating it.
--
-- Before running this, fill in two SQL editor "session settings" so the
-- secrets don't end up in the migration file:
--
--   set local "app.settings.functions_url" = 'https://<project-ref>.functions.supabase.co';
--   set local "app.settings.service_role_key" = '<your service role key>';
--
-- Or, more durably, set them as database parameters (Project Settings →
-- Database → Custom Postgres Config) so they survive across sessions:
--
--   ALTER DATABASE postgres SET app.settings.functions_url
--       = 'https://<project-ref>.functions.supabase.co';
--   ALTER DATABASE postgres SET app.settings.service_role_key
--       = '<service role key>';
--
-- Once those are in place, this migration just creates the schedule.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any prior copy of the job before re-creating, so re-running the
-- migration doesn't stack duplicate schedules.
DO $$
DECLARE
    jid INTEGER;
BEGIN
    FOR jid IN
        SELECT jobid FROM cron.job WHERE jobname = 'subscription-watch-daily'
    LOOP
        PERFORM cron.unschedule(jid);
    END LOOP;
END $$;

-- 13:30 UTC ≈ 6:30 AM Pacific (PDT) / 5:30 AM Pacific (PST). A morning
-- slot means any updated next_known_release values are visible by the
-- time Janelle checks the app over coffee.
SELECT cron.schedule(
    'subscription-watch-daily',
    '30 13 * * *',
    $cron$
        SELECT net.http_post(
            url := current_setting('app.settings.functions_url') || '/subscription-watch',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 60000
        );
    $cron$
);
