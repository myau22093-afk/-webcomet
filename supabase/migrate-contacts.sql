-- Контакты профиля для подстановки на сайты
-- Выполните в Supabase → SQL Editor → Run

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS socials JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_contacts BOOLEAN DEFAULT true;

UPDATE public.profiles
SET
  socials = COALESCE(socials, '[]'::jsonb),
  show_contacts = COALESCE(show_contacts, true)
WHERE socials IS NULL OR show_contacts IS NULL;
