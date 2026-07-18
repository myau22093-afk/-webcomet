-- История генераций WebComet
-- Выполните в Supabase → SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  html TEXT NOT NULL DEFAULT '',
  css TEXT NOT NULL DEFAULT '',
  js TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-image-2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  conversation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sites_user_created_idx ON public.sites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS images_user_created_idx ON public.images (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chats_user_created_idx ON public.chats (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chats_user_conversation_created_idx
  ON public.chats (user_id, conversation_id, created_at ASC);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own sites" ON public.sites;
CREATE POLICY "Users read own sites" ON public.sites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own sites" ON public.sites;
CREATE POLICY "Users insert own sites" ON public.sites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own sites" ON public.sites;
CREATE POLICY "Users delete own sites" ON public.sites
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own images" ON public.images;
CREATE POLICY "Users read own images" ON public.images
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own images" ON public.images;
CREATE POLICY "Users insert own images" ON public.images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own images" ON public.images;
CREATE POLICY "Users delete own images" ON public.images
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own chats" ON public.chats;
CREATE POLICY "Users read own chats" ON public.chats
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own chats" ON public.chats;
CREATE POLICY "Users insert own chats" ON public.chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own chats" ON public.chats;
CREATE POLICY "Users delete own chats" ON public.chats
  FOR DELETE USING (auth.uid() = user_id);
