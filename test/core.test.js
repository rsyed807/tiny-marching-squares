import test from "node:test";
import assert from "node:assert/strict";

import {
  Segment,
  contourSegments,
  contourSegmentsAt,
} from "../src/index.js";

// A 3x3 grid with a single high sample in the middle. Contouring at 0.5
// should produce a closed diamond around the centre sample.
function bumpGrid() {
  return [
    0, 0, 0,
    0, 1, 0,
    0, 0, 0,
  ];
}

function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

test("exports the documented names", () => {
  assert.equal(typeof contourSegments, "function");
  assert.equal(typeof contourSegmentsAt, "function");
  assert.equal(typeof Segment, "function");
});

test("a flat grid above the iso yields no segments", () => {
  const grid = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  assert.deepEqual(contourSegments(grid, 3, 3, 0.5), []);
});

test("a flat grid below the iso yields no segments", () => {
  const grid = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.deepEqual(contourSegments(grid, 3, 3, 0.5), []);
});

test("a grid entirely equal to the iso yields no segments", () => {
  // Every corner is >= iso, so every cell is mask 15 and is skipped.
  const grid = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  assert.deepEqual(contourSegments(grid, 3, 3, 0.5), []);
});

test("a single bump produces a closed four-segment diamond", () => {
  const segs = contourSegments(bumpGrid(), 3, 3, 0.5);
  assert.equal(segs.length, 4);
  for (const s of segs) {
    assert.ok(s instanceof Segment);
    // Each segment is a half-diagonal of a unit cell.
    assert.ok(approx(s.length(), Math.SQRT1_2));
  }
});

test("the diamond is centred on the high sample", () => {
  const segs = contourSegments(bumpGrid(), 3, 3, 0.5);
  let sx = 0;
  let sy = 0;
  for (const s of segs) {
    sx += s.ax + s.bx;
    sy += s.ay + s.by;
  }
  // Eight endpoints total, averaging to the grid centre (1, 1).
  assert.ok(approx(sx / 8, 1));
  assert.ok(approx(sy / 8, 1));
});

test("segments record the cell that produced them", () => {
  const segs = contourSegments(bumpGrid(), 3, 3, 0.5);
  const cells = new Set(segs.map((s) => `${s.cellX},${s.cellY}`));
  assert.deepEqual(
    [...cells].sort(),
    ["0,0", "0,1", "1,0", "1,1"]
  );
});

test("interpolation places endpoints proportionally", () => {
  // A 2x2 grid: left column 0, right column 1. Iso at 0.25 means the
  // contour crosses each horizontal edge a quarter of the way across.
  const grid = [0, 1, 0, 1];
  const segs = contourSegments(grid, 2, 2, 0.25);
  assert.equal(segs.length, 1);
  const s = segs[0];
  assert.ok(approx(s.ax, 0.25));
  assert.ok(approx(s.ay, 0));
  assert.ok(approx(s.bx, 0.25));
  assert.ok(approx(s.by, 1));
});

test("a saddle is resolved into two non-crossing segments", () => {
  // Bottom-left and top-right high: mask 5, the first ambiguous case.
  const grid = [
    1, 0,
    0, 1,
  ];
  const segs = contourSegments(grid, 2, 2, 0.5);
  assert.equal(segs.length, 2);
  // The two segments must not intersect: each stays in its own triangle.
  // Segment endpoints are all at edge midpoints here.
  const midpoints = segs.flatMap((s) => [
    [s.ax, s.ay],
    [s.bx, s.by],
  ]);
  for (const [px, py] of midpoints) {
    assert.ok(approx(px, 0.5) || approx(py, 0.5));
  }
});

test("the opposite saddle is also split into two segments", () => {
  // Bottom-right and top-left high: mask 10.
  const grid = [
    0, 1,
    1, 0,
  ];
  const segs = contourSegments(grid, 2, 2, 0.5);
  assert.equal(segs.length, 2);
});

test("contourSegmentsAt returns one entry per iso value", () => {
  const grid = bumpGrid();
  const result = contourSegmentsAt(grid, 3, 3, [0.25, 0.5, 0.75]);
  assert.equal(result.length, 3);
  // 0.25 and 0.75 both sit inside the bump's range, so both produce
  // contours; 0.5 is the one we already checked.
  assert.equal(result[0].length, 4);
  assert.equal(result[1].length, 4);
  assert.equal(result[2].length, 4);
});

test("rejects a grid whose length does not match its dimensions", () => {
  assert.throws(
    () => contourSegments([0, 0, 0, 0], 3, 3, 0.5),
    RangeError
  );
});

test("rejects dimensions smaller than 2", () => {
  assert.throws(() => contourSegments([0, 0], 1, 2, 0.5), RangeError);
  assert.throws(() => contourSegments([0, 0], 2, 1, 0.5), RangeError);
});

test("rejects non-finite samples", () => {
  assert.throws(
    () => contourSegments([0, 0, 0, NaN], 2, 2, 0.5),
    RangeError
  );
});

test("rejects a non-finite iso value", () => {
  assert.throws(() => contourSegments(bumpGrid(), 3, 3, NaN), RangeError);
});

test("accepts a typed array as the grid", () => {
  const grid = Float64Array.from(bumpGrid());
  const segs = contourSegments(grid, 3, 3, 0.5);
  assert.equal(segs.length, 4);
});

test("a segment built by hand reports its own length", () => {
  const s = new Segment(0, 0, 3, 4, 0, 0);
  assert.equal(s.length(), 5);
});
