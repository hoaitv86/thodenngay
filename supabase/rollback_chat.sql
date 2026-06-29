-- Rollback chat tables/policies only. Does not touch jobs, profiles, workers, ratings, or services.

DROP TRIGGER IF EXISTS touch_conversation_on_message ON public.chat_messages;
DROP FUNCTION IF EXISTS public.touch_conversation_updated_at();

DROP POLICY IF EXISTS "Chat participants send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Chat participants view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Chat participants update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Chat participants create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Chat participants view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view admin profiles for chat" ON public.profiles;

DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.conversations;
