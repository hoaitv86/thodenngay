import assert from "node:assert/strict";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("data:text/javascript,export async function resolve(specifier, context, nextResolve) { const root = 'file:///' + process.cwd().replace(/\\\\/g, '/') + '/'; if (specifier === 'next/server') return nextResolve(new URL('./node_modules/next/server.js', root).href, context); if (specifier.startsWith('@/')) return nextResolve(new URL('./' + specifier.slice(2) + '.ts', root).href, context); return nextResolve(specifier, context); }");

const routeModule = await import(pathToFileURL("app/api/homepage/nearby-workers/route.ts"));
const { getHomepageNearbyWorkers, HOMEPAGE_NEARBY_WORKER_LIMIT } = routeModule;

const viewerLocation = { lat: 10.7769, lng: 106.7009 };
const farHighRatedWorkers = Array.from({ length: 60 }, (_, index) => ({
  id: `far-${index}`,
  specialties: ["Điện"],
  avg_rating: 5,
  total_jobs: 500 - index,
  profiles: {
    full_name: `Thợ xa ${index}`,
    avatar_url: null,
    gps_location: { lat: 21.0278 + index * 0.001, lng: 105.8342 },
  },
}));

const nearestWorker = {
  id: "nearest-low-rated",
  specialties: ["Nước"],
  avg_rating: 1,
  total_jobs: 1,
  profiles: {
    full_name: "Thợ gần nhất",
    avatar_url: null,
    gps_location: { lat: 10.777, lng: 106.701 },
  },
};

const invalidGpsWorker = {
  id: "invalid-gps",
  specialties: ["Camera"],
  avg_rating: 5,
  total_jobs: 999,
  profiles: {
    full_name: "Thợ GPS lỗi",
    avatar_url: null,
    gps_location: { lat: 0, lng: 0 },
  },
};

const result = getHomepageNearbyWorkers(
  [...farHighRatedWorkers, invalidGpsWorker, nearestWorker],
  viewerLocation
);

assert.equal(result.length, HOMEPAGE_NEARBY_WORKER_LIMIT);
assert.equal(result[0].id, nearestWorker.id);
assert.equal(result[0].isNearest, true);
assert.equal(result.some((worker) => worker.id === invalidGpsWorker.id), false);
assert.ok(
  result.every((worker, index, workers) => index === 0 || workers[index - 1].distanceMeters <= worker.distanceMeters),
  "workers are sorted nearest to farthest"
);

console.log("homepage nearby workers regression passed");
