import { createRequire } from "node:module";
import { buildGpx, buildRouteFromLocalPaths } from "../src/route-core.js";
import { textToBaselinePaths, textToStrokePaths } from "../src/text-paths.js";

const require = createRequire(import.meta.url);
const hershey = require("hershey");

const text = "Hello world";
const scale = 8;
const paths = textToBaselinePaths(hershey, text, scale);
const rawPaths = textToStrokePaths(hershey, text, scale);
const fPaths = textToStrokePaths(hershey, "F", scale);

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
  throw new Error("Expected baseline text to be one continuous route over raw strokes");
}

const baselineBounds = bounds(paths.flat());
const rawBounds = bounds(rawPaths.flat());
if (Math.abs(baselineBounds.minY - rawBounds.minY) > 0.1) {
  throw new Error("Expected connector route to share the text baseline");
}

if (fPaths[0][0][1] <= fPaths[0][fPaths[0].length - 1][1]) {
  throw new Error("Expected font top to map north of font bottom");
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
      baselineOffsetM: Number((baselineBounds.minY - rawBounds.minY).toFixed(1)),
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
