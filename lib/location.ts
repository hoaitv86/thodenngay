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
export const LIVE_GPS_MAX_AGE_MS = 10 * 60 * 1000;
export const GPS_MIN_REFRESH_DISTANCE_METERS = 75;
export const GPS_FORCE_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
export const CUSTOMER_GPS_GOOD_ACCURACY_METERS = 100;
export const CUSTOMER_GPS_APPROXIMATE_ACCURACY_METERS = 500;
export const CUSTOMER_GPS_ANOMALY_DISTANCE_METERS = 20_000;
export const CUSTOMER_GPS_ANOMALY_WINDOW_MS = 60_000;

export type CustomerGpsAccuracyStatus = "good" | "approximate" | "poor";

export const isGpsPoint = (value: unknown): value is GpsPoint => {
  if (!value || typeof value !== "object") return false;

  const point = value as Partial<GpsPoint>;
  return (
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lng) &&
    !(point.lat === 0 && point.lng === 0) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
};

export const toGpsPoint = (value: unknown): GpsPoint | null => {
  if (!value || typeof value !== "object") return null;

  const point = value as Partial<Record<keyof GpsPoint, unknown>>;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  const accuracy = Number(point.accuracy);
  const normalized = {
    lat,
    lng,
    ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy } : {}),
    ...(typeof point.captured_at === "string" ? { captured_at: point.captured_at } : {}),
  };

  return isGpsPoint(normalized) ? normalized : null;
};

export const getGpsAccuracyMeters = (point?: GpsPoint | null) => {
  const accuracy = Number(point?.accuracy);
  return Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null;
};

export const getCustomerGpsAccuracyStatus = (point?: GpsPoint | null): CustomerGpsAccuracyStatus => {
  const accuracy = getGpsAccuracyMeters(point);
  if (accuracy === null) return "poor";
  if (accuracy <= CUSTOMER_GPS_GOOD_ACCURACY_METERS) return "good";
  if (accuracy <= CUSTOMER_GPS_APPROXIMATE_ACCURACY_METERS) return "approximate";
  return "poor";
};

export const canUseCustomerGpsForDistance = (point?: GpsPoint | null) =>
  getCustomerGpsAccuracyStatus(point) !== "poor";

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

export const getDistanceMeters = (from: GpsPoint, to: GpsPoint) =>
  getDistanceKm(from, to) * 1000;

export const isLiveGpsTimestamp = (
  locationUpdatedAt?: string | null,
  nowMs = Date.now(),
  maxAgeMs = LIVE_GPS_MAX_AGE_MS
) => {
  if (!locationUpdatedAt) return false;

  const updatedAtMs = new Date(locationUpdatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return false;

  const ageMs = nowMs - updatedAtMs;
  return ageMs >= 0 && ageMs <= maxAgeMs;
};

export const shouldPublishGpsLocation = (
  previous: { point?: GpsPoint | null; updatedAtMs?: number | null },
  next: GpsPoint,
  nowMs = Date.now(),
  minDistanceMeters = GPS_MIN_REFRESH_DISTANCE_METERS,
  forceIntervalMs = GPS_FORCE_REFRESH_INTERVAL_MS
) => {
  if (!isGpsPoint(next)) return false;
  if (!previous.point || !isGpsPoint(previous.point)) return true;

  const movedMeters = getDistanceMeters(previous.point, next);
  const updatedAtMs = Number(previous.updatedAtMs);
  const ageMs = Number.isFinite(updatedAtMs) ? nowMs - updatedAtMs : Number.POSITIVE_INFINITY;

  return movedMeters >= minDistanceMeters || ageMs >= forceIntervalMs;
};

export const shouldAcceptCustomerGpsFix = (
  previous: { point?: GpsPoint | null; updatedAtMs?: number | null },
  next: GpsPoint,
  nowMs = Date.now()
) => {
  if (!isGpsPoint(next) || !canUseCustomerGpsForDistance(next)) return false;
  if (!previous.point || !isGpsPoint(previous.point)) return true;

  const movedMeters = getDistanceMeters(previous.point, next);
  const updatedAtMs = Number(previous.updatedAtMs);
  const ageMs = Number.isFinite(updatedAtMs) ? nowMs - updatedAtMs : Number.POSITIVE_INFINITY;
  const nextStatus = getCustomerGpsAccuracyStatus(next);

  if (
    movedMeters >= CUSTOMER_GPS_ANOMALY_DISTANCE_METERS &&
    ageMs >= 0 &&
    ageMs <= CUSTOMER_GPS_ANOMALY_WINDOW_MS &&
    nextStatus !== "good"
  ) {
    return false;
  }

  return shouldPublishGpsLocation(previous, next, nowMs);
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
