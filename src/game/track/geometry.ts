export interface Point {
  x: number
  y: number
}

// How many curve points each control-point span is split into before resampling
const SUBDIVISIONS = 24

/** Closed Catmull-Rom spline through `points`. */
export function catmullRom(points: Point[]): Point[] {
  const n = points.length
  const out: Point[] = []
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    for (let s = 0; s < SUBDIVISIONS; s++) {
      const t = s / SUBDIVISIONS
      const t2 = t * t
      const t3 = t2 * t
      const blend = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3)
      out.push({ x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  return out
}

/** Points evenly spaced by arc length (about `spacing` apart) along a closed polyline. */
export function resample(points: Point[], spacing: number): Point[] {
  const closed = [...points, points[0]]
  const lengths = [0]
  for (let i = 1; i < closed.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(closed[i].x - closed[i - 1].x, closed[i].y - closed[i - 1].y))
  }
  const total = lengths[lengths.length - 1]
  const count = Math.round(total / spacing)
  const out: Point[] = []
  let seg = 0
  for (let k = 0; k < count; k++) {
    const d = (k / count) * total
    while (lengths[seg + 1] < d) seg++
    const t = (d - lengths[seg]) / (lengths[seg + 1] - lengths[seg])
    out.push({
      x: closed[seg].x + (closed[seg + 1].x - closed[seg].x) * t,
      y: closed[seg].y + (closed[seg + 1].y - closed[seg].y) * t,
    })
  }
  return out
}

/** Small seeded PRNG, so the scenery is the same every time. */
export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
