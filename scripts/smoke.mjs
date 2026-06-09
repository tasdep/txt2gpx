import { createRequire } from "node:module";
import { buildGpx, buildRouteFromLocalPaths } from "../src/route-core.js";
import { textToStrokePaths, textToUnderlinedPaths } from "../src/text-paths.js";

const require = createRequire(import.meta.url);
const hershey = require("hershey");

const text = "Hello world";
const scale = 8;
const paths = textToUnderlinedPaths(hershey, text, scale);
const rawPaths = textToStrokePaths(hershey, text, scale);

const route = buildRouteFromLocalPaths(paths, {
  center: [8.5417, 47.3769],
  rotation: 12,
  spacing: 8,
  connectStrokes: true,
});
const gpx = buildGpx(route.points, "smoke test");

if (route.points.length < 10) {
  throw new Error(`Expected more route points, got ${route.points.length}`);
}

if (paths.length !== 1 || rawPaths.length <= paths.length) {
  throw new Error("Expected underlined text to be one continuous route over raw strokes");
}

if (!gpx.includes("<trkseg>") || !gpx.includes("<trkpt ")) {
  throw new Error("Generated GPX is missing track data");
}

console.log(
  JSON.stringify(
    {
      text,
      points: route.points.length,
      rawStrokeCount: rawPaths.length,
      distanceKm: Number((route.distance / 1000).toFixed(3)),
      firstPoint: route.points[0],
      lastPoint: route.points[route.points.length - 1],
    },
    null,
    2,
  ),
);
