-- Группировка сообщений чата в один диалог
-- Выполните в Supabase → SQL Editor → Run

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

CREATE INDEX IF NOT EXISTS chats_user_conversation_created_idx
  ON public.chats (user_id, conversation_id, created_at ASC);

-- Старые сообщения: каждое user-сообщение = отдельный «чат»
UPDATE public.chats
SET conversation_id = id
WHERE role = 'user' AND conversation_id IS NULL;

-- Ответы ассистента привязать к предыдущему user-сообщению того же пользователя
UPDATE public.chats a
SET conversation_id = (
  SELECT u.conversation_id
  FROM public.chats u
  WHERE u.user_id = a.user_id
    AND u.role = 'user'
    AND u.created_at <= a.created_at
    AND u.conversation_id IS NOT NULL
  ORDER BY u.created_at DESC
  LIMIT 1
)
WHERE a.role = 'assistant' AND a.conversation_id IS NULL;
