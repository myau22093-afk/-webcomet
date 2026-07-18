-- Выполните этот SQL в Supabase SQL Editor

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  trial_generations_used INT DEFAULT 0,
  subscription_status TEXT DEFAULT 'trial',
  subscription_end_date TIMESTAMP,
  max_trial INT DEFAULT 10,
  tier TEXT DEFAULT 'starter',
  tier_expires_at TIMESTAMP,
  monthly_generations_used INT DEFAULT 0,
  monthly_generations_limit INT DEFAULT 10,
  monthly_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  brand_logo TEXT,
  brand_colors JSONB DEFAULT '["#6c3bf4","#ffffff","#0b0f19","#a78bfa","#22d3ee","#f472b6"]'::jsonb
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_generations_used INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_trial INT DEFAULT 10;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'starter';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMP;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_generations_used INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_generations_limit INT DEFAULT 10;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now();

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

UPDATE public.profiles
SET
  tier = COALESCE(tier, 'starter'),
  monthly_generations_used = COALESCE(monthly_generations_used, 0),
  monthly_generations_limit = COALESCE(monthly_generations_limit, 10),
  monthly_reset_at = COALESCE(monthly_reset_at, now());

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

INSERT INTO public.profiles (
  id,
  email,
  trial_generations_used,
  subscription_status,
  max_trial,
  tier,
  monthly_generations_used,
  monthly_generations_limit,
  monthly_reset_at
)
SELECT
  id,
  email,
  0,
  'trial',
  10,
  'starter',
  0,
  10,
  now()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

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
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
