import { Container, Text } from 'pixi.js'
import type { Course } from '../track/courses'
import type { Point } from '../track/geometry'
import type { Track } from '../track/track'
import { Minimap } from './minimap'

const STYLE = { fill: '#ffffff', stroke: { color: 0x000000, width: 4, join: 'round' as const } }
const CONTROLS_HINT = 'Arrows or WASD to paddle, or hold to steer'

/** 1 → 1st, 2 → 2nd, ... */
export function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}

function laps(n: number) {
  return n === 1 ? '1 lap' : `${n} laps`
}

/** ms → m:ss.cc */
export function formatTime(ms: number) {
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(2).padStart(5, '0')
  return `${minutes}:${seconds}`
}

/**
 * Screen-space overlay: lap, clock and best top-left, minimap top-right, and in the
 * middle either the menu (course name, ◀ ▶ arrows at the screen edges) or race messages.
 */
export class Hud extends Container {
  private minimap?: Minimap
  private lapText = new Text({ text: '', style: { ...STYLE, fontSize: 24 } })
  private timeText = new Text({ text: '', style: { ...STYLE, fontSize: 24 } })
  private bestText = new Text({ text: '', style: { ...STYLE, fontSize: 18 } })
  private placeText = new Text({ text: '', style: { ...STYLE, fill: '#ffd23f', fontSize: 24 } })
  private title = new Text({ text: '', style: { ...STYLE, fill: '#ffd23f', fontSize: 40, stroke: { ...STYLE.stroke, width: 6 } } })
  private message = new Text({ text: '', style: { ...STYLE, fontSize: 32, align: 'center', wordWrap: true } })
  private prevArrow = new Text({ text: '◀', style: { ...STYLE, fontSize: 44 } })
  private nextArrow = new Text({ text: '▶', style: { ...STYLE, fontSize: 44 } })
  private size = { width: 0, height: 0 }

  constructor() {
    super()
    this.lapText.position.set(20, 16)
    this.timeText.position.set(20, 46)
    this.bestText.position.set(20, 78)
    this.placeText.position.set(20, 102)
    this.title.anchor.set(0.5, 1)
    this.message.anchor.set(0.5)
    this.prevArrow.anchor.set(0, 0.5)
    this.nextArrow.anchor.set(1, 0.5)
    this.addChild(this.lapText, this.timeText, this.bestText, this.placeText, this.title, this.message, this.prevArrow, this.nextArrow)
  }

  /** Switches the minimap to `track`. */
  setTrack(track: Track) {
    this.minimap?.destroy({ children: true })
    this.minimap = this.addChild(new Minimap(track))
    this.layout(this.size.width, this.size.height)
  }

  /** Moves the minimap dots; positions in physics units. */
  updateMinimap(p: Point, rivals?: (Point & { color: number })[]) {
    this.minimap?.update(p, rivals)
  }

  layout(width: number, height: number) {
    this.size = { width, height }
    // Above centre, so it doesn't cover Boba
    this.message.position.set(width / 2, height * 0.32)
    // Smaller and wrapped on narrow screens
    this.message.style.fontSize = Math.max(16, Math.min(28, width / 22))
    this.message.style.wordWrapWidth = width - 120
    this.title.style.fontSize = Math.max(26, Math.min(44, width / 14))
    this.prevArrow.position.set(16, height / 2)
    this.nextArrow.position.set(width - 16, height / 2)
    this.placeTitle()
    this.minimap?.position.set(width - this.minimap.boxWidth - 16, 16)
  }

  /** `time` in seconds. */
  setRace(lap: number, laps: number, time: number) {
    this.lapText.text = `Lap ${lap}/${laps}`
    this.timeText.text = formatTime(time * 1000)
  }

  /** `best` in ms; 0 hides it. */
  setBest(best: number) {
    this.bestText.text = best > 0 ? `Best ${formatTime(best)}` : ''
  }

  /** Your place in an online race; null hides it. */
  setPlace(standing: { place: number; of: number } | null) {
    this.placeText.text = standing ? `${ordinal(standing.place)} of ${standing.of}` : ''
  }

  /** Waiting in an online room; only the host picks the course. */
  showLobby(course: Course, isHost: boolean) {
    this.show(
      `${laps(course.laps)}\n\n${isHost ? 'Pick the course with ◀ ▶,\nthen start the race below' : 'Waiting for the host to start'}`,
      { title: course.name, arrows: isHost },
    )
  }

  /** Finished an online race; the others may still be going. Time in ms. */
  showOnlineFinish(time: number, place: number, of: number, newBest: boolean) {
    this.show(
      `${ordinal(place)} of ${of}  ·  ${formatTime(time)}${newBest ? '  ·  New best!' : ''}\n\nWaiting for the others…`,
      { title: 'Finished!' },
    )
  }

  /** The start screen for `course`, number `index` of `total`; `best` in ms (0 for none). */
  showMenu(course: Course, index: number, total: number, best: number) {
    const record = best > 0 ? `Best ${formatTime(best)}` : 'No time yet'
    this.show(
      `${laps(course.laps)}  ·  ${record}  ·  ${index + 1}/${total}\n\n${CONTROLS_HINT}\nSpace or tap to start`,
      { title: course.name, arrows: true },
    )
  }

  showCountdown(secondsLeft: number) {
    this.show(String(Math.ceil(secondsLeft)), { big: true })
  }

  showGo() {
    this.show('Go!', { big: true })
  }

  /** Times in ms. */
  showFinish(time: number, laps: number[], newBest: boolean) {
    this.show(
      `${formatTime(time)}${newBest ? '  ·  New best!' : ''}\n` +
        `Laps ${laps.map((t) => (t / 1000).toFixed(2)).join('  ·  ')}\n\n` +
        'Space or tap to race again\n◀ ▶ for another course',
      { title: 'Finished!', arrows: true },
    )
  }

  hideMessage() {
    this.show('')
  }

  private show(text: string, { title = '', big = false, arrows = false } = {}) {
    this.message.text = text
    this.message.scale.set(big ? 2.5 : 1)
    this.title.text = title
    this.prevArrow.visible = arrows
    this.nextArrow.visible = arrows
    this.placeTitle()
  }

  // Just above the message, whatever its height
  private placeTitle() {
    this.title.position.set(this.message.x, this.message.y - this.message.height / 2 - 8)
  }
}
