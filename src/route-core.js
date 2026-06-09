export const EARTH_RADIUS_M = 6378137;

export function buildRouteFromLocalPaths(paths, options) {
  const transformed = paths.map((path) => path.map((point) => transformPoint(point, options.rotation)));
  const sampled = samplePaths(transformed, options.spacing, options.connectStrokes);
  const points = sampled.map(([east, north]) => metersToLngLat(east, north, options.center));
  return { points, distance: routeDistance(sampled) };
}

export function transformPoint(point, rotation) {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const [x, y] = point;
  return [x * cos - y * sin, x * sin + y * cos];
}

export function samplePaths(paths, spacing, connectStrokes) {
  const points = [];

  for (const path of paths) {
    if (path.length === 0) continue;

    if (points.length === 0) {
      points.push(path[0]);
    } else if (connectStrokes) {
      appendSegment(points, points[points.length - 1], path[0], spacing);
    } else {
      points.push(path[0]);
    }

    for (let index = 1; index < path.length; index += 1) {
      appendSegment(points, path[index - 1], path[index], spacing);
    }
  }

  return dedupePoints(points);
}

export function appendSegment(points, start, end, spacing) {
  const length = distanceMeters(start, end);
  if (length === 0) return;

  const steps = Math.max(1, Math.ceil(length / spacing));
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    points.push([
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
    ]);
  }
}

export function dedupePoints(points) {
  return points.filter((point, index) => {
    if (index === 0) return true;
    return distanceMeters(points[index - 1], point) > 0.05;
  });
}

export function routeDistance(points) {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    distance += distanceMeters(points[index - 1], points[index]);
  }
  return distance;
}

export function distanceMeters(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function metersToLngLat(east, north, origin) {
  const [originLng, originLat] = origin;
  const lat = originLat + (north / EARTH_RADIUS_M) * (180 / Math.PI);
  const lon =
    originLng +
    (east / (EARTH_RADIUS_M * Math.cos((originLat * Math.PI) / 180))) * (180 / Math.PI);
  return [lon, lat];
}

export function lngLatToMeters(point, origin) {
  const [lng, lat] = point;
  const [originLng, originLat] = origin;
  return {
    east:
      ((lng - originLng) * Math.PI * EARTH_RADIUS_M * Math.cos((originLat * Math.PI) / 180)) /
      180,
    north: ((lat - originLat) * Math.PI * EARTH_RADIUS_M) / 180,
  };
}

export function buildGpx(points, name) {
  const trackPoints = points
    .map(([lon, lat]) => `      <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"></trkpt>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="txt2gpx" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>
`;
}

export function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function slugify(value) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "txt2gpx-course"
  );
}
