import RAPIER from '@dimforge/rapier2d-compat'
import { TRACK } from '../config'
import type { Course } from './courses'
import { catmullRom, resample, type Point } from './geometry'

// Samples searched either side of the last known one when tracking progress
const SEARCH_WINDOW = 20

/**
 * A course's shape: a smooth closed centreline through its points, with bank
 * colliders on both sides of the water. Positions are in physics units. `samples` are
 * evenly spaced along the centreline, so progress can be counted in samples; sample 0
 * is the start/finish line. Drawing it is `createScenery`'s job.
 */
export class Track {
  readonly samples: Point[]
  readonly normals: Point[]
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number }
  readonly course: Course
  private banks: RAPIER.RigidBody

  constructor(world: RAPIER.World, course: Course) {
    this.course = course
    this.samples = resample(catmullRom(course.points.map(([x, y]) => ({ x, y }))), TRACK.sampleSpacing)
    this.normals = this.samples.map((_, i) => {
      const t = this.tangent(i)
      return { x: -t.y, y: t.x }
    })
    const xs = this.samples.map((p) => p.x)
    const ys = this.samples.map((p) => p.y)
    this.bounds = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }

    // Banks: one closed polyline on each side, at the water's edge
    this.banks = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    for (const side of [1, -1]) {
      const edge = this.samples.map((_, i) => this.offset(i, side * (course.width / 2)))
      edge.push(edge[0])
      world.createCollider(
        RAPIER.ColliderDesc.polyline(new Float32Array(edge.flatMap((p) => [p.x, p.y]))).setFriction(0),
        this.banks,
      )
    }
  }

  /** Removes the bank colliders from the world. */
  destroy(world: RAPIER.World) {
    world.removeRigidBody(this.banks)
  }

  get count() {
    return this.samples.length
  }

  /** Index of the sample nearest `p`; with `hint`, only samples near it are searched. */
  nearest(p: Point, hint?: number): number {
    const n = this.count
    const span = hint === undefined ? n : SEARCH_WINDOW * 2 + 1
    const from = hint === undefined ? 0 : hint - SEARCH_WINDOW
    let best = 0
    let bestDist = Infinity
    for (let k = 0; k < span; k++) {
      const i = (((from + k) % n) + n) % n
      const d = (this.samples[i].x - p.x) ** 2 + (this.samples[i].y - p.y) ** 2
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    return best
  }

  /**
   * Starting position for grid `slot`, facing along the course: three abreast,
   * the first row `TRACK.startBehind` units before the line and each row further back.
   */
  startPose(slot = 0) {
    const row = Math.floor(slot / 3)
    const lane = slot % 3 === 0 ? 0 : slot % 3 === 1 ? -1 : 1 // middle first
    const index = this.count - Math.round((TRACK.startBehind + row * TRACK.gridRowGap) / TRACK.sampleSpacing)
    const p = this.offset(index, lane * this.course.width * 0.28)
    return { index, x: p.x, y: p.y, heading: this.headingAt(index) }
  }

  /** Direction of travel at sample `i`, radians. */
  headingAt(i: number) {
    const t = this.tangent(i)
    return Math.atan2(t.y, t.x)
  }

  /** The point `distance` units to the side of sample `i` (positive is to the right). */
  offset(i: number, distance: number): Point {
    return { x: this.samples[i].x + this.normals[i].x * distance, y: this.samples[i].y + this.normals[i].y * distance }
  }

  distanceToCentre(p: Point) {
    return Math.sqrt(Math.min(...this.samples.map((s) => (s.x - p.x) ** 2 + (s.y - p.y) ** 2)))
  }

  private tangent(i: number): Point {
    const n = this.count
    const a = this.samples[(i - 1 + n) % n]
    const b = this.samples[(i + 1) % n]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    return { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
  }
}
