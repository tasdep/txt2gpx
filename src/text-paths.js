const LETTER_GAP_UNITS = 8;
const SPACE_ADVANCE_UNITS = 18;
const DEFAULT_UNDERLINE_GAP_M = 95;

export function textToStrokePaths(hershey, text, scale) {
  const safeText = sanitizeText(text);
  const result = hershey.stringToPaths(safeText || " ");
  return result.paths.map((path) => path.map(([x, y]) => [x * scale, -y * scale]));
}

export function textToUnderlinedPaths(hershey, text, scale, options = {}) {
  const glyphs = layoutGlyphs(hershey, sanitizeText(text || " "));
  const drawableGlyphs = glyphs.filter((glyph) => !glyph.isSpace);
  if (drawableGlyphs.length === 0) return [];

  const totalWidth = glyphs[glyphs.length - 1].right;
  const xOffset = -totalWidth / 2;
  const bottomY = Math.max(...drawableGlyphs.map((glyph) => glyph.bottom));
  const underlineGap =
    options.underlineGap === undefined ? DEFAULT_UNDERLINE_GAP_M : options.underlineGap;
  const baselineY = bottomY * scale;
  const underlineY = bottomY * scale + underlineGap;
  const left = drawableGlyphs[0].left * scale + xOffset * scale;
  const right = drawableGlyphs[drawableGlyphs.length - 1].right * scale + xOffset * scale;
  const route = [];

  for (const glyph of glyphs) {
    if (glyph.isSpace) continue;

    const paths = glyph.paths.map((rawPath) =>
      rawPath.map(([x, y]) => [(x + glyph.x + xOffset) * scale, -y * scale]),
    );
    appendRoutedStrokes(route, paths, baselineY);
  }

  const current = route[route.length - 1];
  pushPoint(route, [current[0], baselineY]);
  pushPoint(route, [current[0], underlineY]);
  pushPoint(route, [left, underlineY]);
  pushPoint(route, [right, underlineY]);
  return [route];
}

function layoutGlyphs(hershey, text) {
  const glyphs = [];
  let cursor = 0;

  for (const char of text) {
    if (char === " ") {
      glyphs.push({
        isSpace: true,
        x: cursor,
        left: cursor,
        right: cursor + SPACE_ADVANCE_UNITS,
        bottom: 9,
        paths: [],
      });
      cursor += SPACE_ADVANCE_UNITS;
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
      right: cursor + width,
      bottom: -glyph.bounds.minY,
      paths,
    });
    cursor += width + LETTER_GAP_UNITS;
  }

  return glyphs;
}

function appendRoutedStrokes(route, paths, baselineY) {
  const remaining = paths.map((path) => [...path]);

  while (remaining.length > 0) {
    const choice = chooseNextPath(route[route.length - 1], remaining);
    remaining.splice(choice.index, 1);

    const path = choice.reversed ? [...choice.path].reverse() : choice.path;
    const start = path[0];

    if (route.length > 0) {
      const current = route[route.length - 1];
      pushPoint(route, [current[0], baselineY]);
      pushPoint(route, [start[0], baselineY]);
    }

    for (const point of path) pushPoint(route, point);
  }
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
