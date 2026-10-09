import { Container, Graphics } from 'pixi.js'
import { RIVAL_COLORS } from '../entities/duck'
import type { Point } from '../track/geometry'
import type { Track } from '../track/track'

const SIZE = { width: 150, height: 110 }
const PADDING = 10

/** Screen-space overview of the course with a dot for Boba and any rivals. */
export class Minimap extends Container {
  private rivalDots = new Graphics()
  private dot = new Graphics().circle(0, 0, 4).fill(0xffd23f).stroke({ width: 1.5, color: 0x1a1a1a })
  private scaleFactor: number
  private offset: Point

  constructor(track: Track) {
    super()
    const xs = track.samples.map((p) => p.x)
    const ys = track.samples.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const w = Math.max(...xs) - minX
    const h = Math.max(...ys) - minY
    this.scaleFactor = Math.min((SIZE.width - PADDING * 2) / w, (SIZE.height - PADDING * 2) / h)
    // Centre the course in the box
    this.offset = {
      x: PADDING + (SIZE.width - PADDING * 2 - w * this.scaleFactor) / 2 - minX * this.scaleFactor,
      y: PADDING + (SIZE.height - PADDING * 2 - h * this.scaleFactor) / 2 - minY * this.scaleFactor,
    }

    const start = this.toMap(track.samples[0])
    const map = new Graphics()
      .roundRect(0, 0, SIZE.width, SIZE.height, 8)
      .fill({ color: 0x000000, alpha: 0.35 })
      .poly(track.samples.flatMap((p) => { const m = this.toMap(p); return [m.x, m.y] }), true)
      .stroke({ width: 5, color: 0x6cc0ee, join: 'round' })
      .circle(start.x, start.y, 3)
      .fill(0xffffff)
    this.addChild(map, this.rivalDots, this.dot)
  }

  get boxWidth() {
    return SIZE.width
  }

  /** Moves the dots; positions in physics units, rival colours as palette indexes. */
  update(p: Point, rivals: (Point & { color: number })[] = []) {
    const m = this.toMap(p)
    this.dot.position.set(m.x, m.y)
    this.rivalDots.clear()
    for (const r of rivals) {
      const rm = this.toMap(r)
      this.rivalDots.circle(rm.x, rm.y, 3.5).fill(RIVAL_COLORS[r.color % RIVAL_COLORS.length])
    }
  }

  private toMap(p: Point): Point {
    return { x: this.offset.x + p.x * this.scaleFactor, y: this.offset.y + p.y * this.scaleFactor }
  }
}
