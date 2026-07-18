-- Система токенов WebComet
-- Выполните в Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS token_balance INT DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_tokens_used INT DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_tokens_claimed BOOLEAN DEFAULT false;

UPDATE public.profiles
SET
  token_balance = COALESCE(token_balance, 0),
  total_tokens_used = COALESCE(total_tokens_used, 0),
  free_tokens_claimed = COALESCE(free_tokens_claimed, false);

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

-- Новым пользователям — FREE_TOKENS = 100
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    trial_generations_used,
    subscription_status,
    max_trial,
    tier,
    monthly_generations_used,
    monthly_generations_limit,
    monthly_reset_at,
    token_balance,
    total_tokens_used,
    free_tokens_claimed
  )
  VALUES (
    NEW.id,
    NEW.email,
    0,
    'trial',
    10,
    'starter',
    0,
    10,
    now(),
    100,
    0,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- бонус-транзакция при регистрации
  INSERT INTO public.transactions (user_id, amount, tokens, type, description)
  VALUES (NEW.id, 0, 100, 'bonus', 'Бесплатные токены при регистрации')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Существующим без бонуса — начислить 100 один раз
UPDATE public.profiles
SET
  token_balance = COALESCE(token_balance, 0) + 100,
  free_tokens_claimed = true
WHERE COALESCE(free_tokens_claimed, false) = false;

INSERT INTO public.transactions (user_id, amount, tokens, type, description)
SELECT id, 0, 100, 'bonus', 'Бесплатные токены (миграция)'
FROM public.profiles
WHERE free_tokens_claimed = true
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.user_id = profiles.id AND t.type = 'bonus'
  );
