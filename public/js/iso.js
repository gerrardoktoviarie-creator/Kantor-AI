// Isometric projection for the office scene.
//
// The whole art layer stays in tile units: `corner(tx, ty)` gives the top-left corner of a
// floor tile, exactly like the old top-down grid, and heights (`z` in art pixels) still lift
// straight up the screen. Only this mapping changes; everything drawn through it — floors,
// walls, furniture, people — becomes isometric for free.
//
//   world (tiles)          screen
//   (tx, ty)  ─────►  sx = (tx - ty) * TW/2      a tile is a TW x TH diamond
//                     sy = (tx + ty) * TH/2
//
// Depth sorting keeps using plain `ty` (plus z): in this projection "further back" and
// larger (tx + ty) are the same thing, so every existing depth formula still orders
// correctly. People stand at a tile's centre, which is the diamond's middle.
export const ISO = { TW: 64, TH: 32 };

/**
 * Build the `corner` mapper for the iso grid. `origin` offsets the whole world in px so the
 * grid starts away from the canvas edge, same as before.
 */
export function isoCorner(origin = { x: 0, y: 0 }) {
  const hw = ISO.TW / 2;
  const hh = ISO.TH / 2;
  return (tx, ty) => ({
    x: origin.x + (tx - ty) * hw,
    y: origin.y + (tx + ty) * hh,
  });
}

/**
 * Axis-aligned tile rect → screen polygon [P NE, P SE, P SW, P NW], the order every wall
 * face helper expects.
 */
export function isoQuad(corner, x0, y0, x1, y1) {
  return [corner(x0, y0), corner(x1, y0), corner(x1, y1), corner(x0, y1)];
}

/**
 * Screen-space bounding box of the iso world, given the tile grid size. Used by the camera
 * to fit and clamp panning.
 */
export function isoWorldBox(grid, origin, margin = 8) {
  const hw = ISO.TW / 2;
  const hh = ISO.TH / 2;
  // x spans (tx - ty): min at (0, grid.h), max at (grid.w, 0).
  const minX = origin.x - grid.h * hw;
  const maxX = origin.x + grid.w * hw;
  const minY = origin.y;
  const maxY = origin.y + (grid.w + grid.h) * hh;
  return {
    left: minX - margin,
    top: minY - margin,
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
  };
}

/**
 * Inverse of corner(): screen px → fractional tile coords (for hit-testing in tile space).
 */
export function isoUnproject(corner, origin, px, py) {
  const dx = px - origin.x;
  const dy = py - origin.y;
  return {
    tx: (dx / (ISO.TW / 2) + dy / (ISO.TH / 2)) / 2,
    ty: (dy / (ISO.TH / 2) - dx / (ISO.TW / 2)) / 2,
  };
}
