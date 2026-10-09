import type { Point } from '../track/geometry'
import type { Track } from '../track/track'

/**
 * Race clock and laps. Progress is counted in track samples travelled past the
 * start/finish line (signed, so going backwards takes it away again); each lap is
 * `track.count` samples, so crossing the line back and forth can't count twice.
 */
export class LapCounter {
  /** Seconds since the start, advanced by physics steps so it's exact. */
  time = 0
  /** Each finished lap's time, seconds. */
  laps: number[] = []

  private progress = 0
  private sampleIndex = 0
  private track: Track

  constructor(track: Track) {
    this.track = track
  }

  /** The lap being raced, 1-based (stays at the last lap once finished). */
  get lap() {
    return Math.min(this.laps.length + 1, this.track.course.laps)
  }

  /** Laps done so far, as a fraction (can be slightly negative before the line). */
  get distance() {
    return this.progress / this.track.count
  }

  get finished() {
    return this.laps.length >= this.track.course.laps
  }

  /** Starts over with Boba at sample `startIndex`, just behind the line. */
  reset(startIndex: number) {
    this.time = 0
    this.laps = []
    this.sampleIndex = startIndex
    this.progress = startIndex - this.track.count
  }

  /** Advances the clock by one physics step with Boba at `position` (physics units). */
  step(dt: number, position: Point) {
    this.time += dt
    const n = this.track.count
    const index = this.track.nearest(position, this.sampleIndex)
    let delta = index - this.sampleIndex
    // Wrapped past sample 0, either way
    if (delta > n / 2) delta -= n
    if (delta < -n / 2) delta += n
    this.progress += delta
    this.sampleIndex = index

    if (this.progress >= (this.laps.length + 1) * n) {
      const previous = this.laps.reduce((sum, t) => sum + t, 0)
      this.laps.push(this.time - previous)
    }
  }
}
