import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_DISTANCE_METERS = 100;
const MAX_LOCATION_AGE_MS = 5 * 60 * 1000;

type StoredLocation = {
  latitude?: number | string | null;
  longitude?: number | string | null;
  last_location_at?: string | null;
};

export type LoginLocationResult =
  | { status: "updated"; latitude: number; longitude: number }
  | { status: "skipped" | "denied" | "unavailable" | "error" };

const toRadians = (degrees: number) => degrees * (Math.PI / 180);

const getDistanceMeters = (
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
) => {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(fromLatitude)) *
      Math.cos(toRadians(toLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getCurrentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 60_000,
    });
  });

const getPermissionState = async (): Promise<PermissionState | null> => {
  if (!navigator.permissions?.query) return null;

  try {
    const permission = await navigator.permissions.query({ name: "geolocation" });
    return permission.state;
  } catch {
    return null;
  }
};

const shouldUpdateLocation = (
  stored: StoredLocation | null,
  latitude: number,
  longitude: number
) => {
  const previousLatitude = Number(stored?.latitude);
  const previousLongitude = Number(stored?.longitude);
  const previousUpdateAt = stored?.last_location_at
    ? new Date(stored.last_location_at).getTime()
    : Number.NaN;

  if (
    !Number.isFinite(previousLatitude) ||
    !Number.isFinite(previousLongitude) ||
    !Number.isFinite(previousUpdateAt)
  ) {
    return true;
  }

  const movedMeters = getDistanceMeters(
    previousLatitude,
    previousLongitude,
    latitude,
    longitude
  );
  const locationAgeMs = Date.now() - previousUpdateAt;

  return movedMeters > MIN_DISTANCE_METERS || locationAgeMs > MAX_LOCATION_AGE_MS;
};

export async function saveLoginLocation(
  supabase: SupabaseClient,
  userId: string
): Promise<LoginLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { status: "unavailable" };
  }

  try {
    const permissionState = await getPermissionState();
    if (permissionState === "denied") return { status: "denied" };

    const position = await getCurrentPosition();
    const latitude = Number(position.coords.latitude.toFixed(7));
    const longitude = Number(position.coords.longitude.toFixed(7));

    const { data: storedLocation, error: readError } = await supabase
      .from("profiles")
      .select("latitude, longitude, last_location_at")
      .eq("id", userId)
      .maybeSingle();

    if (readError || !shouldUpdateLocation(storedLocation, latitude, longitude)) {
      return { status: readError ? "error" : "skipped" };
    }

    const updatedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        latitude,
        longitude,
        last_location_at: updatedAt,
        location_updated_at: updatedAt,
        location_updated_by: "login",
        gps_location: {
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(position.coords.accuracy),
          captured_at: updatedAt,
        },
      })
      .eq("id", userId);

    if (updateError) return { status: "error" };
    return { status: "updated", latitude, longitude };
  } catch (error) {
    if (error instanceof GeolocationPositionError && error.code === error.PERMISSION_DENIED) {
      return { status: "denied" };
    }
    return { status: "error" };
  }
}
