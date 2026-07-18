-- Недостающие миграции WebComet (бренд + история транзакций)
-- Выполните в Supabase → SQL Editor, если баланс в БД есть, а на сайте 0

-- Бренд
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_logo TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_colors JSONB
  DEFAULT '["#6c3bf4","#ffffff","#0b0f19","#a78bfa","#22d3ee","#f472b6"]'::jsonb;

-- Транзакции
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) DEFAULT 0,
  tokens INT NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'spend', 'bonus', 'refund')),
  model_id TEXT,
  description TEXT,
  yookassa_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_id_idx
  ON public.transactions (user_id, created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
CREATE POLICY "Users can read own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);
