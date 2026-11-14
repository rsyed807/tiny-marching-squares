// Marching Squares: extract contour line segments from a 2-D scalar grid.
//
// The grid is a rectangular array of samples arranged in row-major order:
// index (x, y) lives at y * width + x. A contour is requested at a single
// iso value; the output is a flat list of axis-aligned-ish line segments in
// grid coordinates.
//
// Design decision: we emit raw independent segments rather than stitched
// polylines. Stitching requires resolving ambiguous saddle cells and deciding
// what to do about open contours that leave the grid, and those choices leak
// into the data structure. A flat segment list is unambiguous, cheap to
// render, and can be chained by the caller when it actually needs polylines.

/**
 * A single contour segment.
 *
 * `a` and `b` are endpoints in continuous grid coordinates: integer values
 * land exactly on sample positions, fractional values lie on cell edges.
 * `cell` records the (x, y) index of the lower-left sample of the cell that
 * produced the segment, which is useful for debugging and for callers that
 * want to colour by cell.
 */
export class Segment {
  constructor(ax, ay, bx, by, cellX, cellY) {
    this.ax = ax;
    this.ay = ay;
    this.bx = bx;
    this.by = by;
    this.cellX = cellX;
    this.cellY = cellY;
  }

  /** Length of the segment. Always finite for finite input. */
  length() {
    const dx = this.bx - this.ax;
    const dy = this.by - this.ay;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// Linear interpolation factor of `iso` between two corner values.
// Returns 0.5 when the two values are equal, which is the only sensible
// answer: the iso value is exactly on the edge and any split is arbitrary.
// Callers rely on this to keep output deterministic.
function lerpFactor(va, vb, iso) {
  const denom = vb - va;
  if (denom === 0) return 0.5;
  const t = (iso - va) / denom;
  // Guard against rounding pushing t outside [0, 1] by a hair.
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

// Validate the grid once so the sampling loop can stay branch-free.
function checkGrid(values, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError("width and height must be integers");
  }
  if (width < 2 || height < 2) {
    throw new RangeError("width and height must each be at least 2");
  }
  const expected = width * height;
  if (values.length !== expected) {
    throw new RangeError(
      `values length ${values.length} does not match width*height ${expected}`
    );
  }
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      throw new RangeError(`values[${i}] is not a finite number`);
    }
  }
}

/**
 * Extract contour segments for `iso` from a scalar grid.
 *
 * @param {ArrayLike<number>} values row-major samples, length width*height
 * @param {number} width  number of samples per row (>= 2)
 * @param {number} height number of sample rows (>= 2)
 * @param {number} iso    iso value to trace
 * @returns {Segment[]}
 */
export function contourSegments(values, width, height, iso) {
  if (!Number.isFinite(iso)) {
    throw new RangeError("iso must be a finite number");
  }
  checkGrid(values, width, height);

  const out = [];
  const at = (x, y) => values[y * width + x];

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const v0 = at(x, y);         // bottom-left
      const v1 = at(x + 1, y);     // bottom-right
      const v2 = at(x + 1, y + 1); // top-right
      const v3 = at(x, y + 1);     // top-left

      // Corner classification: 1 means the sample is at or above the iso
      // value. Using >= makes the contour pass exactly through samples equal
      // to `iso`, which is the convention most plotting code expects.
      let mask = 0;
      if (v0 >= iso) mask |= 1;
      if (v1 >= iso) mask |= 2;
      if (v2 >= iso) mask |= 4;
      if (v3 >= iso) mask |= 8;

      if (mask === 0 || mask === 15) continue;

      // Edge midpoints, named by the two corners they connect.
      const bottom = [x + lerpFactor(v0, v1, iso), y];
      const right = [x + 1, y + lerpFactor(v1, v2, iso)];
      const top = [x + lerpFactor(v3, v2, iso), y + 1];
      const left = [x, y + lerpFactor(v0, v3, iso)];

      switch (mask) {
        case 1:
        case 14:
          push(out, left, bottom, x, y);
          break;
        case 2:
        case 13:
          push(out, bottom, right, x, y);
          break;
        case 3:
        case 12:
          push(out, left, right, x, y);
          break;
        case 4:
        case 11:
          push(out, right, top, x, y);
          break;
        case 5:
          // Ambiguous saddle: bottom-left and top-right are on the same side.
          // We resolve by connecting each corner to its nearer neighbours,
          // which keeps the two segments from crossing. This is a fixed rule,
          // not a data-dependent one, so output stays deterministic.
          push(out, left, bottom, x, y);
          push(out, right, top, x, y);
          break;
        case 6:
        case 9:
          push(out, bottom, top, x, y);
          break;
        case 7:
        case 8:
          push(out, left, top, x, y);
          break;
        case 10:
          // The other ambiguous saddle: bottom-right and top-left match.
          push(out, left, top, x, y);
          push(out, bottom, right, x, y);
          break;
        default:
          // Unreachable: mask is in [1, 14] here.
          break;
      }
    }
  }

  return out;
}

function push(out, p, q, cx, cy) {
  out.push(new Segment(p[0], p[1], q[0], q[1], cx, cy));
}

/**
 * Convenience wrapper for callers that want several iso values at once.
 * Returns an array parallel to `isos`, each entry the segments for that value.
 * The grid is validated once per call rather than once per iso value.
 */
export function contourSegmentsAt(values, width, height, isos) {
  if (!Array.isArray(isos) && !(isos instanceof Float64Array)) {
    throw new TypeError("isos must be an array of numbers");
  }
  const result = [];
  for (const iso of isos) {
    result.push(contourSegments(values, width, height, iso));
  }
  return result;
}
