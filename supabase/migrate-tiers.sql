-- Быстрая миграция тарифов (выполните в Supabase SQL Editor)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'starter';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMP;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_generations_used INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_generations_limit INT DEFAULT 10;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now();

UPDATE public.profiles
SET
  tier = COALESCE(tier, 'starter'),
  monthly_generations_used = COALESCE(monthly_generations_used, 0),
  monthly_generations_limit = COALESCE(monthly_generations_limit, 10),
  monthly_reset_at = COALESCE(monthly_reset_at, now());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, trial_generations_used, subscription_status, max_trial,
    tier, monthly_generations_used, monthly_generations_limit, monthly_reset_at
  )
  VALUES (
    NEW.id, NEW.email, 0, 'trial', 10,
    'starter', 0, 10, now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
