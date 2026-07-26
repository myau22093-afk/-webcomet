-- Публикации сайтов на поддомене /s/{slug}
CREATE TABLE IF NOT EXISTS public.published_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  site_id UUID NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired')),
  expires_at TIMESTAMPTZ NULL,
  package_id TEXT NULL,
  yookassa_payment_id TEXT UNIQUE,
  html TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS published_sites_user_id_idx
  ON public.published_sites (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS published_sites_slug_idx
  ON public.published_sites (slug);

ALTER TABLE public.published_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own published sites" ON public.published_sites;
CREATE POLICY "Users can read own published sites"
  ON public.published_sites FOR SELECT
  USING (auth.uid() = user_id);
