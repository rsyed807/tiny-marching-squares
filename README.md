# tiny-marching-squares

Extract contour line segments from a two-dimensional scalar grid, so you can
render isolines without pulling in a plotting framework.

```js
import { contourSegments, contourSegmentsAt } from "tiny-marching-squares";

// Row-major 3x3 grid, one high sample in the middle.
const grid = [
  0, 0, 0,
  0, 1, 0,
  0, 0, 0,
];

const segs = contourSegments(grid, 3, 3, 0.5);
for (const s of segs) {
  console.log(s.ax, s.ay, "->", s.bx, s.by);
}

// Several iso values at once, validated once.
const layers = contourSegmentsAt(grid, 3, 3, [0.25, 0.5, 0.75]);
```

## Why this exists

Marching squares is small enough to reimplement badly and just large enough to
get subtly wrong. The specific problem this package solves is turning a flat
`Float64Array` of samples into line segments with no plotting dependency and no
assumptions about how you will draw them.

The trade-off: the output is a flat list of independent `Segment` objects, not
stitched polylines. Stitching forces a decision about ambiguous saddle cells and
about contours that run off the edge of the grid, and that decision leaks into
the data structure. A flat list is unambiguous, cheap, and lets you chain
segments into polylines only if you actually need them.

## API

- `contourSegments(values, width, height, iso)` returns `Segment[]`.
  `values` is row-major with length `width * height`; widths and heights below 2
  are rejected. The contour is traced at `iso`, and samples equal to `iso` count
  as being on the high side.
- `contourSegmentsAt(values, width, height, isos)` returns one `Segment[]` per
  entry in `isos`, sharing a single grid validation pass.
- `Segment` has `ax`, `ay`, `bx`, `by` endpoints in continuous grid coordinates,
  `cellX`/`cellY` for the cell that produced it, and a `length()` method.

## The edge you will hit

A cell where two diagonally opposite corners are above the iso value and the
other two are below is a saddle, and there is no single correct way to connect
it. This library always splits it into two segments that stay inside their own
triangles, using a fixed rule rather than inspecting the sample magnitudes. That
keeps output deterministic, but it means the contour around a saddle is drawn as
two separate pieces rather than one continuous curve. If you need a different
saddle resolution, post-process the segments yourself.
