import hershey from "https://esm.sh/hershey@2.1.7";

const EARTH_RADIUS_M = 6378137;
const INITIAL_CENTER = [8.5417, 47.3769];

const state = {
  text: "HBD",
  name: "txt2gpx course",
  center: INITIAL_CENTER,
  scale: 8,
  rotation: 0,
  spacing: 8,
  connectStrokes: true,
};

const els = {
  text: document.querySelector("#textInput"),
  name: document.querySelector("#nameInput"),
  scale: document.querySelector("#scaleInput"),
  scaleValue: document.querySelector("#scaleValue"),
  rotation: document.querySelector("#rotationInput"),
  rotationValue: document.querySelector("#rotationValue"),
  spacing: document.querySelector("#spacingInput"),
  spacingValue: document.querySelector("#spacingValue"),
  connect: document.querySelector("#connectInput"),
  centerButton: document.querySelector("#centerButton"),
  downloadButton: document.querySelector("#downloadButton"),
  distanceReadout: document.querySelector("#distanceReadout"),
};

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: state.center,
  zoom: 15,
  pitch: 0,
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

map.on("load", () => {
  map.addSource("route", emptyGeoJson("LineString"));
  map.addSource("hitbox", emptyGeoJson("LineString"));
  map.addSource("anchor", emptyGeoJson("Point"));

  map.addLayer({
    id: "route-line",
    type: "line",
    source: "route",
    paint: {
      "line-color": "#1673ff",
      "line-width": 5,
      "line-opacity": 0.92,
    },
  });

  map.addLayer({
    id: "route-hitbox",
    type: "line",
    source: "hitbox",
    paint: {
      "line-color": "#1673ff",
      "line-width": 28,
      "line-opacity": 0,
    },
  });

  map.addLayer({
    id: "anchor-dot",
    type: "circle",
    source: "anchor",
    paint: {
      "circle-radius": 6,
      "circle-color": "#f25d50",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });

  bindEvents();
  render();
});

function bindEvents() {
  els.text.addEventListener("input", () => {
    state.text = els.text.value;
    render();
  });

  els.name.addEventListener("input", () => {
    state.name = els.name.value;
  });

  els.scale.addEventListener("input", () => {
    state.scale = Number(els.scale.value);
    render();
  });

  els.rotation.addEventListener("input", () => {
    state.rotation = Number(els.rotation.value);
    render();
  });

  els.spacing.addEventListener("input", () => {
    state.spacing = Number(els.spacing.value);
    render();
  });

  els.connect.addEventListener("change", () => {
    state.connectStrokes = els.connect.checked;
    render();
  });

  els.centerButton.addEventListener("click", () => {
    const center = map.getCenter();
    state.center = [center.lng, center.lat];
    render();
  });

  els.downloadButton.addEventListener("click", () => {
    const route = buildRoute();
    downloadGpx(route.points, state.name || state.text || "txt2gpx course");
  });

  map.on("click", (event) => {
    state.center = [event.lngLat.lng, event.lngLat.lat];
    render();
  });

  let dragStart = null;

  map.on("mousedown", "route-hitbox", (event) => {
    event.preventDefault();
    map.dragPan.disable();
    map.getCanvas().style.cursor = "grabbing";
    dragStart = {
      pointer: event.lngLat,
      center: state.center,
    };
  });

  map.on("mousemove", (event) => {
    if (!dragStart) return;

    const delta = lngLatToMeters(
      [event.lngLat.lng, event.lngLat.lat],
      [dragStart.pointer.lng, dragStart.pointer.lat],
    );
    state.center = metersToLngLat(delta.east, delta.north, dragStart.center);
    render();
  });

  map.on("mouseup", stopDragging);
  map.on("mouseleave", stopDragging);

  function stopDragging() {
    if (!dragStart) return;
    dragStart = null;
    map.dragPan.enable();
    map.getCanvas().style.cursor = "";
  }
}

function render() {
  const route = buildRoute();
  els.scaleValue.value = `${state.scale} m/unit`;
  els.rotationValue.value = `${state.rotation} deg`;
  els.spacingValue.value = `${state.spacing} m`;
  els.distanceReadout.textContent = `${(route.distance / 1000).toFixed(2)} km`;

  setSource("route", lineFeature(route.points));
  setSource("hitbox", lineFeature(route.points));
  setSource("anchor", pointFeature(state.center));
}

function buildRoute() {
  const strokePaths = textToLocalPaths(state.text || " ");
  const transformed = strokePaths.map((path) => path.map(transformPoint));
  const sampled = samplePaths(transformed, state.spacing, state.connectStrokes);
  const points = sampled.map(([east, north]) => metersToLngLat(east, north, state.center));
  return { points, distance: routeDistance(sampled) };
}

function textToLocalPaths(text) {
  const safeText = [...text]
    .map((char) => (char === " " || isSupportedChar(char) ? char : "?"))
    .join("");
  const result = hershey.stringToPaths(safeText);
  return result.paths.map((path) => path.map(([x, y]) => [x * state.scale, -y * state.scale]));
}

function isSupportedChar(char) {
  return /^[a-zA-Z.,:;!?"°$\/()|\-+='#&\\_*[\]{}<>~%@]$/.test(char);
}

function transformPoint(point) {
  const radians = (state.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const [x, y] = point;
  return [x * cos - y * sin, x * sin + y * cos];
}

function samplePaths(paths, spacing, connectStrokes) {
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

function appendSegment(points, start, end, spacing) {
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

function dedupePoints(points) {
  return points.filter((point, index) => {
    if (index === 0) return true;
    return distanceMeters(points[index - 1], point) > 0.05;
  });
}

function routeDistance(points) {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    distance += distanceMeters(points[index - 1], points[index]);
  }
  return distance;
}

function distanceMeters(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function metersToLngLat(east, north, origin) {
  const [originLng, originLat] = origin;
  const lat = originLat + (north / EARTH_RADIUS_M) * (180 / Math.PI);
  const lon =
    originLng +
    (east / (EARTH_RADIUS_M * Math.cos((originLat * Math.PI) / 180))) * (180 / Math.PI);
  return [lon, lat];
}

function lngLatToMeters(point, origin) {
  const [lng, lat] = point;
  const [originLng, originLat] = origin;
  return {
    east:
      ((lng - originLng) * Math.PI * EARTH_RADIUS_M * Math.cos((originLat * Math.PI) / 180)) /
      180,
    north: ((lat - originLat) * Math.PI * EARTH_RADIUS_M) / 180,
  };
}

function downloadGpx(points, name) {
  const gpx = buildGpx(points, name);
  const blob = new Blob([gpx], { type: "application/gpx+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(name)}.gpx`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildGpx(points, name) {
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

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "txt2gpx-course"
  );
}

function setSource(id, data) {
  const source = map.getSource(id);
  if (source) source.setData(data);
}

function lineFeature(coordinates) {
  return {
    type: "FeatureCollection",
    features:
      coordinates.length > 1
        ? [{ type: "Feature", geometry: { type: "LineString", coordinates }, properties: {} }]
        : [],
  };
}

function pointFeature(coordinates) {
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: { type: "Point", coordinates }, properties: {} }],
  };
}

function emptyGeoJson(type) {
  return {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features:
        type === "Point"
          ? [{ type: "Feature", geometry: { type: "Point", coordinates: state.center } }]
          : [],
    },
  };
}
