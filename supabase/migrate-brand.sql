-- Бренд-стиль профиля: логотип + цвета
-- Выполните в Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_logo TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_colors JSONB
  DEFAULT '["#6c3bf4","#ffffff","#0b0f19","#a78bfa","#22d3ee","#f472b6"]'::jsonb;
