export const helpAudiences = ["PUBLIC", "CUSTOMER", "WORKER", "MANAGER", "OWNER", "ADMIN"] as const;
export type HelpAudience = typeof helpAudiences[number];

export const helpStatuses = ["draft", "published"] as const;
export type HelpStatus = typeof helpStatuses[number];

export type HelpCategory = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type HelpArticle = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  content_html: string;
  cover_image_url: string | null;
  image_urls: string[] | null;
  video_url: string | null;
  sort_order: number;
  status: HelpStatus;
  is_featured: boolean;
  audiences: HelpAudience[];
  help_context: string | null;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
  category?: HelpCategory | null;
};

export const helpAudienceLabels: Record<HelpAudience, string> = {
  PUBLIC: "Công khai (không cần đăng nhập)",
  CUSTOMER: "Khách hàng",
  WORKER: "Thợ",
  MANAGER: "Quản lý",
  OWNER: "Chủ cửa hàng",
  ADMIN: "Admin",
};

export const helpStatusLabels: Record<HelpStatus, string> = {
  draft: "Nháp",
  published: "Published",
};

export function slugifyHelp(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function stripHelpHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getYoutubeEmbedUrl(value?: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.hostname.includes("youtube.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const videoId = url.searchParams.get("v") || (parts[0] === "shorts" ? parts[1] : null);
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    return value;
  } catch {
    return null;
  }
}

export function normalizeHelpArticle(input: unknown): HelpArticle {
  const article = input as HelpArticle & { category?: HelpCategory | HelpCategory[] | null };
  return {
    ...article,
    category: Array.isArray(article.category) ? article.category[0] || null : article.category || null,
  };
}
