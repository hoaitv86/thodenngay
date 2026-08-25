import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { JourneyPost } from "@/lib/journey";

const journeySelect = "id,title,slug,summary,content,sort_order,status,created_at,updated_at";

function getPublicJourneyClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getPublishedJourneyPosts() {
  const supabase = getPublicJourneyClient();
  if (!supabase) return [] as JourneyPost[];

  try {
    const { data, error } = await supabase
      .from("journey_posts")
      .select(journeySelect)
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not load journey posts:", error.message);
      return [] as JourneyPost[];
    }

    return (data || []) as JourneyPost[];
  } catch (error) {
    console.warn("Could not connect to journey posts:", error);
    return [] as JourneyPost[];
  }
}
