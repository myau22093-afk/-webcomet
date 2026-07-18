-- Кэш промптов для генерации сайтов
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS prompt_hash TEXT;
CREATE INDEX IF NOT EXISTS sites_user_prompt_hash_idx
  ON public.sites (user_id, prompt_hash);
