const LETTER_GAP_UNITS = 8;
const SPACE_ADVANCE_UNITS = 18;
const UNDERLINE_OFFSET_UNITS = 4;

export function textToStrokePaths(hershey, text, scale) {
  const safeText = sanitizeText(text);
  const result = hershey.stringToPaths(safeText || " ");
  return result.paths.map((path) => path.map(([x, y]) => [x * scale, -y * scale]));
}

export function textToUnderlinedPaths(hershey, text, scale) {
  const glyphs = layoutGlyphs(hershey, sanitizeText(text || " "));
  const drawableGlyphs = glyphs.filter((glyph) => !glyph.isSpace);
  if (drawableGlyphs.length === 0) return [];

  const totalWidth = glyphs[glyphs.length - 1].right;
  const xOffset = -totalWidth / 2;
  const bottomY = Math.max(...drawableGlyphs.map((glyph) => glyph.bottom));
  const underlineY = (bottomY + UNDERLINE_OFFSET_UNITS) * scale;
  const left = drawableGlyphs[0].left * scale + xOffset * scale;
  const right = drawableGlyphs[drawableGlyphs.length - 1].right * scale + xOffset * scale;
  const route = [[left, underlineY]];

  for (const glyph of glyphs) {
    if (glyph.isSpace) continue;

    for (const rawPath of glyph.paths) {
      const path = rawPath.map(([x, y]) => [(x + glyph.x + xOffset) * scale, -y * scale]);
      const oriented = orientFromUnderline(path, underlineY);
      const start = oriented[0];
      const end = oriented[oriented.length - 1];

      pushPoint(route, [start[0], underlineY]);
      for (const point of oriented) pushPoint(route, point);
      pushPoint(route, [end[0], underlineY]);
    }
  }

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

function orientFromUnderline(path, underlineY) {
  const first = path[0];
  const last = path[path.length - 1];
  const firstDistance = Math.abs(first[1] - underlineY);
  const lastDistance = Math.abs(last[1] - underlineY);
  return lastDistance < firstDistance ? [...path].reverse() : path;
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
