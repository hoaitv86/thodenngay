import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getDistanceKm, type GpsPoint } from "@/lib/location";

export const dynamic = "force-dynamic";

type GpsLocation = {
  lat?: number | string | null;
  lng?: number | string | null;
};

type WorkerProfile = {
  full_name?: string | null;
  avatar_url?: string | null;
  gps_location?: GpsLocation | null;
};

type WorkerRow = {
  id: string;
  specialties?: string[] | null;
  avg_rating?: number | string | null;
  total_jobs?: number | null;
  profiles?: WorkerProfile | WorkerProfile[] | null;
};

export const HOMEPAGE_NEARBY_WORKER_LIMIT = 6;

function getPublicSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toGpsPoint(value: unknown): GpsPoint | null {
  if (!value || typeof value !== "object") return null;

  const point = value as Partial<GpsLocation>;
  const lat = Number(point.lat);
  const lng = Number(point.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return { lat, lng };
}

function formatPublicDistance(distanceKm: number) {
  if (!Number.isFinite(distanceKm)) return null;

  const meters = Math.max(1, Math.round(distanceKm * 1000));
  if (meters < 1000) return `${meters.toLocaleString("vi-VN")} m`;

  return `${distanceKm.toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
    minimumFractionDigits: distanceKm < 10 ? 1 : 0,
  })} km`;
}

export function getHomepageNearbyWorkers(
  rows: WorkerRow[],
  viewerLocation: GpsPoint,
  limit = HOMEPAGE_NEARBY_WORKER_LIMIT
) {
  return rows
    .map((worker) => {
      const profile = firstRelation(worker.profiles);
      const workerLocation = toGpsPoint(profile?.gps_location);

      if (!profile || !workerLocation) return null;

      const distanceKm = getDistanceKm(viewerLocation, workerLocation);
      const rating = Number(worker.avg_rating || 0);

      return {
        id: worker.id,
        name: profile.full_name?.trim() || "Thợ đang hoạt động",
        specialty: worker.specialties?.find(Boolean) || "Sẵn sàng nhận việc",
        rating: rating > 0 ? rating.toFixed(1) : "Mới",
        totalJobs: worker.total_jobs || 0,
        avatarUrl: profile.avatar_url || null,
        distanceMeters: Math.round(distanceKm * 1000),
        distanceLabel: formatPublicDistance(distanceKm),
      };
    })
    .filter((worker): worker is NonNullable<typeof worker> => Boolean(worker))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit)
    .map((worker, index) => ({
      ...worker,
      isNearest: index === 0,
    }));
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Thiếu vị trí hiện tại." }, { status: 400 });
  }

  const viewerLocation = toGpsPoint(body);
  if (!viewerLocation) {
    return NextResponse.json({ error: "Vị trí hiện tại không hợp lệ." }, { status: 400 });
  }

  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from("workers")
    .select("id,specialties,avg_rating,total_jobs,profiles(full_name,avatar_url,gps_location)")
    .eq("status", "active")
    .eq("is_available", true)
    .order("avg_rating", { ascending: false })
    .order("total_jobs", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Không thể tải danh sách thợ gần bạn." }, { status: 500 });
  }

  const workers = getHomepageNearbyWorkers((data || []) as WorkerRow[], viewerLocation);

  return NextResponse.json({ workers });
}
