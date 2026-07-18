-- Версии сайтов (группировка по root_prompt)
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS root_prompt TEXT;

UPDATE public.sites
SET root_prompt = prompt
WHERE root_prompt IS NULL;

CREATE INDEX IF NOT EXISTS sites_user_root_prompt_idx
  ON public.sites (user_id, root_prompt, version DESC);
