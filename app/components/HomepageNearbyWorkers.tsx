"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, MapPinIcon, StarIcon } from "./icons";
import {
  GPS_MIN_REFRESH_DISTANCE_METERS,
  getCustomerGpsAccuracyStatus,
  getDistanceMeters,
  shouldAcceptCustomerGpsFix,
  toGpsPoint,
  type CustomerGpsAccuracyStatus,
  type GpsPoint,
} from "@/lib/location";

export type HomepageNearbyWorker = {
  id: string;
  name: string;
  specialty: string;
  rating: string;
  totalJobs: number;
  avatarUrl: string | null;
  distanceLabel?: string | null;
  distanceMeters?: number | null;
  distanceIsApproximate?: boolean;
  isNearest?: boolean;
  hasLiveGps?: boolean;
};

type LocationState = "requesting" | "granted" | "approximate" | "poor" | "denied" | "unsupported" | "error";

type HomepageNearbyWorkersProps = {
  workers: HomepageNearbyWorker[];
};

const CUSTOMER_LOCATION_FORCE_REFRESH_MS = 45_000;
const CUSTOMER_NEARBY_REQUEST_MIN_INTERVAL_MS = 5_000;

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] || "T";
  const last = words.length > 1 ? words[words.length - 1]?.[0] : "";

  return `${first}${last}`.toUpperCase();
}

function getLocationMessage(state: LocationState) {
  if (state === "requesting") return "Đang xin vị trí hiện tại để tính khoảng cách";
  if (state === "granted") return "Đã sắp xếp theo GPS hiện tại của bạn";
  if (state === "approximate") return "GPS của bạn chưa thật chính xác, khoảng cách chỉ là tạm tính";
  if (state === "poor") return "GPS của bạn đang quá yếu, đang chờ tín hiệu tốt hơn";
  if (state === "denied") return "Bật định vị để xem thợ gần bạn nhất";
  if (state === "unsupported") return "Trình duyệt chưa hỗ trợ định vị";
  return "Chưa thể tính khoảng cách lúc này";
}

function getWorkerDistanceLabel(worker: HomepageNearbyWorker, state: LocationState) {
  if (worker.distanceIsApproximate && worker.distanceLabel) return `Khoảng ${worker.distanceLabel}`;
  if (worker.hasLiveGps && worker.distanceLabel) return `Cách bạn ${worker.distanceLabel}`;
  if (state === "requesting") return "Đang tính khoảng cách";
  if (state === "approximate") return "Vị trí của bạn chưa chính xác";
  if (state === "poor") return "GPS của bạn chưa đủ chính xác";
  if (state === "denied") return "Chưa cấp quyền vị trí";
  if (state === "unsupported") return "Chưa có định vị trình duyệt";
  return "Vị trí chưa cập nhật";
}

function toLocationPoint(position: GeolocationPosition): GpsPoint | null {
  return toGpsPoint({
    lat: Number(position.coords.latitude.toFixed(7)),
    lng: Number(position.coords.longitude.toFixed(7)),
    accuracy: Math.round(position.coords.accuracy),
    captured_at: new Date(position.timestamp || Date.now()).toISOString(),
  });
}

export default function HomepageNearbyWorkers({ workers }: HomepageNearbyWorkersProps) {
  const [locationState, setLocationState] = useState<LocationState>("requesting");
  const [nearbyWorkers, setNearbyWorkers] = useState(workers);

  useEffect(() => {
    let cancelled = false;
    let watchId: number | null = null;
    let lastRequestedLocation: GpsPoint | null = null;
    let lastRequestAtMs = 0;
    let lastAcceptedLocation: GpsPoint | null = null;
    let lastAcceptedAtMs = 0;
    let inFlight = false;
    let queuedLocation: GpsPoint | null = null;
    let queuedTimerId: number | null = null;

    const loadNearbyWorkers = async (location: GpsPoint) => {
      if (cancelled) return;

      const nowMs = Date.now();
      if (
        lastRequestedLocation &&
        getDistanceMeters(lastRequestedLocation, location) < GPS_MIN_REFRESH_DISTANCE_METERS &&
        nowMs - lastRequestAtMs < CUSTOMER_LOCATION_FORCE_REFRESH_MS
      ) {
        return;
      }

      if (inFlight || nowMs - lastRequestAtMs < CUSTOMER_NEARBY_REQUEST_MIN_INTERVAL_MS) {
        queuedLocation = location;
        return;
      }

      inFlight = true;
      lastRequestedLocation = location;
      lastRequestAtMs = nowMs;

      try {
        const response = await fetch("/api/homepage/nearby-workers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lat: location.lat,
            lng: location.lng,
            accuracy: location.accuracy,
            captured_at: location.captured_at,
          }),
        });
        const payload = (await response.json()) as {
          workers?: HomepageNearbyWorker[];
          error?: string;
          customerGpsAccuracyStatus?: CustomerGpsAccuracyStatus;
        };

        if (!response.ok || !Array.isArray(payload.workers)) {
          throw new Error(payload.error || "Không thể tải thợ gần bạn.");
        }

        if (!cancelled) {
          setNearbyWorkers(payload.workers);
          const accuracyStatus = payload.customerGpsAccuracyStatus || getCustomerGpsAccuracyStatus(location);
          setLocationState(accuracyStatus === "good" ? "granted" : accuracyStatus);
        }
      } catch {
        if (!cancelled) setLocationState("error");
      } finally {
        inFlight = false;
        const nextQueuedLocation = queuedLocation;
        queuedLocation = null;
        if (nextQueuedLocation && !cancelled) {
          if (queuedTimerId !== null) window.clearTimeout(queuedTimerId);
          queuedTimerId = window.setTimeout(() => {
            queuedTimerId = null;
            void loadNearbyWorkers(nextQueuedLocation);
          }, CUSTOMER_NEARBY_REQUEST_MIN_INTERVAL_MS);
        }
      }
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      window.queueMicrotask(() => {
        if (!cancelled) setLocationState("unsupported");
      });

      return () => {
        cancelled = true;
      };
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = toLocationPoint(position);
        if (!location) return;

        const nowMs = Date.now();
        if (!shouldAcceptCustomerGpsFix({ point: lastAcceptedLocation, updatedAtMs: lastAcceptedAtMs }, location, nowMs)) {
          if (!lastAcceptedLocation && getCustomerGpsAccuracyStatus(location) === "poor") setLocationState("poor");
          return;
        }

        lastAcceptedLocation = location;
        lastAcceptedAtMs = nowMs;
        void loadNearbyWorkers(location);
      },
      (error) => {
        if (cancelled) return;
        setLocationState(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15_000,
        timeout: 15_000,
      }
    );

    return () => {
      cancelled = true;
      if (queuedTimerId !== null) window.clearTimeout(queuedTimerId);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const hasLiveGpsResults = locationState === "granted" && nearbyWorkers.some(worker => worker.hasLiveGps && worker.distanceLabel);
  const hasApproximateGpsResults = locationState === "approximate" && nearbyWorkers.some(worker => worker.distanceIsApproximate && worker.distanceLabel);

  return (
    <aside className="flex flex-col rounded-[1.25rem] border border-white/25 bg-white/10 p-4 text-white shadow-[0_26px_86px_rgba(0,18,48,0.34)] backdrop-blur-xl sm:p-5 xl:h-[638px]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase !text-white">Đang điều phối</p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight !text-white xl:text-[1.65rem]">Thợ gần bạn nhất</h2>
          <p className="mt-1 text-sm leading-5 !text-white/78">{getLocationMessage(locationState)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold !text-white ${hasLiveGpsResults ? "bg-success" : "bg-white/20"}`}>
          {hasLiveGpsResults ? "Live GPS" : hasApproximateGpsResults ? "GPS tạm" : locationState === "poor" ? "GPS yếu" : "Chờ GPS"}
        </span>
      </div>

      {nearbyWorkers.length > 0 ? (
        <div className="flex flex-1 flex-col gap-3">
          {nearbyWorkers.slice(0, 3).map((worker, index) => (
            <article key={worker.id} className="rounded-lg border border-white/14 bg-white/14 p-3 shadow-sm xl:p-3.5">
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-extrabold text-primary-container xl:h-16 xl:w-16">
                  {worker.avatarUrl ? (
                    <Image
                      src={worker.avatarUrl}
                      alt={worker.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    getInitials(worker.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-extrabold !text-white">{worker.name}</h3>
                  <p className="truncate text-sm !text-white/76">{worker.specialty}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary-container/50 px-2.5 py-1 text-xs font-extrabold !text-white">
                  <StarIcon size={14} className="!text-yellow-300" />
                  {worker.rating}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-white/10 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2 text-sm font-extrabold !text-white">
                  <MapPinIcon size={15} className="shrink-0 !text-white" />
                  <span className="truncate">{getWorkerDistanceLabel(worker, locationState)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {worker.isNearest || (locationState !== "poor" && locationState !== "requesting" && index === 0) ? (
                    <span className="rounded-full bg-success px-2.5 py-1 text-xs font-extrabold !text-white">Gần nhất</span>
                  ) : null}
                  <span className="text-xs font-extrabold !text-white">{worker.totalJobs} jobs</span>
                </div>
              </div>
            </article>
          ))}
          <Link href="/register" className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-extrabold !text-white shadow-sm transition-all hover:bg-primary-container active:scale-[0.98] xl:min-h-12">
            Xem thêm thợ gần bạn
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-white/14 bg-white/14 p-4">
          <p className="text-sm font-bold !text-white">Chưa có thợ Online có GPS mới</p>
          <p className="mt-1 text-xs leading-5 !text-white/72">
            Khi thợ Online và cập nhật vị trí live, danh sách này sẽ tự hiển thị theo khoảng cách thật.
          </p>
        </div>
      )}
    </aside>
  );
}
