const SPACE_ADVANCE_UNITS = 12;

export function textToStrokePaths(hershey, text, scale) {
  const safeText = sanitizeText(text);
  const result = hershey.stringToPaths(safeText || " ");
  return result.paths.map((path) => path.map(([x, y]) => [x * scale, y * scale]));
}

export function textToBaselinePaths(hershey, text, scale) {
  const glyphs = layoutGlyphs(hershey, sanitizeText(text || " "));
  const drawableGlyphs = glyphs.filter((glyph) => !glyph.isSpace);
  if (drawableGlyphs.length === 0) return [];

  const totalWidth = glyphs[glyphs.length - 1].right;
  const xOffset = -totalWidth / 2;
  const bottomY = Math.min(...drawableGlyphs.map((glyph) => glyph.bottom));
  const baselineY = bottomY * scale;
  const left = drawableGlyphs[0].left * scale + xOffset * scale;
  const right = drawableGlyphs[drawableGlyphs.length - 1].right * scale + xOffset * scale;
  const route = [[left, baselineY]];

  for (const glyph of glyphs) {
    if (glyph.isSpace) continue;

    const paths = glyph.paths.map((rawPath) =>
      rawPath.map(([x, y]) => [(x + glyph.x + xOffset) * scale, y * scale]),
    );
    appendRoutedStrokes(route, paths, baselineY);
  }

  const current = route[route.length - 1];
  pushPoint(route, [current[0], baselineY]);
  pushPoint(route, [right, baselineY]);
  return [route];
}

function layoutGlyphs(hershey, text) {
  const glyphs = [];
  const advances = measureAdvances(hershey, text);

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const cursor = advances[index].start;
    const advanceWidth = advances[index].end - advances[index].start;

    if (char === " ") {
      glyphs.push({
        isSpace: true,
        x: cursor,
        left: cursor,
        right: cursor + advanceWidth,
        bottom: -9,
        paths: [],
      });
      continue;
    }

    const glyph = hershey.stringToPaths(char);
    const width = glyph.bounds.maxX - glyph.bounds.minX;
    const paths = glyph.paths.map((path) =>
      path.map(([x, y]) => [x - glyph.bounds.minX, y]),
    );

    glyphs.push({
      isSpace: false,
      x: cursor,
      left: cursor,
      right: cursor + advanceWidth,
      bottom: glyph.bounds.minY,
      paths,
    });
  }

  return glyphs;
}

function measureAdvances(hershey, text) {
  const advances = [];
  let previousWidth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const prefix = text.slice(0, index + 1);
    const prefixBounds = prefix.trim().length === 0 ? null : hershey.stringToPaths(prefix).bounds;
    const width = prefixBounds
      ? prefixBounds.maxX - prefixBounds.minX
      : (index + 1) * SPACE_ADVANCE_UNITS;
    advances.push({ start: previousWidth, end: width });
    previousWidth = width;
  }

  return advances;
}

function appendRoutedStrokes(route, paths, baselineY) {
  const remaining = paths.map((path) => [...path]);

  while (remaining.length > 1) {
    const choice = chooseNextPath(route[route.length - 1], remaining);
    remaining.splice(choice.index, 1);

    const path = choice.reversed ? [...choice.path].reverse() : choice.path;
    appendStroke(route, path, baselineY);
  }

  if (remaining.length === 1) {
    const path = orientForBaselineFinish(remaining[0], baselineY);
    appendStroke(route, path, baselineY);
  }
}

function appendStroke(route, path, baselineY) {
  const start = path[0];

  if (route.length > 0) {
    const current = route[route.length - 1];
    pushPoint(route, [current[0], baselineY]);
    pushPoint(route, [start[0], baselineY]);
  }

  for (const point of path) pushPoint(route, point);
}

function orientForBaselineFinish(path, baselineY) {
  const firstDistance = Math.abs(path[0][1] - baselineY);
  const lastDistance = Math.abs(path[path.length - 1][1] - baselineY);
  return firstDistance < lastDistance ? [...path].reverse() : path;
}

function chooseNextPath(current, paths) {
  if (!current) {
    let bestIndex = 0;
    let bestX = Infinity;
    for (let index = 0; index < paths.length; index += 1) {
      const path = paths[index];
      const x = Math.min(path[0][0], path[path.length - 1][0]);
      if (x < bestX) {
        bestX = x;
        bestIndex = index;
      }
    }
    const path = paths[bestIndex];
    return { index: bestIndex, path, reversed: path[path.length - 1][0] < path[0][0] };
  }

  let best = { index: 0, path: paths[0], reversed: false, distance: Infinity };
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    const startDistance = distance(current, path[0]);
    const endDistance = distance(current, path[path.length - 1]);
    if (startDistance < best.distance) {
      best = { index, path, reversed: false, distance: startDistance };
    }
    if (endDistance < best.distance) {
      best = { index, path, reversed: true, distance: endDistance };
    }
  }

  return best;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function pushPoint(points, point) {
  const previous = points[points.length - 1];
  if (previous && Math.hypot(previous[0] - point[0], previous[1] - point[1]) < 0.05) return;
  points.push(point);
}

function sanitizeText(text) {
  return [...text]
    .map((char) => (char === " " || isSupportedChar(char) ? char : "?"))
    .join("");
}

function isSupportedChar(char) {
  return /^[a-zA-Z.,:;!?"°$\/()|\-+='#&\\_*[\]{}<>~%@]$/.test(char);
}
