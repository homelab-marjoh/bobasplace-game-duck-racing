import { Graphics } from 'pixi.js'
import { SCALE, WAKE } from '../config'
import type { Point } from '../track/geometry'

interface Ripple {
  x: number
  y: number
  age: number
}

/** Expanding, fading rings left behind your duck on the water. */
export class Wake extends Graphics {
  private ripples: Ripple[] = []
  private travelled = 0

  /** `tail` is where new ripples start (physics units), `speed` your duck's speed in units/s. */
  update(dt: number, tail: Point, speed: number) {
    if (speed > WAKE.minSpeed) {
      this.travelled += speed * dt
      if (this.travelled >= WAKE.spacing) {
        this.travelled = 0
        this.ripples.push({ x: tail.x, y: tail.y, age: 0 })
      }
    }
    for (const r of this.ripples) r.age += dt
    this.ripples = this.ripples.filter((r) => r.age < WAKE.life)

    this.clear()
    for (const r of this.ripples) {
      const radius = (WAKE.startRadius + r.age * WAKE.growth) * SCALE
      this.circle(r.x * SCALE, r.y * SCALE, radius).stroke({
        width: 2,
        color: 0xffffff,
        alpha: WAKE.alpha * (1 - r.age / WAKE.life),
      })
    }
  }

  reset() {
    this.ripples = []
    this.travelled = 0
    this.clear()
  }
}
