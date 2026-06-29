export type CanonicalServiceCategory = {
  id: string;
  name: string;
  emoji: string;
  icon: string;
  keywords: string[];
  sortOrder: number;
};

export type ServiceLike = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  parentName?: string | null;
};

export type CanonicalServiceGroup<T extends ServiceLike> = {
  category: CanonicalServiceCategory;
  services: T[];
};

export const CANONICAL_SERVICE_CATEGORIES: CanonicalServiceCategory[] = [
  {
    id: "internet",
    name: "Mạng Internet",
    emoji: "🌐",
    icon: "Network",
    sortOrder: 1,
    keywords: [
      "lắp đặt internet",
      "lap dat internet",
      "sửa mạng internet",
      "sua mang internet",
      "internet",
      "wi-fi",
      "wifi",
      "cấu hình wi-fi",
      "cau hinh wi-fi",
      "cấu hình wifi",
      "cau hinh wifi",
      "mesh",
      "wi-fi mesh",
      "wifi mesh",
      "kéo dây mạng lan",
      "keo day mang lan",
      "kéo mạng lan",
      "keo mang lan",
      "mạng lan",
      "mang lan",
      "router",
      "modem",
      "cấu hình router",
      "cau hinh router",
      "cấu hình modem",
      "cau hinh modem",
      "bảo trì hệ thống mạng",
      "bao tri he thong mang",
      "mạng internet",
      "mang internet",
      "mạng & viễn thông",
      "mang & vien thong",
      "viễn thông",
      "vien thong",
      "cáp quang",
      "cap quang",
    ],
  },
  {
    id: "camera",
    name: "Camera",
    emoji: "📹",
    icon: "Camera",
    sortOrder: 2,
    keywords: [
      "lắp đặt camera",
      "lap dat camera",
      "lắp camera",
      "lap camera",
      "sửa camera",
      "sua camera",
      "bảo trì camera",
      "bao tri camera",
      "cấu hình xem từ xa",
      "cau hinh xem tu xa",
      "xem từ xa",
      "xem tu xa",
      "di dời camera",
      "di doi camera",
      "nâng cấp hệ thống camera",
      "nang cap he thong camera",
      "camera",
      "cctv",
    ],
  },
  {
    id: "computer",
    name: "Máy tính",
    emoji: "💻",
    icon: "Laptop",
    sortOrder: 3,
    keywords: [
      "cài windows",
      "cai windows",
      "windows",
      "cài phần mềm",
      "cai phan mem",
      "phần mềm",
      "phan mem",
      "sửa pc",
      "sua pc",
      "pc",
      "sửa laptop",
      "sua laptop",
      "laptop",
      "máy tính",
      "may tinh",
      "nâng cấp ram",
      "nang cap ram",
      "ram",
      "ssd",
      "vệ sinh máy tính",
      "ve sinh may tinh",
      "cứu dữ liệu",
      "cuu du lieu",
      "diệt virus",
      "diet virus",
      "virus",
      "tin học",
      "tin hoc",
    ],
  },
  {
    id: "printer",
    name: "Máy in",
    emoji: "🖨️",
    icon: "Printer",
    sortOrder: 4,
    keywords: [
      "cài đặt máy in",
      "cai dat may in",
      "sửa máy in",
      "sua may in",
      "máy in",
      "may in",
      "đổ mực",
      "do muc",
      "mực in",
      "muc in",
      "thay linh kiện",
      "thay linh kien",
      "chia sẻ máy in qua mạng",
      "chia se may in qua mang",
      "chia sẻ máy in",
      "chia se may in",
      "bảo trì máy in",
      "bao tri may in",
      "printer",
    ],
  },
];

export const normalizeServiceText = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");

const getSearchableServiceText = (service: ServiceLike) =>
  normalizeServiceText([service.name, service.description, service.icon, service.parentName].filter(Boolean).join(" "));

const getCategoryMatches = (service: ServiceLike) => {
  const searchable = getSearchableServiceText(service);

  return CANONICAL_SERVICE_CATEGORIES
    .map((category) => {
      const bestKeywordLength = category.keywords
        .map((keyword) => normalizeServiceText(keyword))
        .filter((keyword) => keyword && searchable.includes(keyword))
        .reduce((best, keyword) => Math.max(best, keyword.length), 0);

      return { category, bestKeywordLength };
    })
    .filter((match) => match.bestKeywordLength > 0)
    .sort((a, b) => b.bestKeywordLength - a.bestKeywordLength || a.category.sortOrder - b.category.sortOrder);
};

export const getCanonicalServiceCategories = (service: ServiceLike) =>
  getCategoryMatches(service).map((match) => match.category);

export const getCanonicalServiceCategory = (service: ServiceLike) =>
  getCategoryMatches(service)[0]?.category || null;

export const groupServicesByCanonicalCategory = <T extends ServiceLike>(services: T[]): CanonicalServiceGroup<T>[] => {
  const groups = CANONICAL_SERVICE_CATEGORIES.map((category) => ({
    category,
    services: [] as T[],
  }));

  services.forEach((service) => {
    const categories = getCanonicalServiceCategories(service);
    categories.forEach((category) => {
      const group = groups.find((item) => item.category.id === category.id);
      if (group && !group.services.some((item) => item.id && item.id === service.id)) {
        group.services.push(service);
      }
    });
  });

  return groups.filter((group) => group.services.length > 0);
};

export const serviceMatchesSpecialties = (service: ServiceLike, specialties: string[] = []) => {
  if (specialties.length === 0) return true;

  const serviceName = normalizeServiceText(service.name);
  const searchable = getSearchableServiceText(service);
  const categories = getCanonicalServiceCategories(service);

  return specialties.some((specialty) => {
    const normalizedSpecialty = normalizeServiceText(specialty);
    if (!normalizedSpecialty) return false;
    if (serviceName && (normalizedSpecialty === serviceName || normalizedSpecialty.includes(serviceName) || serviceName.includes(normalizedSpecialty))) {
      return true;
    }

    return categories.some((category) => {
      const categoryName = normalizeServiceText(category.name);
      const categoryId = normalizeServiceText(category.id);
      if (normalizedSpecialty === categoryName || normalizedSpecialty === categoryId || categoryName.includes(normalizedSpecialty)) {
        return true;
      }
      return category.keywords.some((keyword) => {
        const normalizedKeyword = normalizeServiceText(keyword);
        return searchable.includes(normalizedKeyword) && normalizedSpecialty.includes(normalizedKeyword);
      });
    });
  });
};
