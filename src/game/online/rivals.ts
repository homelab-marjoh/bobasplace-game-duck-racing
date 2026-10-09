import { Container, Text } from 'pixi.js'
import { SCALE } from '../config'
import { drawDuck, RIVAL_COLORS } from '../entities/duck'
import { Wake } from '../entities/wake'
import type { Point } from '../track/geometry'
import type { DuckState, PlayerInfo } from './protocol'

// Rivals are drawn this far in the past, so there's nearly always a newer update to
// interpolate toward
const RENDER_DELAY_MS = 120
// Updates kept per rival
const BUFFER = 20
// No update for this long means they've stopped (finished, or the connection stalled)
const STALE_MS = 300

interface Snapshot extends DuckState {
  at: number
}

/** Another racer's duck, moved by the positions the relay passes on. */
class Rival extends Container {
  readonly info: PlayerInfo
  progress = 0
  /** Finish time in ms, once they're done. */
  finishTime: number | null = null
  readonly wake = new Wake()
  private duck: Container
  private snapshots: Snapshot[] = []
  private speed = 0

  constructor(info: PlayerInfo) {
    super()
    this.info = info
    this.duck = drawDuck(RIVAL_COLORS[info.color % RIVAL_COLORS.length])
    const label = new Text({
      text: info.name,
      style: { fill: '#ffffff', fontSize: 16, stroke: { color: 0x000000, width: 3, join: 'round' } },
    })
    label.anchor.set(0.5, 1)
    label.y = -30
    this.addChild(this.duck, label)
    this.visible = false
  }

  push(state: DuckState, at: number) {
    this.snapshots.push({ ...state, at })
    if (this.snapshots.length > BUFFER) this.snapshots.shift()
    this.progress = state.progress
  }

  update(now: number, dt: number) {
    const s = this.snapshots
    if (s.length === 0) return
    this.visible = true
    const t = now - RENDER_DELAY_MS
    // The newest pair around t; past the newest update, hold it
    let i = s.length - 1
    while (i > 0 && s[i - 1].at > t) i--
    const a = s[Math.max(0, i - 1)]
    const b = s[i]
    const k = b.at === a.at ? 1 : Math.max(0, Math.min((t - a.at) / (b.at - a.at), 1))
    const x = a.x + (b.x - a.x) * k
    const y = a.y + (b.y - a.y) * k
    // Shortest way round, so a heading wrapping past ±π doesn't spin the duck
    const turn = Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading))
    this.duck.rotation = a.heading + turn * k
    if (now - b.at > STALE_MS) this.speed = 0
    else if (b.at !== a.at) this.speed = (Math.hypot(b.x - a.x, b.y - a.y) / (b.at - a.at)) * 1000
    this.position.set(x * SCALE, y * SCALE)
    const back = { x: x - Math.cos(this.duck.rotation) * 0.9, y: y - Math.sin(this.duck.rotation) * 0.9 }
    this.wake.update(dt, back, this.speed)
  }

  get physicsPosition(): Point {
    return { x: this.x / SCALE, y: this.y / SCALE }
  }
}

/** Everyone else in an online race. */
export class Rivals extends Container {
  private rivals = new Map<string, Rival>()
  private wakes = new Container()

  /** `wakeLayer` is where their wakes go: under every duck. */
  constructor(wakeLayer: Container) {
    super()
    wakeLayer.addChild(this.wakes)
  }

  /** Starts a race with these players (everyone but you), each waiting at `startAt(id)`. */
  reset(players: PlayerInfo[], startAt: (id: string) => DuckState) {
    this.clear()
    const now = performance.now()
    for (const info of players) {
      const rival = new Rival(info)
      rival.push(startAt(info.id), now)
      this.rivals.set(info.id, rival)
      this.addChild(rival)
      this.wakes.addChild(rival.wake)
    }
  }

  clear() {
    for (const r of this.rivals.values()) {
      r.wake.destroy()
      r.destroy({ children: true })
    }
    this.rivals.clear()
  }

  ids() {
    return [...this.rivals.keys()]
  }

  onState(id: string, state: DuckState) {
    this.rivals.get(id)?.push(state, performance.now())
  }

  onFinish(id: string, time: number) {
    const rival = this.rivals.get(id)
    if (rival) rival.finishTime = time
  }

  /** Someone left mid-race. */
  remove(id: string) {
    const rival = this.rivals.get(id)
    if (!rival) return
    rival.wake.destroy()
    rival.destroy({ children: true })
    this.rivals.delete(id)
  }

  update(dt: number) {
    const now = performance.now()
    for (const r of this.rivals.values()) r.update(now, dt)
  }

  /** Your place (1-based) and the field size: finishers by time, then by distance. */
  standing(you: { progress: number; finishTime: number | null }) {
    const field = [...this.rivals.values()].map((r) => ({ progress: r.progress, finishTime: r.finishTime }))
    const ahead = field.filter((r) =>
      you.finishTime !== null
        ? r.finishTime !== null && r.finishTime < you.finishTime
        : r.finishTime !== null || r.progress > you.progress,
    ).length
    return { place: ahead + 1, of: field.length + 1 }
  }

  /** Minimap dots: position and colour index of every visible rival. */
  dots() {
    return [...this.rivals.values()].filter((r) => r.visible).map((r) => ({ ...r.physicsPosition, color: r.info.color }))
  }
}
