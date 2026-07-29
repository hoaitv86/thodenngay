export const cmsDisplayLocations = [
  "footer",
  "news",
  "home",
  "featured_notice",
  "popup",
] as const;

export type CmsDisplayLocation = typeof cmsDisplayLocations[number];

export type CmsPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string;
  cover_image_url: string | null;
  image_urls: string[] | null;
  display_locations: CmsDisplayLocation[] | null;
  is_published: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
};

export type DefaultCmsPage = {
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  sortOrder: number;
  displayLocations: CmsDisplayLocation[];
};

export const cmsDisplayLocationLabels: Record<CmsDisplayLocation, string> = {
  footer: "Footer",
  news: "Tin t\u1ee9c",
  home: "Trang ch\u1ee7",
  featured_notice: "Th\u00f4ng b\u00e1o n\u1ed5i b\u1eadt",
  popup: "Popup",
};

export const defaultCmsPages: DefaultCmsPage[] = [
  {
    slug: "ve-tho-den-ngay",
    title: "V\u1ec1 Th\u1ee3 \u0110\u1ebfn Ngay",
    excerpt: "Gi\u1edbi thi\u1ec7u n\u1ec1n t\u1ea3ng k\u1ebft n\u1ed1i kh\u00e1ch h\u00e0ng v\u1edbi th\u1ee3 s\u1eeda ch\u1eefa chuy\u00ean nghi\u1ec7p.",
    sortOrder: 10,
    displayLocations: ["footer", "home"],
    contentHtml: "<p>Th\u1ee3 \u0110\u1ebfn Ngay l\u00e0 n\u1ec1n t\u1ea3ng h\u1ed7 tr\u1ee3 kh\u00e1ch h\u00e0ng t\u00ecm th\u1ee3 s\u1eeda ch\u1eefa, l\u1eafp \u0111\u1eb7t v\u00e0 b\u1ea3o tr\u00ec t\u1ea1i nh\u00e0 nhanh ch\u00f3ng, minh b\u1ea1ch v\u00e0 thu\u1eadn ti\u1ec7n.</p><p>N\u1ed9i dung n\u00e0y \u0111\u01b0\u1ee3c qu\u1ea3n tr\u1ecb t\u1eeb CMS v\u00e0 c\u00f3 th\u1ec3 hi\u1ec3n th\u1ecb linh ho\u1ea1t theo t\u1eebng v\u1ecb tr\u00ed.</p>",
  },
  {
    slug: "dieu-khoan",
    title: "\u0110i\u1ec1u kho\u1ea3n",
    excerpt: "C\u00e1c \u0111i\u1ec1u ki\u1ec7n khi truy c\u1eadp, \u0111\u0103ng k\u00fd v\u00e0 s\u1eed d\u1ee5ng d\u1ecbch v\u1ee5.",
    sortOrder: 20,
    displayLocations: ["footer"],
    contentHtml: "<p>Khi s\u1eed d\u1ee5ng Th\u1ee3 \u0110\u1ebfn Ngay, ng\u01b0\u1eddi d\u00f9ng \u0111\u1ed3ng \u00fd cung c\u1ea5p th\u00f4ng tin ch\u00ednh x\u00e1c, tu\u00e2n th\u1ee7 quy tr\u00ecnh \u0111\u1eb7t d\u1ecbch v\u1ee5 v\u00e0 thanh to\u00e1n c\u00e1c chi ph\u00ed \u0111\u00e3 x\u00e1c nh\u1eadn.</p>",
  },
  {
    slug: "chinh-sach-bao-mat",
    title: "Ch\u00ednh s\u00e1ch b\u1ea3o m\u1eadt",
    excerpt: "C\u00e1ch thu th\u1eadp, s\u1eed d\u1ee5ng v\u00e0 b\u1ea3o v\u1ec7 th\u00f4ng tin c\u00e1 nh\u00e2n.",
    sortOrder: 30,
    displayLocations: ["footer"],
    contentHtml: "<p>Th\u1ee3 \u0110\u1ebfn Ngay ch\u1ec9 thu th\u1eadp th\u00f4ng tin c\u1ea7n thi\u1ebft \u0111\u1ec3 cung c\u1ea5p d\u1ecbch v\u1ee5, x\u00e1c th\u1ef1c t\u00e0i kho\u1ea3n, \u0111i\u1ec1u ph\u1ed1i th\u1ee3 v\u00e0 ch\u0103m s\u00f3c kh\u00e1ch h\u00e0ng.</p>",
  },
  {
    slug: "chinh-sach-tho",
    title: "Ch\u00ednh s\u00e1ch th\u1ee3",
    excerpt: "Quy \u0111\u1ecbnh tham gia, nh\u1eadn vi\u1ec7c v\u00e0 tr\u00e1ch nhi\u1ec7m c\u1ee7a th\u1ee3.",
    sortOrder: 40,
    displayLocations: ["footer"],
    contentHtml: "<p>Th\u1ee3 tham gia n\u1ec1n t\u1ea3ng c\u1ea7n cung c\u1ea5p h\u1ed3 s\u01a1 ch\u00ednh x\u00e1c, nh\u1eadn vi\u1ec7c \u0111\u00fang kh\u1ea3 n\u0103ng chuy\u00ean m\u00f4n v\u00e0 th\u1ef1c hi\u1ec7n d\u1ecbch v\u1ee5 chuy\u00ean nghi\u1ec7p.</p>",
  },
  {
    slug: "chinh-sach-khach-hang",
    title: "Ch\u00ednh s\u00e1ch kh\u00e1ch h\u00e0ng",
    excerpt: "Quy\u1ec1n l\u1ee3i, tr\u00e1ch nhi\u1ec7m v\u00e0 h\u01b0\u1edbng d\u1eabn s\u1eed d\u1ee5ng d\u1ecbch v\u1ee5.",
    sortOrder: 50,
    displayLocations: ["footer"],
    contentHtml: "<p>Kh\u00e1ch h\u00e0ng c\u00f3 quy\u1ec1n nh\u1eadn th\u00f4ng tin d\u1ecbch v\u1ee5, chi ph\u00ed d\u1ef1 ki\u1ebfn v\u00e0 tr\u1ea1ng th\u00e1i x\u1eed l\u00fd c\u00f4ng vi\u1ec7c m\u1ed9t c\u00e1ch minh b\u1ea1ch.</p>",
  },
  {
    slug: "quy-che-hoat-dong",
    title: "Quy ch\u1ebf ho\u1ea1t \u0111\u1ed9ng",
    excerpt: "Nguy\u00ean t\u1eafc v\u1eadn h\u00e0nh, \u0111i\u1ec1u ph\u1ed1i d\u1ecbch v\u1ee5 v\u00e0 x\u1eed l\u00fd ph\u00e1t sinh.",
    sortOrder: 60,
    displayLocations: ["footer"],
    contentHtml: "<p>Th\u1ee3 \u0110\u1ebfn Ngay v\u1eadn h\u00e0nh theo m\u00f4 h\u00ecnh k\u1ebft n\u1ed1i nhu c\u1ea7u s\u1eeda ch\u1eefa c\u1ee7a kh\u00e1ch h\u00e0ng v\u1edbi \u0111\u1ed9i ng\u0169 th\u1ee3 ph\u00f9 h\u1ee3p.</p>",
  },
  {
    slug: "lien-he",
    title: "Li\u00ean h\u1ec7",
    excerpt: "Th\u00f4ng tin li\u00ean h\u1ec7 v\u00e0 k\u00eanh h\u1ed7 tr\u1ee3 ch\u00ednh th\u1ee9c.",
    sortOrder: 70,
    displayLocations: ["footer", "popup"],
    contentHtml: "<p>\u0110\u1ed9i ng\u0169 Th\u1ee3 \u0110\u1ebfn Ngay lu\u00f4n s\u1eb5n s\u00e0ng ti\u1ebfp nh\u1eadn ph\u1ea3n h\u1ed3i, h\u1ed7 tr\u1ee3 t\u00e0i kho\u1ea3n v\u00e0 x\u1eed l\u00fd c\u00e1c v\u1ea5n \u0111\u1ec1 ph\u00e1t sinh.</p>",
  },
];

export const defaultCmsSlugs = defaultCmsPages.map((page) => page.slug);

export function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/s+/g, " ")
    .trim();
}
