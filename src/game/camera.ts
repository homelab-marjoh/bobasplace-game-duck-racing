import type { Container } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { CAMERA, SCALE } from './config'
import type { Point } from './track/geometry'

const SHAKE_DECAY = 3 // per second
const SHAKE_PIXELS = 16

/** Follows Boba with a little lookahead, zooms to the screen size, and shakes on impacts. */
export class Camera {
  private x = 0
  private y = 0
  private shakeAmount = 0
  private viewport: Viewport
  private stage: Container

  /** `stage` is what shakes: the viewport's own position is its pan. */
  constructor(viewport: Viewport, stage: Container) {
    this.viewport = viewport
    this.stage = stage
  }

  resize(width: number, height: number) {
    this.viewport.resize(width, height)
    this.viewport.setZoom(Math.min(width, height) / (CAMERA.viewSize * SCALE), true)
  }

  /** Jumps straight to `target` (physics units). */
  snapTo(target: Point) {
    this.x = target.x * SCALE
    this.y = target.y * SCALE
    this.viewport.moveCenter(this.x, this.y)
  }

  /** Kicks off a shake of `amount` (0..1); a bigger one already running wins. */
  shake(amount: number) {
    this.shakeAmount = Math.max(this.shakeAmount, amount)
  }

  /** Eases toward a point ahead of `target` moving at `velocity` (both physics units). */
  update(dt: number, target: Point, velocity: Point) {
    const ease = 1 - Math.exp(-CAMERA.smoothing * dt)
    this.x += ((target.x + velocity.x * CAMERA.lookahead) * SCALE - this.x) * ease
    this.y += ((target.y + velocity.y * CAMERA.lookahead) * SCALE - this.y) * ease
    this.viewport.moveCenter(this.x, this.y)

    this.shakeAmount = Math.max(0, this.shakeAmount - dt * SHAKE_DECAY)
    const s = this.shakeAmount * SHAKE_PIXELS
    this.stage.position.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s)
  }
}
