-- Chat for Alotho: customer-worker, admin-worker, admin-customer.
-- Safe to run multiple times. Does not modify jobs, workers, customers, ratings, or services.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('customer_worker', 'admin_worker', 'admin_customer')),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT conversations_participants_match_type CHECK (
    (type = 'customer_worker' AND customer_id IS NOT NULL AND worker_id IS NOT NULL AND admin_id IS NULL)
    OR
    (type = 'admin_worker' AND admin_id IS NOT NULL AND worker_id IS NOT NULL AND customer_id IS NULL)
    OR
    (type = 'admin_customer' AND admin_id IS NOT NULL AND customer_id IS NOT NULL AND worker_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_customer_worker_unique
  ON public.conversations (customer_id, worker_id)
  WHERE type = 'customer_worker';

CREATE UNIQUE INDEX IF NOT EXISTS conversations_admin_worker_unique
  ON public.conversations (admin_id, worker_id)
  WHERE type = 'admin_worker';

CREATE UNIQUE INDEX IF NOT EXISTS conversations_admin_customer_unique
  ON public.conversations (admin_id, customer_id)
  WHERE type = 'admin_customer';

CREATE INDEX IF NOT EXISTS chat_messages_conversation_created_at_idx
  ON public.chat_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS conversations_updated_at_idx
  ON public.conversations (updated_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_chat_conversation(p_conversation_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.conversations
    WHERE id = p_conversation_id
      AND (
        public.is_admin()
        OR auth.uid() = customer_id
        OR auth.uid() = worker_id
        OR auth.uid() = admin_id
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Users can view admin profiles for chat" ON public.profiles;
CREATE POLICY "Users can view admin profiles for chat"
  ON public.profiles
  FOR SELECT
  USING (role = 'admin');

DROP POLICY IF EXISTS "Chat participants view conversations" ON public.conversations;
CREATE POLICY "Chat participants view conversations"
  ON public.conversations
  FOR SELECT
  USING (
    public.is_admin()
    OR auth.uid() = customer_id
    OR auth.uid() = worker_id
    OR auth.uid() = admin_id
  );

DROP POLICY IF EXISTS "Chat participants create conversations" ON public.conversations;
CREATE POLICY "Chat participants create conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR auth.uid() = customer_id
    OR auth.uid() = worker_id
    OR auth.uid() = admin_id
  );

DROP POLICY IF EXISTS "Chat participants update conversations" ON public.conversations;
CREATE POLICY "Chat participants update conversations"
  ON public.conversations
  FOR UPDATE
  USING (
    public.is_admin()
    OR auth.uid() = customer_id
    OR auth.uid() = worker_id
    OR auth.uid() = admin_id
  )
  WITH CHECK (
    public.is_admin()
    OR auth.uid() = customer_id
    OR auth.uid() = worker_id
    OR auth.uid() = admin_id
  );

DROP POLICY IF EXISTS "Chat participants view messages" ON public.chat_messages;
CREATE POLICY "Chat participants view messages"
  ON public.chat_messages
  FOR SELECT
  USING (public.can_access_chat_conversation(conversation_id));

DROP POLICY IF EXISTS "Chat participants send messages" ON public.chat_messages;
CREATE POLICY "Chat participants send messages"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.can_access_chat_conversation(conversation_id)
  );

CREATE OR REPLACE FUNCTION public.touch_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS touch_conversation_on_message ON public.chat_messages;
CREATE TRIGGER touch_conversation_on_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE PROCEDURE public.touch_conversation_updated_at();
