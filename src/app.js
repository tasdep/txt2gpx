import hershey from "https://esm.sh/hershey@2.1.7";
import {
  buildGpx,
  buildRouteFromLocalPaths,
  lngLatToMeters,
  metersToLngLat,
  slugify,
} from "./route-core.js";
import { textToStrokePaths, textToUnderlinedPaths } from "./text-paths.js";

const INITIAL_CENTER = [8.5417, 47.3769];

const state = {
  text: "HBD",
  name: "txt2gpx course",
  center: INITIAL_CENTER,
  scale: 8,
  rotation: 0,
  spacing: 8,
  connectStrokes: true,
  underlineGap: 95,
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
  underlineGap: document.querySelector("#underlineGapInput"),
  underlineGapValue: document.querySelector("#underlineGapValue"),
  underlineGapRow: document.querySelector("#underlineGapRow"),
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

  els.underlineGap.addEventListener("input", () => {
    state.underlineGap = Number(els.underlineGap.value);
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
  els.underlineGapValue.value = `${state.underlineGap} m`;
  els.underlineGapRow.hidden = !state.connectStrokes;
  els.distanceReadout.textContent = `${(route.distance / 1000).toFixed(2)} km`;

  setSource("route", lineFeature(route.points));
  setSource("hitbox", lineFeature(route.points));
  setSource("anchor", pointFeature(state.center));
}

function buildRoute() {
  const strokePaths = state.connectStrokes
    ? textToUnderlinedPaths(hershey, state.text || " ", state.scale, {
        underlineGap: state.underlineGap,
      })
    : textToStrokePaths(hershey, state.text || " ", state.scale);
  return buildRouteFromLocalPaths(strokePaths, {
    center: state.center,
    rotation: state.rotation,
    spacing: state.spacing,
    connectStrokes: true,
  });
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
