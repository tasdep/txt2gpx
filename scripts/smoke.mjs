import { createRequire } from "node:module";
import { buildGpx, buildRouteFromLocalPaths } from "../src/route-core.js";
import { textToStrokePaths, textToUnderlinedPaths } from "../src/text-paths.js";

const require = createRequire(import.meta.url);
const hershey = require("hershey");

const text = "Hello world";
const scale = 8;
const paths = textToUnderlinedPaths(hershey, text, scale, { underlineGap: 95 });
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

const underlinedBounds = bounds(paths.flat());
const rawBounds = bounds(rawPaths.flat());
if (underlinedBounds.maxY - rawBounds.maxY < 90) {
  throw new Error("Expected underline route to sit clearly below the raw text");
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
      underlineDropM: Number((underlinedBounds.maxY - rawBounds.maxY).toFixed(1)),
      distanceKm: Number((route.distance / 1000).toFixed(3)),
      firstPoint: route.points[0],
      lastPoint: route.points[route.points.length - 1],
    },
    null,
    2,
  ),
);

function bounds(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}
