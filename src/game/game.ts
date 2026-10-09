import { Application, Container } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import RAPIER from '@dimforge/rapier2d-compat'
import { Camera } from './camera'
import { COUNTDOWN, FIXED_DT, MAX_FRAME_TIME, PLAYER, SCALE, WAKE } from './config'
import { PhysicsDebug } from './debug'
import { Player } from './entities/player'
import { Wake } from './entities/wake'
import { Controls, type MenuAction } from './input/controls'
import { LobbyPanel } from './online/lobbyPanel'
import type { ResultEntry, ServerMessage } from './online/protocol'
import { Rivals } from './online/rivals'
import { raceServerUrl, Session } from './online/session'
import { LapCounter } from './race/lapCounter'
import { loadBest, loadLastCourse, loadName, saveBest, saveLastCourse, saveName } from './storage'
import { COURSES, findCourse } from './track/courses'
import { createScenery } from './track/scenery'
import { Track } from './track/track'
import { Hud } from './ui/hud'

export interface RaceResult {
  /** Course id. */
  track: string
  /** Total race time, ms. */
  time: number
  /** Best total time so far on this course (this one included), ms. */
  best: number
  newBest: boolean
  /** Each lap's time, ms. */
  laps: number[]
  /** Raced in an online room rather than alone. */
  online: boolean
}

export interface GameOptions {
  /** Draw physics colliders. */
  debug?: boolean
  /** Course id to open the menu on; defaults to the one picked last time. */
  track?: string | null
  /** Race relay WebSocket URL; defaults to /race on the server that served the game. */
  server?: string | null
  /** Called when your duck crosses the line on the last lap. */
  onFinish?: (result: RaceResult) => void
}

export interface Game {
  destroy(): void
}

// menu: solo, picking a course. lobby: in an online room, between races.
type RaceState = 'menu' | 'lobby' | 'countdown' | 'racing' | 'finished'

// How long "Go!" stays up, seconds
const GO_TIME = 0.7
// Shake from hitting a bank at full speed (0..1)
const BUMP_SHAKE = 0.6

/**
 * Starts the game inside `container`; the canvas sizes itself to the container.
 * Safe to destroy at any point, including while still loading.
 */
export async function createGame(container: HTMLElement, options: GameOptions = {}): Promise<Game> {
  const app = new Application()
  await app.init({ resizeTo: container })
  app.canvas.style.display = 'block'
  // Touch steers your duck, so don't let it scroll or zoom the page
  app.canvas.style.touchAction = 'none'
  container.appendChild(app.canvas)

  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: 0 })
  world.timestep = FIXED_DT
  const eventQueue = new RAPIER.EventQueue(true)

  // World space (scrolls with the camera). The scenery goes underneath, per course.
  const viewport = new Viewport({
    screenWidth: app.screen.width,
    screenHeight: app.screen.height,
    events: app.renderer.events,
  })
  const wakes = new Container()
  const wake = wakes.addChild(new Wake())
  const rivals = new Rivals(wakes)
  const player = new Player(world)
  viewport.addChild(wakes, rivals, player)
  const physicsDebug = options.debug ? viewport.addChild(new PhysicsDebug()) : undefined

  // Screen space
  const hud = new Hud()
  app.stage.addChild(viewport, hud)
  const panel = new LobbyPanel(container, loadName())

  const camera = new Camera(viewport, app.stage)
  const layout = (width: number, height: number) => {
    camera.resize(width, height)
    hud.layout(width, height)
  }
  layout(app.screen.width, app.screen.height)
  app.renderer.on('resize', layout)

  const controls = new Controls(app.canvas, (x, y) => {
    const p = viewport.toWorld(x, y)
    return { x: p.x / SCALE, y: p.y / SCALE }
  })

  let state: RaceState = 'menu'
  let courseIndex = findCourse(options.track ?? loadLastCourse())
  // Set by setCourse
  let track!: Track
  let scenery: Container | undefined
  let laps!: LapCounter
  let best = 0
  let countdown = 0
  let goTimer = 0
  // Online: the room connection, the last race's results, and your finish time (ms)
  let session: Session | null = null
  let results: ResultEntry[] | null = null
  let finishTime: number | null = null
  let destroyed = false

  // --- Race flow ---

  const resetRace = (slot = 0) => {
    const pose = track.startPose(slot)
    player.reset(pose.x, pose.y, pose.heading)
    wake.reset()
    laps.reset(pose.index)
    finishTime = null
    controls.enabled = false
    camera.snapTo(pose)
    hud.setRace(laps.lap, track.course.laps, laps.time)
    hud.setBest(best)
  }

  // Swaps in course `index`: colliders, scenery, minimap
  const setCourse = (index: number) => {
    courseIndex = (index + COURSES.length) % COURSES.length
    const course = COURSES[courseIndex]
    if (course === track?.course) return
    track?.destroy(world)
    scenery?.destroy({ children: true })
    track = new Track(world, course)
    scenery = viewport.addChildAt(createScenery(track), 0)
    app.renderer.background.color = course.theme.grass
    laps = new LapCounter(track)
    best = loadBest(course.id)
    hud.setTrack(track)
    resetRace()
  }

  // The screen between races: the solo menu, or the online room
  const showIdle = () => {
    controls.enabled = false
    controls.release()
    hud.setPlace(null)
    rivals.clear()
    if (session?.room) {
      state = 'lobby'
      hud.showLobby(track.course, session.isHost)
      panel.showRoom(session.room, session.you, results)
    } else {
      state = 'menu'
      hud.showMenu(track.course, courseIndex, COURSES.length, best)
      panel.showButton()
    }
  }

  const start = (slot = 0, seconds = COUNTDOWN) => {
    resetRace(slot)
    state = 'countdown'
    countdown = seconds
    panel.hide()
  }

  const finish = () => {
    state = 'finished'
    controls.enabled = false
    controls.release()
    const time = Math.round(laps.time * 1000)
    const lapTimes = laps.laps.map((t) => Math.round(t * 1000))
    const newBest = best === 0 || time < best
    if (newBest) {
      best = time
      saveBest(track.course.id, best)
    }
    finishTime = time
    hud.setRace(laps.lap, track.course.laps, laps.time)
    hud.setBest(best)
    if (session) {
      session.send({ type: 'finish', time })
      const { place, of } = rivals.standing({ progress: laps.distance, finishTime })
      hud.showOnlineFinish(time, place, of, newBest)
    } else {
      hud.showFinish(time, lapTimes, newBest)
    }
    options.onFinish?.({ track: track.course.id, time, best, newBest, laps: lapTimes, online: !!session })
  }

  // Keys and taps between races: solo picks and starts freely; online only the host
  // does, through the relay
  controls.onMenu = (action: MenuAction) => {
    if (state === 'menu' || (state === 'finished' && !session)) {
      if (action === 'start') {
        saveLastCourse(track.course.id)
        start()
      } else {
        setCourse(courseIndex + (action === 'next' ? 1 : -1))
        showIdle()
      }
      return true
    }
    if (session && (state === 'lobby' || state === 'finished')) {
      if (!session.isHost || session.room?.phase === 'racing') return true
      if (action === 'start') session.send({ type: 'start' })
      else {
        const next = COURSES[(courseIndex + (action === 'next' ? 1 : -1) + COURSES.length) % COURSES.length]
        session.send({ type: 'course', course: next.id })
      }
      return true
    }
    return false
  }

  // --- Online ---

  const goOnline = async (name: string, code?: string) => {
    saveName(name)
    panel.showBusy('Connecting…')
    let connected: Session
    try {
      connected = await Session.connect(raceServerUrl(options.server))
    } catch (error) {
      panel.showForm((error as Error).message)
      return
    }
    if (destroyed) return connected.close()
    session = connected
    results = null
    connected.onMessage = onServerMessage
    connected.onClose = leaveOnline
    connected.send(code ? { type: 'join', code, name } : { type: 'create', name })
    panel.showBusy(code ? `Joining ${code}…` : 'Creating a room…')
  }

  const leaveOnline = (reason = '') => {
    session?.close()
    session = null
    results = null
    rivals.clear()
    resetRace()
    showIdle()
    if (reason) panel.showButton(reason)
  }

  const onServerMessage = (msg: ServerMessage) => {
    if (!session) return
    switch (msg.type) {
      case 'joined':
      case 'room': {
        if (state === 'menu' || state === 'lobby') {
          setCourse(findCourse(msg.room.course))
          showIdle()
        } else {
          // Mid-race: just drop anyone who left
          const here = new Set(msg.room.players.map((p) => p.id))
          for (const id of rivals.ids()) if (!here.has(id)) rivals.remove(id)
        }
        break
      }
      case 'start': {
        results = null
        setCourse(findCourse(msg.course))
        const you = session.you
        rivals.reset(
          (session.room?.players ?? []).filter((p) => p.id !== you && p.id in msg.grid),
          (id) => {
            const pose = track.startPose(msg.grid[id])
            // Just behind the line, like LapCounter starts it
            return { ...pose, progress: (pose.index - track.count) / track.count }
          },
        )
        start(msg.grid[you] ?? 0, msg.countdownMs / 1000)
        break
      }
      case 'state':
        rivals.onState(msg.id, msg)
        break
      case 'finish':
        if (msg.id !== session.you) rivals.onFinish(msg.id, msg.time)
        break
      case 'results':
        // Anyone still paddling is out of time
        results = msg.results
        showIdle()
        break
      case 'error':
        if (!session.room) leaveOnline()
        panel.showForm(msg.message)
        break
    }
  }

  panel.onCreate = (name) => void goOnline(name)
  panel.onJoin = (code, name) => void goOnline(name, code)
  panel.onStart = () => session?.send({ type: 'start' })
  panel.onLeave = () => leaveOnline()

  setCourse(courseIndex)
  showIdle()

  // --- Loop ---

  // Countdown and "Go!" run on frame time; the race clock runs on physics steps
  const updateCountdown = (dt: number) => {
    if (state === 'countdown') {
      countdown -= dt
      hud.showCountdown(countdown)
      if (countdown <= 0) {
        state = 'racing'
        controls.enabled = true
        goTimer = GO_TIME
        hud.showGo()
      }
    }
    if (goTimer > 0) {
      goTimer -= dt
      if (goTimer <= 0 && state === 'racing') hud.hideMessage()
    }
  }

  const physicsStep = () => {
    const speedBefore = player.speed
    player.preStep(FIXED_DT, controls.read(player.physicsPosition, player.physicsHeading))
    world.step(eventQueue)

    // Your duck is the only physics body that moves, so any contact is your duck hitting a bank
    eventQueue.drainCollisionEvents((_a, _b, started) => {
      if (started) camera.shake((speedBefore / PLAYER.maxSpeed) * BUMP_SHAKE)
    })
    if (state === 'racing') {
      laps.step(FIXED_DT, player.physicsPosition)
      if (laps.finished) finish()
    }
  }

  // Fixed-timestep loop: step physics at FIXED_DT regardless of display refresh rate,
  // then render interpolated between the last two steps. After the finish your duck coasts on.
  let accumulator = 0
  app.ticker.add(() => {
    const dt = Math.min(app.ticker.deltaMS / 1000, MAX_FRAME_TIME)
    updateCountdown(dt)

    const simulating = state === 'racing' || state === 'finished'
    accumulator += dt
    while (simulating && accumulator >= FIXED_DT) {
      physicsStep()
      accumulator -= FIXED_DT
    }
    // The world is frozen before the start; don't bank time for a burst when it begins
    if (!simulating) accumulator = 0

    if (session && state === 'racing') {
      session.sendState({ ...player.physicsPosition, heading: player.physicsHeading, progress: laps.distance })
    }

    player.update(simulating ? accumulator / FIXED_DT : 1, dt)
    const position = player.renderedPosition
    const heading = player.rotation
    wake.update(
      dt,
      { x: position.x - Math.cos(heading) * WAKE.tailOffset, y: position.y - Math.sin(heading) * WAKE.tailOffset },
      player.speed,
    )
    rivals.update(dt)
    camera.update(dt, position, player.velocity)
    hud.updateMinimap(position, rivals.dots())
    if (state === 'racing') hud.setRace(laps.lap, track.course.laps, laps.time)
    if (session && (state === 'countdown' || simulating)) {
      hud.setPlace(rivals.standing({ progress: laps.distance, finishTime }))
    }
    physicsDebug?.draw(world)
  })

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      session?.close()
      controls.destroy()
      panel.destroy()
      app.destroy(true, { children: true })
      // Only once Pixi is done with everything, free Rapier's wasm-side memory
      eventQueue.free()
      world.free()
    },
  }
}
