-- Fix chat_messages RLS so real chat messages can be inserted by conversation participants.
-- Safe to run multiple times after supabase/migration_chat.sql.

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
