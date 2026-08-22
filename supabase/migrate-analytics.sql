-- Аналитика WebComet: сессии и события (как своя метрика для CRM)
-- Выполните в Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  first_path TEXT,
  last_path TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  page_views INT NOT NULL DEFAULT 1,
  events_count INT NOT NULL DEFAULT 0,
  duration_sec INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  event_name TEXT NOT NULL,
  event_label TEXT,
  path TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_sessions_started_at_idx
  ON public.analytics_sessions (started_at DESC);

CREATE INDEX IF NOT EXISTS analytics_sessions_last_seen_at_idx
  ON public.analytics_sessions (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS analytics_sessions_user_id_idx
  ON public.analytics_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON public.analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_session_id_idx
  ON public.analytics_events (session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS analytics_events_name_idx
  ON public.analytics_events (event_name, created_at DESC);

ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Только service role пишет/читает (API через createAdminClient)
