export const cmsDisplayLocations = [
  "footer",
  "app_info",
  "news",
  "home",
  "featured_notice",
  "popup",
] as const;

export const cmsContentTypes = ["article", "fixed_page"] as const;
export const cmsStatuses = ["draft", "published"] as const;

export type CmsDisplayLocation = typeof cmsDisplayLocations[number];
export type CmsContentType = typeof cmsContentTypes[number];
export type CmsStatus = typeof cmsStatuses[number];

export type CmsPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string;
  cover_image_url: string | null;
  image_urls: string[] | null;
  display_locations: CmsDisplayLocation[] | null;
  content_type: CmsContentType;
  status: CmsStatus;
  is_published: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
};

export type DefaultCmsPage = {
  slug: string;
  title: string;
  sortOrder: number;
  displayLocations: CmsDisplayLocation[];
  contentType: CmsContentType;
  status: CmsStatus;
};

export const cmsDisplayLocationLabels: Record<CmsDisplayLocation, string> = {
  footer: "Footer",
  app_info: "M\u1ee5c Th\u00f4ng tin trong app",
  news: "Tin t\u1ee9c",
  home: "Trang ch\u1ee7",
  featured_notice: "Th\u00f4ng b\u00e1o n\u1ed5i b\u1eadt",
  popup: "Popup",
};

export const cmsContentTypeLabels: Record<CmsContentType, string> = {
  article: "B\u00e0i vi\u1ebft",
  fixed_page: "Trang c\u1ed1 \u0111\u1ecbnh",
};

export const cmsStatusLabels: Record<CmsStatus, string> = {
  draft: "Nh\u00e1p",
  published: "Xu\u1ea5t b\u1ea3n",
};

export const defaultCmsPages: DefaultCmsPage[] = [
  {
    slug: "ve-chung-toi",
    title: "V\u1ec1 ch\u00fang t\u00f4i",
    sortOrder: 10,
    displayLocations: ["footer", "app_info"],
    contentType: "fixed_page",
    status: "published",
  },
  {
    slug: "dieu-khoan-su-dung",
    title: "\u0110i\u1ec1u kho\u1ea3n s\u1eed d\u1ee5ng",
    sortOrder: 20,
    displayLocations: ["footer", "app_info"],
    contentType: "fixed_page",
    status: "published",
  },
  {
    slug: "chinh-sach-bao-mat",
    title: "Ch\u00ednh s\u00e1ch b\u1ea3o m\u1eadt",
    sortOrder: 30,
    displayLocations: ["footer", "app_info"],
    contentType: "fixed_page",
    status: "published",
  },
  {
    slug: "chinh-sach-tho",
    title: "Ch\u00ednh s\u00e1ch d\u00e0nh cho th\u1ee3",
    sortOrder: 40,
    displayLocations: ["footer", "app_info"],
    contentType: "fixed_page",
    status: "published",
  },
  {
    slug: "chinh-sach-khach-hang",
    title: "Ch\u00ednh s\u00e1ch d\u00e0nh cho kh\u00e1ch h\u00e0ng",
    sortOrder: 50,
    displayLocations: ["footer", "app_info"],
    contentType: "fixed_page",
    status: "published",
  },
];

export const defaultCmsSlugs = defaultCmsPages.map((page) => page.slug);

export function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
