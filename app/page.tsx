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
import HomepageNearbyWorkers, { type HomepageNearbyWorker } from "./components/HomepageNearbyWorkers";
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
import { defaultCmsPages, defaultCmsSlugs } from "@/lib/cms";

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

type HomepageMetricData = {
  totalJobs: number | null;
  completedJobs: number | null;
  activeWorkers: number | null;
  availableWorkers: number | null;
  averageRating: number | null;
  ratingCount: number;
};

function formatHomepageCount(value: number | null) {
  return typeof value === "number" ? value.toLocaleString("vi-VN") : "Đang cập nhật";
}

function formatHomepageRating(value: number | null) {
  if (!value || !Number.isFinite(value)) return "Chưa có";

  return value.toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatHomepageCompletionRate(metrics: HomepageMetricData) {
  if (typeof metrics.totalJobs !== "number" || typeof metrics.completedJobs !== "number") {
    return "Đang cập nhật";
  }

  if (metrics.totalJobs <= 0) return "Chưa có";

  return String(Math.round((metrics.completedJobs / metrics.totalJobs) * 100)) + "%";
}

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
  avatar_url?: string | null;
  gps_location?: GpsLocation | null;
};

type DispatchWorker = {
  id: string;
  specialties?: string[] | null;
  avg_rating?: number | string | null;
  total_jobs?: number | null;
  profiles?: DispatchWorkerProfile | DispatchWorkerProfile[] | null;
};

type HomepageDispatchWorker = HomepageNearbyWorker;

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
  const canonicalSlugs = new Set(defaultCmsSlugs);
  const pages = (dbPages || []).filter((page) => canonicalSlugs.has(page.slug));
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
    homepageMetrics: HomepageMetricData;
  }> => {
    const supabase = getPublicSupabase();

    const [
      settingsResult,
      servicesResult,
      workersResult,
      ratingsResult,
      cmsPagesResult,
      totalJobsResult,
      completedJobsResult,
      activeWorkersResult,
      availableWorkersResult,
      ratingScoresResult,
    ] = await Promise.all([
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
        .select("id,specialties,avg_rating,total_jobs,profiles(full_name,phone,address,avatar_url,gps_location)")
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
      supabase.from("jobs").select("id", { count: "exact", head: true }),
      supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", ["completed", "done"]),
      supabase.from("workers").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("workers").select("id", { count: "exact", head: true }).eq("status", "active").eq("is_available", true),
      supabase.from("ratings").select("score").not("score", "is", null).limit(5000),
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
    if (totalJobsResult.error) {
      console.warn("Could not load homepage total jobs:", totalJobsResult.error.message);
    }

    if (completedJobsResult.error) {
      console.warn("Could not load homepage completed jobs:", completedJobsResult.error.message);
    }

    if (activeWorkersResult.error) {
      console.warn("Could not load homepage active workers:", activeWorkersResult.error.message);
    }

    if (availableWorkersResult.error) {
      console.warn("Could not load homepage available workers:", availableWorkersResult.error.message);
    }

    if (ratingScoresResult.error) {
      console.warn("Could not load homepage rating scores:", ratingScoresResult.error.message);
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
          avatarUrl: profile.avatar_url || null,
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

    const ratingScores = ((ratingScoresResult.data || []) as Array<{ score?: number | null }>)
      .map((row) => Number(row.score || 0))
      .filter((score) => Number.isFinite(score) && score > 0);
    const averageRating = ratingScores.length > 0
      ? ratingScores.reduce((total, score) => total + score, 0) / ratingScores.length
      : null;
    const homepageMetrics: HomepageMetricData = {
      totalJobs: totalJobsResult.error ? null : totalJobsResult.count ?? 0,
      completedJobs: completedJobsResult.error ? null : completedJobsResult.count ?? 0,
      activeWorkers: activeWorkersResult.error ? null : activeWorkersResult.count ?? 0,
      availableWorkers: availableWorkersResult.error ? null : availableWorkersResult.count ?? 0,
      averageRating,
      ratingCount: ratingScores.length,
    };
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
      homepageMetrics,
    };
  },
  ["homepage-data"],
  { revalidate: 300 }
);

export default async function HomePage() {
  const [{ systemSettings, dbServices, dispatchWorkers, customerReviews, cmsPages, homepageMetrics }, apkDownloadData] = await Promise.all([
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

  const homepageStats = [
    {
      value: formatHomepageCount(homepageMetrics.totalJobs),
      label: "Lượt đặt dịch vụ",
      note: "Tổng đơn trong hệ thống",
      icon: UsersIcon,
    },
    {
      value: formatHomepageCount(homepageMetrics.activeWorkers),
      label: "Thợ chuyên nghiệp",
      note: "Hồ sơ thợ đang hoạt động",
      icon: BriefcaseIcon,
    },
    {
      value: formatHomepageRating(homepageMetrics.averageRating),
      label: "Đánh giá trung bình",
      note: homepageMetrics.ratingCount > 0 ? `${homepageMetrics.ratingCount.toLocaleString("vi-VN")} đánh giá thật` : "Chưa có đánh giá",
      icon: StarIcon,
    },
    {
      value: formatHomepageCount(homepageMetrics.availableWorkers),
      label: "Thợ đang trực",
      note: "Có thể nhận việc ngay",
      icon: ClockIcon,
    },
    {
      value: formatHomepageCompletionRate(homepageMetrics),
      label: "Hoàn thành",
      note: typeof homepageMetrics.completedJobs === "number" ? `${homepageMetrics.completedJobs.toLocaleString("vi-VN")} việc đã xong` : "Đang cập nhật",
      icon: ShieldCheckIcon,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-50 border-b border-outline-variant/20 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto max-w-none px-4 sm:px-6 lg:px-12">
          <div className="flex h-16 items-center justify-between gap-4 lg:h-[72px]">
            <Link href="/" className="group flex min-w-0 items-center gap-3" id="nav-logo">
              <LogoIcon size={40} />
              <span className="truncate text-xl font-extrabold text-primary-container sm:text-2xl">
                {systemSettings.app_name}
              </span>
            </Link>

            <nav className="hidden items-center gap-8 md:flex">
              <a href="#services" className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant transition-colors hover:text-primary-container">
                Dịch vụ <span className="text-base leading-none">⌄</span>
              </a>
              <a href="#how-it-works" className="text-sm font-bold text-on-surface-variant transition-colors hover:text-primary-container">
                Cách hoạt động
              </a>
              <Link href="/hanh-trinh" className="text-sm font-bold text-on-surface-variant transition-colors hover:text-primary-container">
                Hành trình
              </Link>
              <a href="#reviews" className="text-sm font-bold text-on-surface-variant transition-colors hover:text-primary-container">
                Đánh giá
              </a>
              <a href="#download-app" className="text-sm font-bold text-on-surface-variant transition-colors hover:text-primary-container">
                Tải app
              </a>
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-outline-variant/45 bg-white px-3 py-2 text-sm font-extrabold text-primary-container shadow-sm transition-all hover:border-primary/35 hover:bg-primary-fixed/50 sm:min-w-32 sm:px-5"
                id="nav-login"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="hidden min-h-10 items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-extrabold !text-white shadow-sm transition-all hover:bg-primary-container sm:inline-flex sm:min-w-32"
                id="nav-register"
              >
                Đăng ký
              </Link>
            </div>
          </div>
          <nav id="mobile-public-nav" className="flex gap-2 overflow-x-auto border-t border-outline-variant/20 py-2 md:hidden" aria-label="Menu chính">
            <a href="#services" className="shrink-0 rounded-full bg-surface-container px-3 py-1.5 text-xs font-extrabold text-on-surface-variant">Dịch vụ</a>
            <a href="#how-it-works" className="shrink-0 rounded-full bg-surface-container px-3 py-1.5 text-xs font-extrabold text-on-surface-variant">Cách hoạt động</a>
            <Link href="/hanh-trinh" className="shrink-0 rounded-full bg-primary-fixed px-3 py-1.5 text-xs font-extrabold text-primary-container">Hành trình</Link>
            <a href="#reviews" className="shrink-0 rounded-full bg-surface-container px-3 py-1.5 text-xs font-extrabold text-on-surface-variant">Đánh giá</a>
            <a href="#download-app" className="shrink-0 rounded-full bg-surface-container px-3 py-1.5 text-xs font-extrabold text-on-surface-variant">Tải app</a>
          </nav>
        </div>
      </header>

      <CmsPlacement location="featured_notice" variant="banner" limit={2} />
      <CmsPlacement location="popup" variant="popup" limit={1} />

      <section className="relative overflow-hidden bg-primary-container text-on-primary xl:h-[742px]">
        <div className="absolute inset-0 bg-[linear-gradient(112deg,#044ec3_0%,#075edb_42%,#0878ff_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_56%_18%,rgba(56,189,248,0.34),transparent_20%),radial-gradient(circle_at_72%_48%,rgba(14,165,233,0.22),transparent_28%),linear-gradient(90deg,rgba(0,32,105,0.28),rgba(0,32,105,0)_47%,rgba(0,32,105,0.16))]" />
        <div className="absolute bottom-0 left-[34%] hidden h-[72%] w-[42%] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_36%),repeating-linear-gradient(90deg,rgba(255,255,255,0.10)_0_1px,transparent_1px_74px)] opacity-30 xl:block" />
        <div className="absolute bottom-0 right-0 hidden h-[76%] w-[46%] bg-[linear-gradient(180deg,rgba(8,145,178,0.20),rgba(7,89,190,0.04)_44%,rgba(1,25,94,0.18)),repeating-linear-gradient(0deg,rgba(255,255,255,0.08)_0_1px,transparent_1px_86px)] opacity-35 xl:block" />
        <div className="absolute bottom-[3.25rem] left-[40%] hidden h-[17rem] w-[42%] opacity-16 xl:block">
          <span className="absolute bottom-0 left-[2%] h-28 w-10 rounded-t-sm bg-[#063f9f]/55" />
          <span className="absolute bottom-0 left-[14%] h-44 w-14 rounded-t-sm bg-[#0b58bc]/42" />
          <span className="absolute bottom-0 left-[29%] h-36 w-12 rounded-t-sm bg-[#0750ad]/48" />
          <span className="absolute bottom-0 left-[45%] h-56 w-16 rounded-t-sm bg-[#064494]/38" />
          <span className="absolute bottom-0 left-[63%] h-40 w-12 rounded-t-sm bg-[#0a5fc6]/44" />
          <span className="absolute bottom-0 left-[78%] h-64 w-14 rounded-t-sm bg-[#063d8e]/34" />
        </div>
        <div className="absolute left-[39%] top-[19%] hidden h-44 w-44 rounded-full border border-white/8 bg-white/5 xl:block" />
        <div className="absolute left-[42%] top-[25%] hidden h-px w-36 rotate-[34deg] border-t border-dashed border-white/22 xl:block" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-surface via-surface/18 to-transparent" />

        <div className="relative mx-auto grid max-w-[100rem] gap-8 px-4 pb-24 pt-10 sm:px-6 sm:pb-28 sm:pt-12 md:grid-cols-2 md:items-center lg:px-8 xl:h-full xl:grid-cols-[39fr_29fr_32fr] xl:items-start xl:gap-8 xl:px-16 xl:pb-0 xl:pt-0 2xl:gap-9">
          <div className="relative z-20 min-w-0 max-w-[34rem] xl:pt-[58px]">
            <div className="mb-8 inline-flex max-w-full items-center gap-2 rounded-full border border-white/24 bg-white/10 px-4 py-2.5 shadow-sm backdrop-blur-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" />
              <span className="truncate text-sm font-extrabold !text-white sm:text-base">
                Đang hoạt động 24/7 tại Nghĩa Lâm, Ninh Bình
              </span>
            </div>

            <h1 className="relative max-w-full text-[2.55rem] font-black italic leading-[0.94] !text-white drop-shadow-[0_8px_26px_rgba(0,0,0,0.32)] min-[390px]:text-[2.85rem] sm:text-6xl xl:text-[4.08rem] 2xl:text-[4.55rem]">
              <span className="block whitespace-nowrap">THỢ GIỎI</span>
              <span className="relative mt-2 block whitespace-nowrap text-[#FACC15] drop-shadow-[0_8px_22px_rgba(0,0,0,0.28)]">
                ĐẾN NGAY
                <span
                  className="absolute -right-[0.72rem] top-[-0.22rem] hidden h-[4.02rem] w-[1.92rem] -rotate-[2deg] bg-[#FACC15] drop-shadow-[0_8px_18px_rgba(0,0,0,0.25)] xl:block 2xl:-right-[0.82rem] 2xl:h-[4.48rem] 2xl:w-[2.1rem]"
                  style={{ clipPath: "polygon(44% 0, 100% 0, 63% 37%, 100% 37%, 18% 100%, 43% 51%, 0 51%)" }}
                  aria-hidden="true"
                />
              </span>
            </h1>

            <p className="mt-8 max-w-[32.5rem] text-base font-semibold leading-7 !text-white/94 drop-shadow-[0_2px_10px_rgba(0,0,0,0.20)] sm:text-lg">
              Kết nối bạn với thợ sửa chữa chuyên nghiệp, được xác minh. Dịch vụ điện, nước, camera, cơ khí chỉ trong vài bước.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-white px-6 py-3 text-sm font-black uppercase text-primary-container shadow-[0_14px_34px_rgba(0,18,48,0.24)] transition-all hover:-translate-y-0.5 hover:bg-primary-fixed sm:min-w-[264px] sm:px-8"
                id="hero-cta"
              >
                <ZapIcon size={18} />
                Đặt dịch vụ ngay
                <ArrowRightIcon size={18} />
              </Link>
              <a
                href={"tel:" + systemSettings.hotline.replace(/\s+/g, "")}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg border border-white/45 bg-white/8 px-6 py-3 text-sm font-black uppercase !text-white shadow-sm backdrop-blur transition-all hover:border-white/70 hover:bg-white/16 sm:min-w-[220px] sm:px-8"
                id="hero-call"
              >
                <PhoneIcon size={20} />
                Gọi: {systemSettings.hotline}
              </a>
            </div>

            <div className="mt-8 grid gap-3 text-white/85 sm:grid-cols-3 xl:max-w-[32.5rem]">
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-white/14 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <ShieldCheckIcon size={24} className="shrink-0 !text-white" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold !text-white">Thợ xác minh</div>
                  <div className="truncate text-xs !text-white/72">Lý lịch rõ ràng</div>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-white/14 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <ClockIcon size={24} className="shrink-0 !text-white" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold !text-white">Phản hồi &lt; 5 phút</div>
                  <div className="truncate text-xs !text-white/72">Hỗ trợ nhanh chóng</div>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-white/14 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <StarIcon size={24} className="shrink-0 !text-primary-fixed" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold !text-white">4.8/5 sao</div>
                  <div className="truncate text-xs !text-white/72">Đánh giá từ khách hàng</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 order-2 mx-auto flex h-[410px] min-w-0 w-full max-w-[28rem] items-end justify-center sm:h-[520px] md:col-span-2 md:h-[540px] xl:order-none xl:col-span-1 xl:-ml-[6.65rem] xl:h-[742px] xl:w-[38.6rem] xl:max-w-none xl:overflow-visible 2xl:-ml-[7.15rem] 2xl:w-[39.2rem]">
            <div className="absolute bottom-14 left-1/2 hidden h-[31rem] w-[23rem] -translate-x-1/2 rounded-full bg-cyan-300/16 blur-3xl xl:block" />
            <Image
              src="/hero-technician-final.png"
              alt="Người thợ áo xanh Thợ Đến Ngay"
              fill
              priority
              sizes="(min-width: 1536px) 628px, (min-width: 1280px) 618px, 92vw"
              className="object-contain object-bottom drop-shadow-[0_28px_60px_rgba(0,18,48,0.36)] xl:translate-y-1 xl:scale-[1.02] xl:origin-bottom"
            />
            <div className="absolute right-1 top-10 hidden h-32 w-32 rounded-full border border-cyan-100/40 bg-cyan-300/14 px-4 py-4 text-center shadow-[0_18px_44px_rgba(0,18,48,0.24),inset_0_0_24px_rgba(125,211,252,0.24)] backdrop-blur-md sm:block xl:right-[1.35rem] xl:top-[4.75rem] xl:h-[7.25rem] xl:w-[7.25rem] xl:px-3 xl:py-3 2xl:right-[1.2rem]">
              <span className="pointer-events-none absolute inset-[-7px] rounded-full border-2 border-cyan-200/40" />
              <div className="flex items-center justify-center gap-1.5 text-sm font-extrabold xl:gap-1 xl:text-[0.72rem] !text-white/90">
                <MapPinIcon size={18} />
                Định vị thật
              </div>
              <div className="mt-1 text-[1.78rem] font-black leading-none xl:text-[1.42rem] !text-white">Live GPS</div>
              <div className="text-sm font-bold !text-white/82 xl:text-xs">Theo vị trí thật</div>
            </div>
          </div>

          <div className="relative z-20 min-w-0 order-3 xl:order-none xl:self-start xl:pt-[30px]">
            <HomepageNearbyWorkers workers={dispatchWorkers} />
          </div>
        </div>
      </section>

      <section className="relative z-30 -mt-[52px] pb-8">
        <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
          <div className="grid min-h-[132px] grid-cols-1 gap-3 rounded-xl border border-outline-variant/25 bg-white/96 p-5 shadow-[0_20px_55px_rgba(15,35,66,0.14)] backdrop-blur sm:grid-cols-2 lg:grid-cols-5 lg:p-5">
            {homepageStats.map((stat) => {
              const StatIcon = stat.icon;

              return (
                <div key={stat.label} className="flex items-center gap-4 border-outline-variant/40 px-2 py-3 sm:px-4 lg:border-r lg:last:border-r-0">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_10px_28px_rgba(37,99,235,0.28)]">
                    <StatIcon size={28} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-2xl font-black text-primary-container">{stat.value}</div>
                    <div className="truncate text-sm font-extrabold text-on-surface">{stat.label}</div>
                    <div className="truncate text-xs font-medium text-on-surface-variant">{stat.note}</div>
                  </div>
                </div>
              );
            })}
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
                <li><Link href="/hanh-trinh" className="hover:text-white transition-colors">Hành trình</Link></li>
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
