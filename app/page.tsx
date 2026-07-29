import Link from "next/link";
import Image from "next/image";
import fs from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import type { ReactElement } from "react";
import ApkDownloadSection from "./components/ApkDownloadSection";
import { CmsPlacement } from "./components/CmsPlacement";
import {
  LogoIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  WrenchIcon,
  ShieldCheckIcon,
  StarIcon,
  ClockIcon,
  MapPinIcon,
  BriefcaseIcon,
  BarChartIcon,
  CalendarIcon,
  PhoneIcon,
  UsersIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ChevronRightIcon,
} from "./components/icons";
import { DEFAULT_SETTINGS, type SettingsData } from "@/lib/settings-types";
import { applyDefaultServiceParents } from "@/lib/service-hierarchy";
import { filterStandardServiceCatalog } from "@/lib/standard-service-catalog";
import { defaultCmsPages } from "@/lib/cms";

export const revalidate = 300;
export const dynamic = "force-dynamic";

const apkDownloadUrl = "https://thodenngay.vn/downloads/thodenngay.apk";
const apkVersion = "0.1.1-beta";
const apkUpdatedAt = "26/07/2026";

async function getApkDownloadData() {
  const apkPath = path.join(process.cwd(), "public", "downloads", "thodenngay.apk");
  const stat = await fs.stat(apkPath);
  const qrCodeDataUrl = await QRCode.toDataURL(apkDownloadUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    width: 256,
    color: {
      dark: "#1D4ED8",
      light: "#FFFFFF",
    },
  });

  return {
    downloadUrl: apkDownloadUrl,
    qrCodeDataUrl,
    version: apkVersion,
    updatedAt: apkUpdatedAt,
    fileSize: `${(stat.size / 1024 / 1024).toFixed(2)} MB`,
  };
}

type IconComponent = (props: { size?: number; className?: string; strokeWidth?: number }) => ReactElement;

const iconMap: Record<string, IconComponent> = {
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  WrenchIcon,
  ShieldCheckIcon,
  StarIcon,
  ClockIcon,
  MapPinIcon,
  BriefcaseIcon,
  BarChartIcon,
  CalendarIcon,
  PhoneIcon,
  UsersIcon,
};

const iconStyleMap: Record<string, { color: string; bgColor: string }> = {
  ZapIcon: { color: "#2563EB", bgColor: "#DBEAFE" },
  DropletIcon: { color: "#1D4ED8", bgColor: "#DBEAFE" },
  CameraIcon: { color: "#3B82F6", bgColor: "#EFF6FF" },
  CogIcon: { color: "#2563EB", bgColor: "#DBEAFE" },
  WrenchIcon: { color: "#1D4ED8", bgColor: "#EFF6FF" },
  ShieldCheckIcon: { color: "#2563EB", bgColor: "#DBEAFE" },
  StarIcon: { color: "#3B82F6", bgColor: "#EFF6FF" },
  ClockIcon: { color: "#1D4ED8", bgColor: "#DBEAFE" },
  MapPinIcon: { color: "#2563EB", bgColor: "#EFF6FF" },
  BriefcaseIcon: { color: "#64748B", bgColor: "#F8FAFC" },
  BarChartIcon: { color: "#3B82F6", bgColor: "#EFF6FF" },
  CalendarIcon: { color: "#1D4ED8", bgColor: "#DBEAFE" },
  PhoneIcon: { color: "#2563EB", bgColor: "#EFF6FF" },
  UsersIcon: { color: "#3B82F6", bgColor: "#DBEAFE" },
};

const homepageServiceVisuals = [
  {
    match: ["điện", "dien", "electric"],
    icon: ZapIcon,
    color: "#2563EB",
    bgColor: "#DBEAFE",
  },
  {
    match: ["nước", "nuoc", "ống", "ong", "plumb"],
    icon: DropletIcon,
    color: "#1D4ED8",
    bgColor: "#DBEAFE",
  },
  {
    match: ["camera", "cctv", "cam"],
    icon: CameraIcon,
    color: "#3B82F6",
    bgColor: "#EFF6FF",
  },
  {
    match: ["cơ khí", "co khi", "sắt", "sat", "khóa", "khoa"],
    icon: CogIcon,
    color: "#2563EB",
    bgColor: "#DBEAFE",
  },
  {
    match: ["điều hòa", "dieu hoa", "máy lạnh", "may lanh", "lạnh", "lanh"],
    icon: ClockIcon,
    color: "#1D4ED8",
    bgColor: "#EFF6FF",
  },
  {
    match: ["sơn", "son", "tường", "tuong"],
    icon: ShieldCheckIcon,
    color: "#3B82F6",
    bgColor: "#DBEAFE",
  },
  {
    match: ["mộc", "moc", "gỗ", "go", "cửa", "cua"],
    icon: WrenchIcon,
    color: "#2563EB",
    bgColor: "#EFF6FF",
  },
  {
    match: ["vệ sinh", "ve sinh", "bảo trì", "bao tri"],
    icon: StarIcon,
    color: "#1D4ED8",
    bgColor: "#DBEAFE",
  },
];

const fallbackServiceVisuals = [
  { icon: BriefcaseIcon, color: "#64748B", bgColor: "#F8FAFC" },
  { icon: CalendarIcon, color: "#2563EB", bgColor: "#DBEAFE" },
  { icon: PhoneIcon, color: "#1D4ED8", bgColor: "#EFF6FF" },
  { icon: UsersIcon, color: "#3B82F6", bgColor: "#DBEAFE" },
  { icon: BarChartIcon, color: "#2563EB", bgColor: "#EFF6FF" },
  { icon: MapPinIcon, color: "#1D4ED8", bgColor: "#DBEAFE" },
];

function getHomepageServiceVisual(serviceName: string, iconName?: string | null, index = 0) {
  const normalizedName = serviceName.toLowerCase();
  const matched = homepageServiceVisuals.find((visual) =>
    visual.match.some((keyword) => normalizedName.includes(keyword))
  );

  if (matched) return matched;

  if (iconName && iconMap[iconName] && iconStyleMap[iconName]) {
    return {
      icon: iconMap[iconName],
      ...iconStyleMap[iconName],
    };
  }

  return fallbackServiceVisuals[index % fallbackServiceVisuals.length];
}

const defaultServices = [
  {
    icon: ZapIcon,
    name: "Sửa điện",
    desc: "Sửa chữa, lắp đặt hệ thống điện dân dụng",
    color: "#2563EB",
    bgColor: "#DBEAFE",
  },
  {
    icon: DropletIcon,
    name: "Sửa nước",
    desc: "Khắc phục sự cố đường ống, vòi nước",
    color: "#1D4ED8",
    bgColor: "#DBEAFE",
  },
  {
    icon: CameraIcon,
    name: "Lắp camera",
    desc: "Tư vấn, lắp đặt camera an ninh",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
  },
  {
    icon: CogIcon,
    name: "Cơ khí",
    desc: "Gia công, sửa chữa cơ khí tại chỗ",
    color: "#2563EB",
    bgColor: "#DBEAFE",
  },
];

const stats = [
  { value: "2,500+", label: "Lượt đặt dịch vụ" },
  { value: "150+", label: "Thợ chuyên nghiệp" },
  { value: "4.8", label: "Đánh giá trung bình" },
  { value: "<5 phút", label: "Thời gian phản hồi" },
];

const steps = [
  {
    step: "01",
    title: "Chọn dịch vụ",
    desc: "Chọn loại dịch vụ bạn cần: điện, nước, camera, cơ khí…",
  },
  {
    step: "02",
    title: "Đặt lịch",
    desc: "Nhập địa chỉ, chọn thời gian phù hợp và mô tả vấn đề",
  },
  {
    step: "03",
    title: "Thợ đến tận nơi",
    desc: "Thợ được xác minh sẽ liên hệ và đến ngay",
  },
  {
    step: "04",
    title: "Hoàn thành & đánh giá",
    desc: "Thanh toán sau khi hoàn tất, đánh giá chất lượng dịch vụ",
  },
];

type HomepageCmsPage = {
  slug: string;
  title: string;
  sort_order?: number | null;
  content_type?: string | null;
  status?: string | null;
};

type HomepageService = {
  id: string;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  parent_service_id?: string | null;
};

type GpsLocation = {
  lat?: number | string | null;
  lng?: number | string | null;
  accuracy?: number | string | null;
  captured_at?: string | null;
};

type DispatchWorkerProfile = {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  gps_location?: GpsLocation | null;
};

type DispatchWorker = {
  id: string;
  specialties?: string[] | null;
  avg_rating?: number | string | null;
  total_jobs?: number | null;
  profiles?: DispatchWorkerProfile | DispatchWorkerProfile[] | null;
};

type HomepageDispatchWorker = {
  id: string;
  name: string;
  specialty: string;
  rating: string;
  totalJobs: number;
  gpsLabel: string;
};

type HomepageReviewProfile = {
  full_name?: string | null;
  address?: string | null;
  avatar_url?: string | null;
};

type HomepageReviewJob = {
  address?: string | null;
  service?: {
    name?: string | null;
  } | {
    name?: string | null;
  }[] | null;
};

type HomepageRating = {
  id: string;
  customer_id?: string | null;
  score?: number | null;
  comment?: string | null;
  created_at?: string | null;
  customer?: HomepageReviewProfile | HomepageReviewProfile[] | null;
  job?: HomepageReviewJob | HomepageReviewJob[] | null;
};

type HomepageCustomerReview = {
  id: string;
  name: string;
  location: string;
  rating: number;
  text: string;
  serviceName: string;
  avatarUrl: string | null;
};
const fallbackCustomerNames = [
  "Chị Thu",
  "Anh Nam",
  "Cô Lan",
  "Anh Minh",
  "Chị Hương",
  "Anh Phúc",
  "Chị Ngọc",
  "Anh Quân",
  "Chị Mai",
  "Anh Dũng",
  "Chị Trang",
  "Anh Khải",
];
const fallbackCustomerReviews: HomepageCustomerReview[] = [
  {
    id: "fallback-review-1",
    name: "Chị Hạnh",
    location: "Quận 7, TP.HCM",
    rating: 5,
    text: "Đặt lịch buổi sáng, thợ đến đúng giờ và báo giá rõ ràng trước khi làm. Sửa xong còn dọn lại khu vực rất gọn.",
    serviceName: "Sửa điện nước",
    avatarUrl: null,
  },
  {
    id: "fallback-review-2",
    name: "Anh Minh",
    location: "Cầu Giấy, Hà Nội",
    rating: 5,
    text: "Mình cần xử lý máy lạnh chảy nước gấp, thao tác trên app nhanh và có người nhận việc ngay. Chi phí đúng như đã xác nhận.",
    serviceName: "Điện lạnh",
    avatarUrl: null,
  },
  {
    id: "fallback-review-3",
    name: "Cô Lan",
    location: "Biên Hòa, Đồng Nai",
    rating: 5,
    text: "Thợ tư vấn kỹ, giải thích nguyên nhân hỏng và hướng dẫn cách dùng để tránh lỗi lại. Rất yên tâm khi có lịch sử công việc trên app.",
    serviceName: "Sửa thiết bị",
    avatarUrl: null,
  },
  {
    id: "fallback-review-4",
    name: "Anh Quân",
    location: "Thủ Đức, TP.HCM",
    rating: 4,
    text: "Đội hỗ trợ phản hồi nhanh, thợ xác nhận vị trí rõ ràng nên mình không phải gọi đi gọi lại. Công việc hoàn thành trong ngày.",
    serviceName: "Lắp đặt",
    avatarUrl: null,
  },
  {
    id: "fallback-review-5",
    name: "Chị Trang",
    location: "Hải Châu, Đà Nẵng",
    rating: 5,
    text: "Rất thích phần theo dõi trạng thái công việc. Gia đình mình biết khi nào thợ đang đến và khi nào hoàn tất.",
    serviceName: "Bảo trì tại nhà",
    avatarUrl: null,
  },
  {
    id: "fallback-review-6",
    name: "Anh Phúc",
    location: "Ninh Kiều, Cần Thơ",
    rating: 5,
    text: "Giá cả minh bạch, thợ lịch sự và làm khá nhanh. Sau khi xong có ảnh xác nhận nên mình dễ kiểm tra lại.",
    serviceName: "Sửa chữa tổng hợp",
    avatarUrl: null,
  },
  {
    id: "fallback-review-7",
    name: "Chị Mai",
    location: "Hoàng Mai, Hà Nội",
    rating: 5,
    text: "Mình đặt xử lý ổ cắm bị chập cho cửa hàng, thợ mang đủ đồ nghề và làm gọn trong giờ nghỉ trưa.",
    serviceName: "Sửa điện",
    avatarUrl: null,
  },
  {
    id: "fallback-review-8",
    name: "Anh Dũng",
    location: "Bình Tân, TP.HCM",
    rating: 4,
    text: "App dễ dùng, chọn dịch vụ nhanh và có thông tin thợ rõ ràng. Mình đánh giá cao phần nhắc lịch sau khi đặt.",
    serviceName: "Dịch vụ tại nhà",
    avatarUrl: null,
  },
  {
    id: "fallback-review-9",
    name: "Chị Ngọc",
    location: "Long Biên, Hà Nội",
    rating: 5,
    text: "Thợ kiểm tra kỹ trước khi báo phương án, không phát sinh thêm ngoài phần đã thống nhất. Trải nghiệm rất ổn.",
    serviceName: "Kiểm tra sự cố",
    avatarUrl: null,
  },
];

const getPublicSupabase = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] || "T";
  const last = words.length > 1 ? words[words.length - 1]?.[0] : "";

  return `${first}${last}`.toUpperCase();
}

function getDisplayLocation(address?: string | null) {
  if (!address) return "Khách hàng Thợ đến ngay";

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts.slice(-2).join(", ");
  return parts[0] || "Khách hàng Thợ đến ngay";
}

function toValidGpsLocation(gpsLocation?: GpsLocation | null) {
  const lat = Number(gpsLocation?.lat);
  const lng = Number(gpsLocation?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return { lat, lng };
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function getFallbackCustomerName(seed: string) {
  const hash = seed.split("").reduce((total, char) => total + char.charCodeAt(0), 0);

  return fallbackCustomerNames[hash % fallbackCustomerNames.length];
}

function getDefaultFooterCmsPages(): HomepageCmsPage[] {
  return defaultCmsPages
    .filter((page) => page.contentType === "fixed_page" && page.status === "published" && page.displayLocations.includes("footer"))
    .map((page) => ({
      slug: page.slug,
      title: page.title,
      sort_order: page.sortOrder,
      content_type: page.contentType,
      status: page.status,
    }));
}

function mergeFooterCmsPages(dbPages: HomepageCmsPage[] | null | undefined) {
  const pages = [...(dbPages || [])];
  const existingSlugs = new Set(pages.map((page) => page.slug));

  for (const page of getDefaultFooterCmsPages()) {
    if (!existingSlugs.has(page.slug)) {
      pages.push(page);
    }
  }

  return pages.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.title.localeCompare(b.title, "vi"));
}

function getRotatingCustomerReviews(reviews: HomepageCustomerReview[]) {
  const realReviews = reviews.filter((review) => review.text.trim().length > 0);
  const realReviewText = new Set(realReviews.map((review) => review.text.trim().toLowerCase()));
  const fallbackReviews = fallbackCustomerReviews.filter((review) => !realReviewText.has(review.text.trim().toLowerCase()));
  const reviewPool = realReviews.length >= 6 ? realReviews : [...realReviews, ...fallbackReviews];

  return shuffleItems(reviewPool).slice(0, 3);
}
const getHomepageData = unstable_cache(
  async (): Promise<{
    systemSettings: SettingsData;
    dbServices: HomepageService[];
    dispatchWorkers: HomepageDispatchWorker[];
    customerReviews: HomepageCustomerReview[];
    cmsPages: HomepageCmsPage[];
  }> => {
    const supabase = getPublicSupabase();

    const [settingsResult, servicesResult, workersResult, ratingsResult, cmsPagesResult] = await Promise.all([
      supabase
        .from("system_settings")
        .select("app_name, hotline, support_email, company_address, facebook_url, zalo_url, maintenance_mode, terms_url, privacy_url, apk_backup_download_url")
        .eq("id", "default")
        .maybeSingle(),
      supabase
        .from("services")
        .select("id,name,description,icon,parent_service_id,is_active")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("workers")
        .select("id,specialties,avg_rating,total_jobs,profiles(full_name,phone,address,gps_location)")
        .eq("status", "active")
        .eq("is_available", true)
        .order("avg_rating", { ascending: false })
        .limit(20),
      supabase
        .from("ratings")
        .select("id,customer_id,score,comment,created_at,customer:profiles!customer_id(full_name,address,avatar_url),job:jobs(address,service:services!jobs_service_id_fkey(name))")
        .not("comment", "is", null)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("cms_posts")
        .select("slug,title,sort_order,display_locations,content_type,status")
        .eq("is_published", true)
        .eq("status", "published")
        .eq("content_type", "fixed_page")
        .contains("display_locations", ["footer"])
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true }),
    ]);

    if (settingsResult.error) {
      console.warn("Could not load homepage settings:", settingsResult.error.message);
    }

    if (servicesResult.error) {
      console.warn("Could not load homepage services:", servicesResult.error.message);
    }

    if (workersResult.error) {
      console.warn("Could not load homepage dispatch workers:", workersResult.error.message);
    }

    if (ratingsResult.error) {
      console.warn("Could not load homepage customer reviews:", ratingsResult.error.message);
    }

    if (cmsPagesResult.error) {
      console.warn("Could not load CMS footer pages:", cmsPagesResult.error.message);
    }

    const settings = settingsResult.data;
    const dispatchWorkers = ((workersResult.data || []) as DispatchWorker[])
      .map((worker) => {
        const profile = firstRelation(worker.profiles);
        const gps = toValidGpsLocation(profile?.gps_location);

        if (!profile || !gps) return null;

        const name = profile.full_name?.trim() || "Thợ đang hoạt động";
        const specialty = worker.specialties?.find(Boolean) || "Sẵn sàng nhận việc";
        const rating = Number(worker.avg_rating || 0);

        return {
          id: worker.id,
          name,
          specialty,
          rating: rating > 0 ? rating.toFixed(1) : "Mới",
          totalJobs: worker.total_jobs || 0,
          gpsLabel: `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`,
        };
      })
      .filter((worker): worker is HomepageDispatchWorker => Boolean(worker))
      .slice(0, 3);
    const customerReviews = ((ratingsResult.data || []) as HomepageRating[])
      .map((rating) => {
        const customer = firstRelation(rating.customer);
        const job = firstRelation(rating.job);
        const service = firstRelation(job?.service);
        const comment = rating.comment?.trim();

        if (!comment) return null;

        return {
          id: rating.id,
          name: customer?.full_name?.trim() || getFallbackCustomerName(rating.customer_id || rating.id),
          location: getDisplayLocation(customer?.address || job?.address),
          rating: Math.max(1, Math.min(5, Math.round(Number(rating.score || 5)))),
          text: comment,
          serviceName: service?.name || "Dịch vụ sửa chữa",
          avatarUrl: customer?.avatar_url || null,
        };
      })
      .filter((review): review is HomepageCustomerReview => Boolean(review));

    return {
      systemSettings: settings
        ? {
            app_name: settings.app_name || DEFAULT_SETTINGS.app_name,
            hotline: settings.hotline || DEFAULT_SETTINGS.hotline,
            support_email: settings.support_email || DEFAULT_SETTINGS.support_email,
            company_address: settings.company_address || DEFAULT_SETTINGS.company_address,
            facebook_url: settings.facebook_url || DEFAULT_SETTINGS.facebook_url,
            zalo_url: settings.zalo_url || DEFAULT_SETTINGS.zalo_url,
            maintenance_mode: settings.maintenance_mode ?? DEFAULT_SETTINGS.maintenance_mode,
            terms_url: settings.terms_url || DEFAULT_SETTINGS.terms_url,
            privacy_url: settings.privacy_url || DEFAULT_SETTINGS.privacy_url,
            apk_backup_download_url: settings.apk_backup_download_url || DEFAULT_SETTINGS.apk_backup_download_url,
          }
        : DEFAULT_SETTINGS,
      dbServices: servicesResult.data || [],
      dispatchWorkers,
      customerReviews,
      cmsPages: mergeFooterCmsPages(cmsPagesResult.data as HomepageCmsPage[] | null),
    };
  },
  ["homepage-data"],
  { revalidate: 300 }
);

export default async function HomePage() {
  const [{ systemSettings, dbServices, dispatchWorkers, customerReviews, cmsPages }, apkDownloadData] = await Promise.all([
    getHomepageData(),
    getApkDownloadData(),
  ]);

  const standardDbServices = dbServices && dbServices.length > 0
    ? filterStandardServiceCatalog(applyDefaultServiceParents(dbServices))
    : [];
  const rotatingCustomerReviews = getRotatingCustomerReviews(customerReviews);

  const services = standardDbServices.length > 0
    ? shuffleItems(
        standardDbServices.filter((svc, index, all) =>
          all.findIndex((item) => item.name?.trim().toLowerCase() === svc.name?.trim().toLowerCase()) === index
        )
      )
      .slice(0, 8)
      .map((svc, index) => {
        const visual = getHomepageServiceVisual(svc.name || "", svc.icon, index);
        return {
          id: svc.id,
          name: svc.name,
          desc: svc.description || `Dịch vụ sửa chữa uy tín của ${systemSettings.app_name}`,
          icon: visual.icon,
          color: visual.color,
          bgColor: visual.bgColor,
        };
      })
    : shuffleItems(defaultServices);

  return (
    <div className="flex flex-col min-h-screen">
      {/* ===== HEADER / NAVBAR ===== */}
      <header className="sticky top-0 z-50 border-b border-outline-variant/20 bg-white/92 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3 lg:h-[72px]">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group" id="nav-logo">
              <LogoIcon size={36} />
              <span className="text-xl font-bold text-primary-container tracking-tight">
                {systemSettings.app_name}
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-7 rounded-full border border-outline-variant/25 bg-surface-container-lowest/80 px-4 py-2">
              <a href="#services" className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary-container">
                Dịch vụ
              </a>
              <a href="#how-it-works" className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary-container">
                Cách hoạt động
              </a>
              <a href="#reviews" className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary-container">
                Đánh giá
              </a>
              <a href="#download-app" className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary-container">
                Tải app
              </a>
            </nav>

            {/* Auth Actions */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="btn-outline !min-h-10 !w-auto !px-3 !py-2 text-sm sm:!px-5"
                id="nav-login"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="btn-primary text-sm !py-2.5 !px-5 hidden sm:inline-flex"
                id="nav-register"
              >
                Đăng ký
              </Link>
            </div>
          </div>
        </div>
      </header>

      <CmsPlacement location="featured_notice" variant="banner" limit={2} />
      <CmsPlacement location="popup" variant="popup" limit={1} />

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-[700px] overflow-hidden bg-primary text-on-primary sm:min-h-[760px]">
        <Image
          src="/hero-technician.webp"
          alt="Kỹ thuật viên Thợ đến ngay kiểm tra sửa chữa tại nhà"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[62%_center]"
        />
        <div className="absolute inset-0 bg-linear-to-r from-primary-container via-primary/92 to-primary/16" />
        <div className="absolute inset-0 bg-linear-to-t from-primary-container/80 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-linear-to-t from-surface to-transparent" />

        <div className="relative mx-auto flex min-h-[700px] max-w-7xl items-center px-4 pb-28 pt-14 sm:min-h-[760px] sm:px-6 sm:pb-36 sm:pt-20 lg:px-8">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/14 px-3.5 py-1.5 shadow-sm backdrop-blur-sm">
              <span className="w-2 h-2 bg-primary-fixed rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-white/95">Đang hoạt động 24/7 tại Nghĩa Lâm Ninh Bình</span>
            </div>

            <h1 className="mb-5 max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight !text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.45)] sm:text-6xl lg:text-7xl">
              Thợ giỏi,{" "}
              <span className="!text-primary-fixed drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">đến ngay</span>{" "}
              khi bạn cần
            </h1>

            <p className="mb-8 max-w-xl text-base leading-7 !text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)] sm:text-lg">
              Nền tảng kết nối bạn với thợ sửa chữa chuyên nghiệp, được xác minh.
              Đặt dịch vụ điện, nước, camera, cơ khí chỉ trong vài bước.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/register"
                className="btn-secondary !px-6 !py-3.5 sm:!w-auto sm:!px-8"
                id="hero-cta"
              >
                Đặt dịch vụ ngay
                <ArrowRightIcon size={20} />
              </Link>
              <a
                href={`tel:${systemSettings.hotline.replace(/\s+/g, '')}`}
                className="btn-outline !border-white/30 !bg-white/8 !px-6 !py-3.5 !text-white hover:!border-white/50 hover:!bg-white/14 sm:!w-auto sm:!px-8"
                id="hero-call"
              >
                <PhoneIcon size={20} />
                Gọi: {systemSettings.hotline}
              </a>
            </div>

            {/* Trust indicators */}
            <div className="mt-8 grid grid-cols-1 gap-3 text-white/82 sm:flex sm:flex-wrap sm:items-center sm:gap-6">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 backdrop-blur-sm">
                <ShieldCheckIcon size={18} />
                <span className="text-label-sm">Thợ xác minh</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 backdrop-blur-sm">
                <ClockIcon size={18} />
                <span className="text-label-sm">Phản hồi &lt; 5 phút</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 backdrop-blur-sm">
                <StarIcon size={18} className="text-primary-fixed" />
                <span className="text-label-sm">4.8/5 sao</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-24 right-4 hidden w-[380px] rounded-xl border border-white/20 bg-primary-container/95 p-5 text-white shadow-[0_26px_86px_rgba(0,18,48,0.46)] backdrop-blur-xl lg:block">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase !text-primary-fixed">Đang điều phối</p>
                <p className="mt-1 text-lg font-bold !text-white">Thợ có GPS thật</p>
                <p className="mt-1 text-xs !text-white/68">Danh sách thợ active đã bật định vị</p>
              </div>
              <div className="shrink-0 rounded-full border border-success-container/40 bg-success-container px-3 py-1 text-xs font-bold text-success">
                Live GPS
              </div>
            </div>
            {dispatchWorkers.length > 0 ? (
              <div className="space-y-3">
                {dispatchWorkers.map((worker) => (
                  <div key={worker.id} className="rounded-lg border border-white/12 bg-white/12 p-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary-container">
                        {getInitials(worker.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold !text-white">{worker.name}</p>
                        <p className="truncate text-xs !text-white/68">{worker.specialty}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/14 px-2 py-1 text-xs font-bold !text-primary-fixed">
                        <StarIcon size={13} />
                        {worker.rating}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-md bg-white/10 px-3 py-2">
                      <span className="truncate text-xs font-medium !text-white/72">
                        GPS: {worker.gpsLabel}
                      </span>
                      <span className="text-xs font-bold !text-white">{worker.totalJobs} jobs</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-white/12 bg-white/12 p-4">
                <p className="text-sm font-bold !text-white">Chưa có thợ active bật GPS</p>
                <p className="mt-1 text-xs leading-5 !text-white/70">
                  Khi thợ cập nhật vị trí trong hồ sơ, danh sách này sẽ tự hiển thị trên trang chủ.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="relative z-10 -mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-outline-variant/25 bg-white/96 p-3 shadow-[0_18px_50px_rgba(15,35,66,0.10)] backdrop-blur md:grid-cols-4 md:gap-5 md:p-5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg bg-surface-container-lowest px-3 py-4 text-center">
                <div className="text-2xl font-bold text-primary-container sm:text-3xl">{s.value}</div>
                <div className="mt-1 text-xs font-medium text-on-surface-variant sm:text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CmsPlacement location="home" title={"N\u1ed9i dung n\u1ed5i b\u1eadt"} limit={3} />
      <CmsPlacement location="news" title={"Tin t\u1ee9c"} limit={3} />

      {/* ===== SERVICES SECTION ===== */}
      <section id="services" className="py-16 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
            <span className="section-eyebrow">
              Dịch vụ
            </span>
            <h2 className="mt-3 text-4xl font-bold text-on-surface sm:text-5xl">
              Đa dạng dịch vụ sửa chữa
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-on-surface-variant sm:text-lg">
              Từ sửa điện, sửa nước đến lắp camera – tất cả đều có thợ chuyên nghiệp sẵn sàng
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((svc) => {
              const Icon = svc.icon;
              return (
                <Link
                  key={svc.name}
                  href="/register"
                  className="group relative min-h-[220px] overflow-hidden rounded-xl border border-outline-variant/25 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:border-primary-container/35 hover:shadow-[0_18px_44px_rgba(15,35,66,0.10)]"
                  id={`service-${svc.name}`}
                >
                  <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: svc.color }} />
                  <div
                    className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                    style={{ backgroundColor: svc.bgColor, color: svc.color }}
                  >
                    <Icon size={28} />
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-on-surface">
                    {svc.name}
                  </h3>
                  <p className="mb-6 line-clamp-3 text-sm leading-6 text-on-surface-variant">{svc.desc}</p>
                  <div className="absolute bottom-5 left-5 flex items-center gap-1 text-sm font-bold text-primary-container transition-all group-hover:gap-2">
                    <span>Đặt ngay</span>
                    <ChevronRightIcon size={16} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <ApkDownloadSection
        {...apkDownloadData}
        backupDownloadUrl={systemSettings.apk_backup_download_url.trim()}
      />

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="relative overflow-hidden bg-primary-container py-16 sm:py-24 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.30),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(37,99,235,0.24),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/25 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase !text-primary-fixed backdrop-blur">
              Quy trình
            </span>
            <h2 className="mt-4 text-4xl font-bold !text-white sm:text-5xl">
              Đặt dịch vụ dễ dàng
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 !text-white/76 sm:text-lg">
              Chỉ 4 bước đơn giản để có thợ giỏi đến tận nơi
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-[12.5%] right-[12.5%] top-20 hidden h-1 rounded-full bg-linear-to-r from-primary-fixed via-white/30 to-secondary-container lg:block" />
            <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((item, idx) => {
                const StepIcon = [BriefcaseIcon, CalendarIcon, MapPinIcon, CheckCircleIcon][idx] || CheckCircleIcon;
                return (
                  <div key={item.step} className="relative">
                    <div className="group relative min-h-[260px] overflow-hidden rounded-2xl border border-white/14 bg-white/[0.08] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:bg-white/[0.12]">
                      <div className="absolute -right-6 -top-8 text-[7rem] font-bold leading-none text-white/[0.05]">
                        {item.step}
                      </div>
                      <div className="relative mb-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-primary shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition-transform group-hover:scale-105">
                        <StepIcon size={28} />
                      </div>
                      <div className="relative mb-4 inline-flex rounded-full bg-white/16 px-3 py-1 text-xs font-bold !text-primary-fixed">
                        Bước {idx + 1}
                      </div>
                      <h3 className="relative mb-3 text-xl font-bold !text-white">{item.title}</h3>
                      <p className="relative text-sm leading-6 !text-white/72">{item.desc}</p>
                      <div className="absolute inset-x-5 bottom-5 h-px bg-linear-to-r from-primary-fixed/80 via-white/20 to-transparent opacity-70" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHY US SECTION ===== */}
      <section className="py-16 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
            <div>
              <span className="section-eyebrow">
                Tại sao chọn Thợ đến ngay
              </span>
              <h2 className="mb-8 mt-3 text-4xl font-bold text-on-surface sm:text-5xl">
                Dịch vụ đáng tin cậy cho mọi gia đình
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    title: "Thợ được xác minh",
                    desc: "Tất cả thợ đều qua quy trình duyệt kỹ lưỡng bởi đội ngũ admin",
                  },
                  {
                    title: "Giá cả minh bạch",
                    desc: "Bảng giá cố định, rõ ràng — không phát sinh phí ẩn",
                  },
                  {
                    title: "Theo dõi realtime",
                    desc: "Xem trạng thái công việc từ lúc đặt đến khi hoàn thành",
                  },
                  {
                    title: "Đánh giá & bảo vệ",
                    desc: "Hệ thống đánh giá minh bạch, bảo vệ quyền lợi khách hàng",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-outline-variant/20 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-success-container text-success">
                      <CheckCircleIcon size={22} />
                    </div>
                    <h4 className="mb-1 font-bold text-on-surface">{item.title}</h4>
                    <p className="text-sm leading-6 text-on-surface-variant">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Card */}
            <div className="relative">
              <div className="rounded-2xl bg-linear-to-br from-primary to-secondary-container p-6 text-white shadow-[0_24px_70px_rgba(37,99,235,0.22)] sm:p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/14 text-lg font-bold text-white">
                    NT
                  </div>
                  <div>
                    <div className="font-semibold text-white">Nguyễn Thanh</div>
                    <div className="text-sm text-white/70">Thợ điện • 5 năm KN</div>
                  </div>
                  <div className="ml-auto flex items-center gap-1 text-primary-fixed">
                    <StarIcon size={16} />
                    <span className="font-semibold text-white">4.9</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-3">
                    <span className="text-sm text-white/70">Tổng jobs</span>
                    <span className="font-semibold text-white">342</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-3">
                    <span className="text-sm text-white/70">Tỷ lệ hoàn thành</span>
                    <span className="font-semibold text-primary-fixed">98%</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-3">
                    <span className="text-sm text-white/70">Phản hồi TB</span>
                    <span className="font-semibold text-white">3 phút</span>
                  </div>
                </div>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary">
                  <CheckCircleIcon size={14} /> Đã xác minh
                </div>
              </div>

              {/* Floating notification */}
              <div className="card-elevated absolute -right-4 -top-4 hidden max-w-[220px] animate-float !p-4 sm:block">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-success-container flex items-center justify-center text-success">
                    <CheckCircleIcon size={16} />
                  </div>
                  <div>
                    <div className="text-label-sm text-on-surface font-semibold">Hoàn thành!</div>
                    <div className="text-label-sm text-on-surface-variant">Sửa ống nước • 45p</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== REVIEWS ===== */}
      <section id="reviews" className="bg-surface-container-low py-16 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
            <span className="section-eyebrow">
              Khách hàng nói gì
            </span>
            <h2 className="mt-3 text-4xl font-bold text-on-surface sm:text-5xl">
              Đánh giá từ khách hàng
            </h2>
          </div>

          {rotatingCustomerReviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {rotatingCustomerReviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-outline-variant/25 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="text-5xl font-serif leading-none text-primary-fixed-dim">“</div>
                    <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-primary-container">
                      {review.serviceName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <StarIcon key={`filled-${review.id}-${i}`} size={16} className="text-primary" />
                    ))}
                    {Array.from({ length: 5 - review.rating }).map((_, i) => (
                      <StarIcon key={`empty-${review.id}-${i}`} size={16} className="text-outline-variant" />
                    ))}
                  </div>
                  <p className="mb-6 line-clamp-4 text-base leading-7 text-on-surface">
                    {review.text}
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/50">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-fixed text-sm font-semibold text-primary-container">
                      {review.avatarUrl ? (
                        <Image
                          src={review.avatarUrl}
                          alt={review.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        getInitials(review.name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-on-surface">{review.name}</div>
                      <div className="truncate text-label-sm text-on-surface-variant">{review.location}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mx-auto max-w-2xl rounded-xl border border-outline-variant/25 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-fixed text-primary-container">
                <StarIcon size={24} />
              </div>
              <h3 className="text-xl font-bold text-on-surface">Chưa có đánh giá từ khách hàng</h3>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Khi khách hàng hoàn tất công việc và gửi đánh giá, nội dung thật sẽ tự hiển thị ở đây.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="relative overflow-hidden bg-primary-container py-16 text-on-primary sm:py-24 lg:py-28">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(59,130,246,0.30),rgba(59,130,246,0)_42%),linear-gradient(90deg,rgba(37,99,235,0.24),rgba(37,99,235,0)_58%)]" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="relative mb-4 text-3xl font-bold leading-tight !text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.35)] sm:text-5xl">
            Bắt đầu sử dụng Thợ đến ngay ngay hôm nay
          </h2>
          <p className="relative mx-auto mb-10 max-w-2xl text-lg !text-white/85">
            Đăng ký miễn phí và trải nghiệm dịch vụ sửa chữa tại nhà chuyên nghiệp nhất
          </p>
          <div className="relative flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="btn-secondary !py-3.5 !px-8 sm:!w-auto"
              id="cta-register"
            >
              Đăng ký miễn phí
              <ArrowRightIcon size={20} />
            </Link>
            <Link
              href="/register?role=worker"
              className="btn-outline !border-white/30 !bg-white/10 !px-8 !py-3.5 !text-white hover:!border-white/50 hover:!bg-white/16 sm:!w-auto"
              id="cta-worker"
            >
              Đăng ký làm thợ
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-on-surface text-surface py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-x-6 gap-y-10 text-center md:max-w-7xl md:grid-cols-4 md:text-left">
            <div className="col-span-2">
              <div className="mb-4 flex items-center justify-center gap-3 md:justify-start">
                <LogoIcon size={32} />
                <span className="text-xl font-bold">{systemSettings.app_name}</span>
              </div>
              <p className="mx-auto max-w-sm text-sm leading-6 text-surface-container-high md:mx-0">
                Nền tảng kết nối khách hàng với thợ sửa chữa chuyên nghiệp. Dịch vụ uy tín, giá cả minh bạch.
              </p>
              <div className="mt-5 grid gap-2 text-sm text-surface-container-high">
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <PhoneIcon size={16} />
                  <span>Hotline: {systemSettings.hotline}</span>
                </div>
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <MapPinIcon size={16} />
                  <span>{systemSettings.company_address}</span>
                </div>
                <a
                  href={`mailto:${systemSettings.support_email}`}
                  className="hover:text-white transition-colors"
                >
                  {systemSettings.support_email}
                </a>
              </div>
            </div>

            <div className="justify-self-center md:justify-self-auto">
              <h4 className="font-semibold mb-4">{"D\u1ecbch v\u1ee5"}</h4>
              <ul className="space-y-2 text-sm text-surface-container-high">
                <li><a href="#" className="hover:text-white transition-colors">{"S\u1eeda \u0111i\u1ec7n"}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{"S\u1eeda n\u01b0\u1edbc"}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{"L\u1eafp camera"}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{"C\u01a1 kh\u00ed"}</a></li>
              </ul>
            </div>

            <div className="justify-self-center md:justify-self-auto">
              <h4 className="font-semibold mb-4">{"Th\u00f4ng tin"}</h4>
              <ul className="space-y-2 text-sm text-surface-container-high">
                {cmsPages.map((page) => (
                  <li key={page.slug}>
                    <Link href={`/${page.slug}`} className="hover:text-white transition-colors">
                      {page.title}
                    </Link>
                  </li>
                ))}
                <li><Link href="/login" className="hover:text-white transition-colors">{"\u0110\u0103ng nh\u1eadp"}</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 text-center text-label-sm text-surface-container-high">
            © 2026 {systemSettings.app_name}. Tất cả quyền được bảo lưu.
          </div>
        </div>
      </footer>
    </div>
  );
}
