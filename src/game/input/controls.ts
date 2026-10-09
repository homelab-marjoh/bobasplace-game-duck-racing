import { BOBA } from '../config'
import type { Point } from '../track/geometry'

/** What Boba should do this step: each in -1..1. */
export interface DriveInput {
  /** Forward (+) or brake/reverse (-). */
  throttle: number
  /** Right (+) or left (-). */
  steer: number
}

const NO_INPUT: DriveInput = { throttle: 0, steer: 0 }

/** Menu actions: start a race, or pick the previous/next course. */
export type MenuAction = 'start' | 'prev' | 'next'

// Taps this close to the left/right screen edge (fraction of the width) pick a course
const EDGE_TAP = 0.25

const THROTTLE_KEYS = ['w', 'ArrowUp']
const BRAKE_KEYS = ['s', 'ArrowDown']
const LEFT_KEYS = ['a', 'ArrowLeft']
const RIGHT_KEYS = ['d', 'ArrowRight']
const DRIVE_KEYS = [...THROTTLE_KEYS, ...BRAKE_KEYS, ...LEFT_KEYS, ...RIGHT_KEYS]
const START_KEYS = [' ', 'Enter']

/**
 * Keyboard and pointer input. Arrows/WASD drive; holding a finger or mouse button
 * on the canvas makes Boba paddle toward it. The same input doubles as the menu
 * (`onMenu`): space/Enter or a tap start, left/right or a tap near an edge pick a course.
 */
export class Controls {
  /** Off while waiting to start and after finishing: `read()` gives no input. */
  enabled = false
  /** Offered every menu action; returns true if the menu is open and took it. */
  onMenu?: (action: MenuAction) => boolean

  private held = new Set<string>()
  // Screen coordinates of a held pointer
  private pointer = { active: false, x: 0, y: 0 }
  private canvas: HTMLCanvasElement
  private screenToPhysics: (x: number, y: number) => Point

  constructor(canvas: HTMLCanvasElement, screenToPhysics: (x: number, y: number) => Point) {
    this.canvas = canvas
    this.screenToPhysics = screenToPhysics
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.release)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)
  }

  /** Input for Boba at `position` (physics units) facing `heading`. Keys win over the pointer. */
  read(position: Point, heading: number): DriveInput {
    if (!this.enabled) return NO_INPUT
    const throttle = (this.isHeld(THROTTLE_KEYS) ? 1 : 0) - (this.isHeld(BRAKE_KEYS) ? 1 : 0)
    const steer = (this.isHeld(RIGHT_KEYS) ? 1 : 0) - (this.isHeld(LEFT_KEYS) ? 1 : 0)
    if (throttle !== 0 || steer !== 0 || !this.pointer.active) return { throttle, steer }

    const target = this.screenToPhysics(this.pointer.x, this.pointer.y)
    const dx = target.x - position.x
    const dy = target.y - position.y
    let diff = Math.atan2(dy, dx) - heading
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    return {
      steer: Math.max(-1, Math.min(diff * 3, 1)),
      // Ease off once the finger is right on top of Boba
      throttle: Math.hypot(dx, dy) > BOBA.radius * 2 ? 1 : 0,
    }
  }

  /** Lets go of every key and the pointer. */
  release = () => {
    this.held.clear()
    this.pointer.active = false
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.release)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerUp)
  }

  private isHeld(keys: string[]) {
    return keys.some((k) => this.held.has(k))
  }

  // Arrow properties so add/removeEventListener share one reference
  private onKeyDown = (event: KeyboardEvent) => {
    const key = normalizeKey(event.key)
    if (isTyping(event) || event.ctrlKey || event.metaKey || event.altKey) return
    if (START_KEYS.includes(key)) {
      if (!event.repeat && this.onMenu?.('start')) event.preventDefault()
    } else if (DRIVE_KEYS.includes(key)) {
      event.preventDefault()
      this.held.add(key)
      if (event.repeat) return
      if (LEFT_KEYS.includes(key)) this.onMenu?.('prev')
      if (RIGHT_KEYS.includes(key)) this.onMenu?.('next')
    }
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.held.delete(normalizeKey(event.key))
  }

  private onPointerDown = (event: PointerEvent) => {
    const edge = event.offsetX / this.canvas.clientWidth
    const action = edge < EDGE_TAP ? 'prev' : edge > 1 - EDGE_TAP ? 'next' : 'start'
    if (this.onMenu?.(action)) return
    this.pointer = { active: true, x: event.offsetX, y: event.offsetY }
    this.canvas.setPointerCapture(event.pointerId)
  }

  private onPointerMove = (event: PointerEvent) => {
    this.pointer.x = event.offsetX
    this.pointer.y = event.offsetY
  }

  private onPointerUp = () => {
    this.pointer.active = false
  }
}

// Shift or caps lock turn 'w' into 'W'
function normalizeKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key
}

// The listeners are on window, so leave typing and buttons elsewhere on the page alone.
// composedPath() sees into shadow roots (the lobby panel), where `target` would only be
// the <bobas-game> element.
function isTyping(event: KeyboardEvent) {
  const target = event.composedPath()[0]
  return (
    (target instanceof HTMLElement && target.isContentEditable) ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLButtonElement
  )
}
