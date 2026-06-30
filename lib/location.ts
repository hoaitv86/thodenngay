export type GpsPoint = {
  lat: number;
  lng: number;
  accuracy?: number;
  captured_at?: string;
};

export const GPS_SCHEMA_FIX_SQL = "supabase/migration_gps_location_fix.sql";
export const GPS_SCHEMA_MISSING_MESSAGE =
  `Database chưa có cột GPS. Vui lòng chạy ${GPS_SCHEMA_FIX_SQL} trong Supabase SQL Editor rồi tải lại trang.`;

const EARTH_RADIUS_KM = 6371;
const DEFAULT_CITY_SPEED_KMH = 18;

export const isGpsPoint = (value: unknown): value is GpsPoint => {
  if (!value || typeof value !== "object") return false;

  const point = value as Partial<GpsPoint>;
  return (
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lng)
  );
};

export const isMissingGpsLocationColumnError = (error: unknown) => {
  const message = typeof error === "object" && error && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : String(error || "");

  return (
    message.includes("gps_location") &&
    (message.includes("schema cache") || message.includes("Could not find") || message.includes("column"))
  );
};

export const getGpsLocationErrorMessage = (error: unknown) =>
  isMissingGpsLocationColumnError(error)
    ? GPS_SCHEMA_MISSING_MESSAGE
    : `Không thể lưu vị trí: ${typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "Lỗi không xác định")
      : String(error || "Lỗi không xác định")}`;

export const getDistanceKm = (from: GpsPoint, to: GpsPoint) => {
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export const formatDistanceKm = (distanceKm: number) => {
  if (!Number.isFinite(distanceKm)) return "Chưa có GPS";
  if (distanceKm < 1) return `${Math.max(50, Math.round(distanceKm * 1000 / 50) * 50)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
};

export const formatEtaMinutes = (distanceKm: number, speedKmh = DEFAULT_CITY_SPEED_KMH) => {
  if (!Number.isFinite(distanceKm) || speedKmh <= 0) return "Chưa rõ";
  const minutes = Math.max(3, Math.round((distanceKm / speedKmh) * 60));
  return `${minutes} phút`;
};

export const getRouteEstimate = (from?: GpsPoint | null, to?: GpsPoint | null) => {
  if (!isGpsPoint(from) || !isGpsPoint(to)) {
    return {
      hasGps: false,
      distanceKm: null,
      distance: "Chưa có GPS",
      eta: "Chưa rõ",
    };
  }

  const distanceKm = getDistanceKm(from, to);
  return {
    hasGps: true,
    distanceKm,
    distance: formatDistanceKm(distanceKm),
    eta: formatEtaMinutes(distanceKm),
  };
};
