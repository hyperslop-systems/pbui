/*
 * Wire routing (PBUI-WIRING-1 P8): orthogonal paths that go AROUND tiles.
 *
 * The surface is rasterised into cells; every tile rectangle (inflated by a
 * margin) is blocked; Dijkstra runs over (cell, heading) with a cost per
 * step, a penalty per turn (long straight runs, few bends) and a penalty
 * per cell another wire already uses (parallel wires spread into lanes).
 * The result is simplified to its corners. When no path exists (a jack
 * boxed in) the caller falls back to the plain three-segment route.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RouteOptions {
  /** Cell size in px; 6 keeps a 24px gutter four lanes wide. */
  cell?: number;
  /** Extra px around every obstacle. */
  margin?: number;
  /** Cost of a 90° turn, in steps. */
  turn?: number;
  /** Cost of a cell already used by another wire, in steps. */
  occupied?: number;
  /** The surface's own bounds; the router never leaves them. */
  bounds: Rect;
}

export class Lanes {
  private readonly used = new Set<string>();
  mark(key: string): void {
    this.used.add(key);
  }
  has(key: string): boolean {
    return this.used.has(key);
  }
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Route from `from` (leaving in +x) to `to` (arriving in +x) around `obstacles`. */
export function routeAround(from: Point, to: Point, obstacles: readonly Rect[], lanes: Lanes, options: RouteOptions): Point[] | null {
  const cell = options.cell ?? 6;
  const margin = options.margin ?? 3;
  const turnCost = options.turn ?? 10;
  const occupiedCost = options.occupied ?? 8;
  const { bounds } = options;
  const cols = Math.ceil((bounds.right - bounds.left) / cell) + 1;
  const rows = Math.ceil((bounds.bottom - bounds.top) / cell) + 1;
  if (cols <= 0 || rows <= 0 || cols * rows > 400_000) return null;

  const cx = (x: number) => Math.min(cols - 1, Math.max(0, Math.round((x - bounds.left) / cell)));
  const cy = (y: number) => Math.min(rows - 1, Math.max(0, Math.round((y - bounds.top) / cell)));

  // Blocked cells: every obstacle, inflated. The jacks sit ON a tile's frame,
  // so the start and end cells are freed explicitly below.
  const blocked = new Uint8Array(cols * rows);
  for (const r of obstacles) {
    const x0 = cx(r.left - margin);
    const x1 = cx(r.right + margin);
    const y0 = cy(r.top - margin);
    const y1 = cy(r.bottom + margin);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked[y * cols + x] = 1;
  }
  const sx = cx(from.x);
  const sy = cy(from.y);
  const tx = cx(to.x);
  const ty = cy(to.y);
  // Free a short corridor out of the source jack (+x) and into the destination jack (−x).
  for (let i = 0; i <= 3; i++) {
    if (sx + i < cols) blocked[sy * cols + sx + i] = 0;
    if (tx - i >= 0) blocked[ty * cols + tx - i] = 0;
  }

  // Dijkstra over (cell, heading). Headings: 0 +x, 1 −x, 2 +y, 3 −y.
  const N = cols * rows * 4;
  const dist = new Float64Array(N).fill(Number.POSITIVE_INFINITY);
  const prev = new Int32Array(N).fill(-1);
  const startState = (sy * cols + sx) * 4 + 0;
  dist[startState] = 0;
  // A binary heap of states keyed by distance.
  const heap: number[] = [startState];
  const heapDist: number[] = [0];
  const push = (s: number, d: number) => {
    heap.push(s);
    heapDist.push(d);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapDist[p]! <= heapDist[i]!) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      [heapDist[p], heapDist[i]] = [heapDist[i]!, heapDist[p]!];
      i = p;
    }
  };
  const pop = (): [number, number] | null => {
    if (heap.length === 0) return null;
    const top: [number, number] = [heap[0]!, heapDist[0]!];
    const last = heap.pop()!;
    const lastD = heapDist.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      heapDist[0] = lastD;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heapDist[l]! < heapDist[m]!) m = l;
        if (r < heap.length && heapDist[r]! < heapDist[m]!) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        [heapDist[m], heapDist[i]] = [heapDist[i]!, heapDist[m]!];
        i = m;
      }
    }
    return top;
  };

  const goal = ty * cols + tx;
  let found = -1;
  let budget = 600_000;
  for (;;) {
    const next = pop();
    if (!next) break;
    const [state, d] = next;
    if (d > dist[state]!) continue;
    const cellIndex = state >> 2;
    const heading = state & 3;
    if (cellIndex === goal && heading === 0) {
      found = state;
      break;
    }
    if (--budget < 0) break;
    const x = cellIndex % cols;
    const y = (cellIndex - x) / cols;
    for (let h = 0; h < 4; h++) {
      // No reversing.
      if ((heading ^ 1) === h && heading < 2 && h < 2) continue;
      if (heading >= 2 && h >= 2 && heading !== h) continue;
      const nx = x + DIRS[h]![0];
      const ny = y + DIRS[h]![1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nc = ny * cols + nx;
      if (blocked[nc] && nc !== goal) continue;
      let step = 1;
      if (h !== heading) step += turnCost;
      if (lanes.has(`${nx},${ny}`)) step += occupiedCost;
      const ns = nc * 4 + h;
      const nd = d + step;
      if (nd < dist[ns]!) {
        dist[ns] = nd;
        prev[ns] = state;
        push(ns, nd);
      }
    }
  }
  if (found < 0) return null;

  // Walk back, mark lanes, collect cells.
  const cells: Array<[number, number]> = [];
  for (let s = found; s >= 0; s = prev[s]!) {
    const c = s >> 2;
    const x = c % cols;
    const y = (c - x) / cols;
    cells.push([x, y]);
    lanes.mark(`${x},${y}`);
  }
  cells.reverse();

  // Corners only, in px; the ends snap to the exact jack coordinates.
  const points: Point[] = [{ x: from.x, y: from.y }];
  const px = (x: number) => bounds.left + x * cell;
  const py = (y: number) => bounds.top + y * cell;
  for (let i = 1; i < cells.length - 1; i++) {
    const [ax, ay] = cells[i - 1]!;
    const [bx, by] = cells[i]!;
    const [cxx, cyy] = cells[i + 1]!;
    const straight = (bx - ax === cxx - bx) && (by - ay === cyy - by);
    if (!straight) points.push({ x: px(bx), y: py(by) });
  }
  points.push({ x: to.x, y: to.y });
  // Square the corners: every segment must be horizontal or vertical. The
  // first corner takes the source's y, the last takes the destination's y.
  if (points.length >= 3) {
    points[1] = { x: points[1]!.x, y: from.y };
    points[points.length - 2] = { x: points[points.length - 2]!.x, y: to.y };
  }
  return dedupe(points);
}

function dedupe(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    out.push(p);
  }
  return out;
}

export function toPath(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}
