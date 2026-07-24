-- Оптимизация расходов WebComet: кеш генераций, шаблоны, логи API
-- Выполните в Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.cache_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash TEXT NOT NULL UNIQUE,
  html TEXT NOT NULL,
  css TEXT NOT NULL DEFAULT '',
  js TEXT NOT NULL DEFAULT '',
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cache_generations_created_at_idx
  ON public.cache_generations (created_at DESC);

CREATE TABLE IF NOT EXISTS public.templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  html TEXT NOT NULL,
  css TEXT NOT NULL DEFAULT '',
  js TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  route TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_label TEXT,
  provider TEXT,
  token_cost INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT false,
  kind TEXT,
  reason TEXT,
  prompt_hash TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_logs_created_at_idx
  ON public.api_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS api_usage_logs_user_id_idx
  ON public.api_usage_logs (user_id, created_at DESC);

ALTER TABLE public.cache_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Чтение шаблонов — всем авторизованным (запись только service role)
DROP POLICY IF EXISTS "Authenticated read templates" ON public.templates;
CREATE POLICY "Authenticated read templates"
  ON public.templates FOR SELECT
  TO authenticated
  USING (true);

-- Кеш и логи — только service role (политики для authenticated не даём)
