-- Опционально: отдельные лимиты для картинок и чата

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_image_generations_used INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_image_generations_limit INT DEFAULT 10;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_chat_messages_used INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_chat_messages_limit INT DEFAULT 100;

UPDATE public.profiles
SET
  monthly_image_generations_used = COALESCE(monthly_image_generations_used, 0),
  monthly_image_generations_limit = COALESCE(monthly_image_generations_limit, COALESCE(monthly_generations_limit, 10)),
  monthly_chat_messages_used = COALESCE(monthly_chat_messages_used, 0),
  monthly_chat_messages_limit = COALESCE(monthly_chat_messages_limit, 100);
