"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, MapPinIcon, StarIcon } from "./icons";

export type HomepageNearbyWorker = {
  id: string;
  name: string;
  specialty: string;
  rating: string;
  totalJobs: number;
  avatarUrl: string | null;
  distanceLabel?: string | null;
  distanceMeters?: number | null;
  isNearest?: boolean;
};

type LocationState = "requesting" | "granted" | "denied" | "unsupported" | "error";

type HomepageNearbyWorkersProps = {
  workers: HomepageNearbyWorker[];
};

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] || "T";
  const last = words.length > 1 ? words[words.length - 1]?.[0] : "";

  return `${first}${last}`.toUpperCase();
}

function getLocationMessage(state: LocationState) {
  if (state === "requesting") return "Đang xin vị trí tạm thời để tính khoảng cách";
  if (state === "granted") return "Đã sắp xếp theo vị trí hiện tại của bạn";
  if (state === "denied") return "Bật định vị để xem thợ gần bạn nhất";
  if (state === "unsupported") return "Trình duyệt chưa hỗ trợ định vị";
  return "Chưa thể tính khoảng cách lúc này";
}

function getWorkerDistanceLabel(worker: HomepageNearbyWorker, state: LocationState) {
  if (worker.distanceLabel) return `Cách bạn ${worker.distanceLabel}`;
  if (state === "requesting") return "Đang tính khoảng cách";
  if (state === "denied") return "Chưa cấp quyền vị trí";
  if (state === "unsupported") return "Chưa có định vị trình duyệt";
  return "Chưa có khoảng cách";
}

export default function HomepageNearbyWorkers({ workers }: HomepageNearbyWorkersProps) {
  const [locationState, setLocationState] = useState<LocationState>("requesting");
  const [nearbyWorkers, setNearbyWorkers] = useState(workers);

  useEffect(() => {
    let cancelled = false;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      window.queueMicrotask(() => {
        if (!cancelled) setLocationState("unsupported");
      });

      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch("/api/homepage/nearby-workers", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lat: Number(position.coords.latitude.toFixed(7)),
              lng: Number(position.coords.longitude.toFixed(7)),
            }),
          });
          const payload = (await response.json()) as { workers?: HomepageNearbyWorker[]; error?: string };

          if (!response.ok || !Array.isArray(payload.workers)) {
            throw new Error(payload.error || "Không thể tải thợ gần bạn.");
          }

          if (!cancelled) {
            setNearbyWorkers(payload.workers);
            setLocationState("granted");
          }
        } catch {
          if (!cancelled) setLocationState("error");
        }
      },
      (error) => {
        if (cancelled) return;
        setLocationState(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 8_000,
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="rounded-xl border border-white/25 bg-white/10 p-4 text-white shadow-[0_26px_86px_rgba(0,18,48,0.34)] backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase !text-white">Đang điều phối</p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight !text-white">Thợ gần bạn nhất</h2>
          <p className="mt-1 text-sm leading-5 !text-white/78">{getLocationMessage(locationState)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-success px-3 py-1.5 text-xs font-extrabold !text-white">
          Live GPS
        </span>
      </div>

      {nearbyWorkers.length > 0 ? (
        <div className="space-y-3">
          {nearbyWorkers.slice(0, 3).map((worker, index) => (
            <article key={worker.id} className="rounded-lg border border-white/14 bg-white/14 p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-extrabold text-primary-container">
                  {worker.avatarUrl ? (
                    <Image
                      src={worker.avatarUrl}
                      alt={worker.name}
                      fill
                      sizes="56px"
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
                  {worker.isNearest || (locationState === "granted" && index === 0) ? (
                    <span className="rounded-full bg-success px-2.5 py-1 text-xs font-extrabold !text-white">Gần nhất</span>
                  ) : null}
                  <span className="text-xs font-extrabold !text-white">{worker.totalJobs} jobs</span>
                </div>
              </div>
            </article>
          ))}
          <Link href="/register" className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-extrabold !text-white shadow-sm transition-all hover:bg-primary-container active:scale-[0.98]">
            Xem thêm thợ gần bạn
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-white/14 bg-white/14 p-4">
          <p className="text-sm font-bold !text-white">Chưa có thợ active bật GPS</p>
          <p className="mt-1 text-xs leading-5 !text-white/72">
            Khi thợ cập nhật vị trí trong hồ sơ, danh sách này sẽ tự hiển thị trên trang chủ.
          </p>
        </div>
      )}
    </aside>
  );
}

