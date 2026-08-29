import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("data:text/javascript,export async function resolve(specifier, context, nextResolve) { const root = 'file:///' + process.cwd().replace(/\\\\/g, '/') + '/'; if (specifier === 'next/server') return nextResolve(new URL('./node_modules/next/server.js', root).href, context); if (specifier.startsWith('@/')) return nextResolve(new URL('./' + specifier.slice(2) + '.ts', root).href, context); return nextResolve(specifier, context); }");

const routeModule = await import(pathToFileURL("app/api/homepage/nearby-workers/route.ts"));
const locationModule = await import(pathToFileURL("lib/location.ts"));
const { getHomepageNearbyWorkers, HOMEPAGE_NEARBY_WORKER_LIMIT } = routeModule;
const { GPS_FORCE_REFRESH_INTERVAL_MS, GPS_MIN_REFRESH_DISTANCE_METERS, LIVE_GPS_MAX_AGE_MS, getCustomerGpsAccuracyStatus, getDistanceMeters, shouldAcceptCustomerGpsFix, shouldPublishGpsLocation } = locationModule;

const nowMs = Date.parse("2026-08-29T01:00:00.000Z");
const freshAt = new Date(nowMs - 60_000).toISOString();
const staleAt = new Date(nowMs - LIVE_GPS_MAX_AGE_MS - 1_000).toISOString();
const viewerLocation = { lat: 10.7769, lng: 106.7009, accuracy: 20, captured_at: new Date(nowMs).toISOString() };

function worker(id, lat, lng, options = {}) {
  return {
    id,
    specialties: options.specialties || ["Điện"],
    avg_rating: options.rating ?? 4,
    total_jobs: options.totalJobs ?? 10,
    profiles: {
      full_name: options.name || id,
      avatar_url: null,
      gps_location: lat === null ? null : { lat, lng, accuracy: options.accuracy ?? 20 },
      location_updated_at: options.updatedAt ?? freshAt,
    },
  };
}

{
  const result = getHomepageNearbyWorkers([
    worker("same-a", 10.7769, 106.7009),
    worker("same-b", 10.7769, 106.7009),
  ], viewerLocation, 6, nowMs);

  assert.equal(result.length, 2);
  assert.ok(Math.abs(result[0].distanceMeters - result[1].distanceMeters) <= 1, "same location workers have equivalent distance");
}

{
  const oneKmNorth = { lat: 10.785883, lng: 106.7009 };
  const twentyKmNorth = { lat: 10.956563, lng: 106.7009 };
  const result = getHomepageNearbyWorkers([
    worker("20km", twentyKmNorth.lat, twentyKmNorth.lng),
    worker("1km", oneKmNorth.lat, oneKmNorth.lng),
  ], viewerLocation, 6, nowMs);

  assert.equal(result[0].id, "1km");
  assert.ok(result[0].distanceMeters < result[1].distanceMeters);
}

{
  const farHighRatedWorkers = Array.from({ length: 60 }, (_, index) =>
    worker(`far-${index}`, 21.0278 + index * 0.001, 105.8342, { rating: 5, totalJobs: 500 - index })
  );
  const nearestLowRatedWorker = worker("nearest-low-rated", 10.777, 106.701, {
    rating: 1,
    totalJobs: 1,
    specialties: ["Nước"],
    name: "Thợ gần nhất",
  });

  const result = getHomepageNearbyWorkers([...farHighRatedWorkers, nearestLowRatedWorker], viewerLocation, HOMEPAGE_NEARBY_WORKER_LIMIT, nowMs);

  assert.equal(result.length, HOMEPAGE_NEARBY_WORKER_LIMIT);
  assert.equal(result[0].id, nearestLowRatedWorker.id);
  assert.equal(result[0].isNearest, true);
  assert.ok(result.every((item, index, items) => index === 0 || items[index - 1].distanceMeters <= item.distanceMeters), "workers are sorted nearest to farthest");
}

{
  const result = getHomepageNearbyWorkers([
    worker("stale-gps", 10.777, 106.701, { updatedAt: staleAt }),
    worker("null-gps", null, null),
    worker("zero-gps", 0, 0),
    worker("bad-lat", 91, 106.701),
    worker("bad-lng", 10.777, 181),
    worker("fresh", 10.778, 106.702),
  ], viewerLocation, 6, nowMs);

  assert.deepEqual(result.map(item => item.id), ["fresh"]);
  assert.equal(result[0].hasLiveGps, true);
}

{
  const westWorker = worker("west", 10.7769, 106.69);
  const eastWorker = worker("east", 10.7769, 106.72);
  const fromWest = getHomepageNearbyWorkers([eastWorker, westWorker], { lat: 10.7769, lng: 106.691, accuracy: 20 }, 6, nowMs);
  const fromEast = getHomepageNearbyWorkers([eastWorker, westWorker], { lat: 10.7769, lng: 106.719, accuracy: 20 }, 6, nowMs);

  assert.equal(fromWest[0].id, "west");
  assert.equal(fromEast[0].id, "east");
  assert.ok(fromWest.find(item => item.id === "west").distanceMeters < fromEast.find(item => item.id === "west").distanceMeters, "customer movement recalculates distances");
}


{
  const goodCustomerGps = { lat: 10.7769, lng: 106.7009, accuracy: 20 };
  const result = getHomepageNearbyWorkers([worker("near", 10.777, 106.701)], goodCustomerGps, 6, nowMs);

  assert.equal(getCustomerGpsAccuracyStatus(goodCustomerGps), "good");
  assert.equal(result.length, 1);
  assert.equal(result[0].hasLiveGps, true);
  assert.equal(result[0].distanceIsApproximate, false);
  assert.ok(Number.isFinite(result[0].distanceMeters));
}

{
  const approximateCustomerGps = { lat: 10.7769, lng: 106.7009, accuracy: 200 };
  const result = getHomepageNearbyWorkers([worker("near", 10.777, 106.701)], approximateCustomerGps, 6, nowMs);

  assert.equal(getCustomerGpsAccuracyStatus(approximateCustomerGps), "approximate");
  assert.equal(result.length, 1);
  assert.equal(result[0].hasLiveGps, false);
  assert.equal(result[0].distanceIsApproximate, true);
  assert.ok(Number.isFinite(result[0].distanceMeters));
}

{
  const poorCustomerGps = { lat: 10.7769, lng: 106.7009, accuracy: 5000 };
  const result = getHomepageNearbyWorkers([worker("near", 10.777, 106.701)], poorCustomerGps, 6, nowMs);

  assert.equal(getCustomerGpsAccuracyStatus(poorCustomerGps), "poor");
  assert.deepEqual(result, []);
}

{
  const wrongFirstFix = { lat: 11.1369, lng: 106.7009, accuracy: 5000 };
  const correctLaterFix = { lat: 10.7769, lng: 106.7009, accuracy: 20 };
  let accepted = null;
  let acceptedAt = null;

  assert.equal(shouldAcceptCustomerGpsFix({ point: accepted, updatedAtMs: acceptedAt }, wrongFirstFix, nowMs), false, "first 40km bad-accuracy fix is ignored");
  assert.equal(shouldAcceptCustomerGpsFix({ point: accepted, updatedAtMs: acceptedAt }, correctLaterFix, nowMs + 5_000), true, "later accurate fix is accepted");
  accepted = correctLaterFix;
  acceptedAt = nowMs + 5_000;

  const result = getHomepageNearbyWorkers([worker("near", 10.777, 106.701)], accepted, 6, nowMs + 5_000);
  assert.equal(result[0].id, "near");
  assert.ok(result[0].distanceMeters < 30, "UI refresh gets the corrected near distance after the good fix");
}
{
  const previous = { lat: 10.7769, lng: 106.7009, accuracy: 20 };
  const tinyJitter = { lat: 10.77691, lng: 106.70091, accuracy: 20 };
  const realMove = { lat: 10.7777, lng: 106.7009, accuracy: 20 };
  const hugeApproximateJump = { lat: 11.1369, lng: 106.7009, accuracy: 300 };

  assert.equal(shouldPublishGpsLocation({ point: previous, updatedAtMs: nowMs }, tinyJitter, nowMs + 5_000), false, "tiny GPS jitter is ignored");
  assert.equal(shouldPublishGpsLocation({ point: previous, updatedAtMs: nowMs }, realMove, nowMs + 5_000), true, "significant movement is published");
  assert.equal(shouldPublishGpsLocation({ point: previous, updatedAtMs: nowMs }, tinyJitter, nowMs + GPS_FORCE_REFRESH_INTERVAL_MS + 1), true, "GPS is refreshed after max interval");
  assert.equal(shouldAcceptCustomerGpsFix({ point: previous, updatedAtMs: nowMs }, hugeApproximateJump, nowMs + 5_000), false, "large jump with weak accuracy is rejected");
  assert.ok(getDistanceMeters(previous, realMove) >= GPS_MIN_REFRESH_DISTANCE_METERS);
}

{
  const customerComponent = fs.readFileSync("app/components/HomepageNearbyWorkers.tsx", "utf8");
  const workerDashboard = fs.readFileSync("app/worker/page.tsx", "utf8");

  assert.match(customerComponent, /watchPosition/);
  assert.match(customerComponent, /clearWatch\(watchId\)/);
  assert.match(customerComponent, /accuracy: location\.accuracy/);
  assert.match(customerComponent, /shouldAcceptCustomerGpsFix/);
  assert.match(workerDashboard, /watchPosition/);
  assert.match(workerDashboard, /clearWatch\(watchId\)/);
  assert.match(workerDashboard, /window\.addEventListener\("online", handleOnline\)/);
  assert.match(workerDashboard, /window\.removeEventListener\("online", handleOnline\)/);
}

console.log("homepage nearby workers GPS live regression passed");


