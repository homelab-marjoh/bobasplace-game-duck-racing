import type { Server, ServerWebSocket, WebSocketHandler } from 'bun'
import { COURSES } from '../src/game/track/courses'
import {
  FINISH_GRACE_MS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  ROOM_CODE_LENGTH,
  START_COUNTDOWN_MS,
  type ClientMessage,
  type ResultEntry,
  type RoomInfo,
  type RoomPhase,
  type ServerMessage,
} from '../src/game/online/protocol'

// The race relay: rooms of up to MAX_PLAYERS. It doesn't simulate anything; each client
// runs its own duck and the relay passes positions and finish times between them,
// starts races together and calls the results.

const MAX_ROOMS = 200
// No I or O, so codes can't be misread as 1 or 0
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

interface Player {
  id: string
  name: string
  color: number
  ws: ServerWebSocket<Connection>
}

interface Room {
  code: string
  hostId: string
  course: string
  phase: RoomPhase
  // Insertion order is join order, which is also the starting grid order
  players: Map<string, Player>
  // Players in the current race, and the finish times of those who are done
  racers: Set<string>
  finishes: Map<string, number>
  resultsTimer?: Timer
}

/** Per-connection data. */
export interface Connection {
  id: string
  room?: Room
}

const rooms = new Map<string, Room>()

/** Upgrades `/race` requests; returns true if it did. */
export function upgradeRace(req: Request, server: Server<Connection>): boolean {
  return server.upgrade(req, { data: { id: crypto.randomUUID() } })
}

export const raceSocket: WebSocketHandler<Connection> = {
  maxPayloadLength: 2048,
  idleTimeout: 60,

  message(ws, raw) {
    const msg = parse(raw)
    if (!msg) return
    const room = ws.data.room
    switch (msg.type) {
      case 'create':
        return create(ws, msg.name)
      case 'join':
        return join(ws, msg.code, msg.name)
      case 'course':
        if (room && isHost(ws, room) && room.phase !== 'racing' && COURSES.some((c) => c.id === msg.course)) {
          room.course = msg.course
          broadcastRoom(room)
        }
        return
      case 'start':
        if (room && isHost(ws, room) && room.phase !== 'racing') start(room)
        return
      case 'state':
        if (room?.phase === 'racing' && room.racers.has(ws.data.id)) {
          const { x, y, heading, progress } = msg
          broadcast(room, { type: 'state', id: ws.data.id, x, y, heading, progress }, ws.data.id)
        }
        return
      case 'finish':
        if (room?.phase === 'racing' && room.racers.has(ws.data.id) && !room.finishes.has(ws.data.id)) {
          finish(room, ws.data.id, msg.time)
        }
        return
    }
  },

  close(ws) {
    const room = ws.data.room
    if (!room) return
    room.players.delete(ws.data.id)
    room.racers.delete(ws.data.id)
    if (room.players.size === 0) {
      clearTimeout(room.resultsTimer)
      rooms.delete(room.code)
      return
    }
    if (room.hostId === ws.data.id) room.hostId = room.players.keys().next().value!
    broadcastRoom(room)
    // Everyone still racing may now be done
    if (room.phase === 'racing') maybeCallResults(room)
  },
}

function create(ws: ServerWebSocket<Connection>, name: string) {
  if (ws.data.room) return
  if (rooms.size >= MAX_ROOMS) return send(ws, { type: 'error', message: 'The server is full, try again later' })
  let code: string
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('')
  } while (rooms.has(code))
  const room: Room = {
    code,
    hostId: ws.data.id,
    course: COURSES[0].id,
    phase: 'lobby',
    players: new Map(),
    racers: new Set(),
    finishes: new Map(),
  }
  rooms.set(code, room)
  addPlayer(ws, room, name)
}

function join(ws: ServerWebSocket<Connection>, code: string, name: string) {
  if (ws.data.room) return
  const room = rooms.get(code.toUpperCase())
  if (!room) return send(ws, { type: 'error', message: `No room called ${code.toUpperCase()}` })
  if (room.players.size >= MAX_PLAYERS) return send(ws, { type: 'error', message: 'That room is full' })
  addPlayer(ws, room, name)
}

function addPlayer(ws: ServerWebSocket<Connection>, room: Room, name: string) {
  const used = new Set([...room.players.values()].map((p) => p.color))
  let color = 0
  while (used.has(color)) color++
  room.players.set(ws.data.id, { id: ws.data.id, name: cleanName(name), color, ws })
  ws.data.room = room
  send(ws, { type: 'joined', you: ws.data.id, room: roomInfo(room) })
  broadcastRoom(room, ws.data.id)
}

function start(room: Room) {
  clearTimeout(room.resultsTimer)
  room.phase = 'racing'
  room.racers = new Set(room.players.keys())
  room.finishes.clear()
  const grid = Object.fromEntries([...room.players.keys()].map((id, slot) => [id, slot]))
  broadcast(room, { type: 'start', course: room.course, grid, countdownMs: START_COUNTDOWN_MS })
  broadcastRoom(room)
}

function finish(room: Room, id: string, time: number) {
  room.finishes.set(id, time)
  broadcast(room, { type: 'finish', id, time })
  // The first finisher starts the clock on everyone else
  if (room.finishes.size === 1) room.resultsTimer = setTimeout(() => callResults(room), FINISH_GRACE_MS)
  maybeCallResults(room)
}

function maybeCallResults(room: Room) {
  if ([...room.racers].every((id) => room.finishes.has(id))) callResults(room)
}

function callResults(room: Room) {
  if (room.phase !== 'racing') return
  clearTimeout(room.resultsTimer)
  room.phase = 'results'
  const results: ResultEntry[] = [...room.racers]
    .map((id) => ({ id, name: room.players.get(id)?.name ?? '?', time: room.finishes.get(id) ?? null }))
    // Finishers by time, then everyone who didn't finish
    .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity))
  broadcast(room, { type: 'results', results })
  broadcastRoom(room)
}

function isHost(ws: ServerWebSocket<Connection>, room: Room) {
  return room.hostId === ws.data.id
}

function roomInfo(room: Room): RoomInfo {
  return {
    code: room.code,
    hostId: room.hostId,
    course: room.course,
    phase: room.phase,
    players: [...room.players.values()].map(({ id, name, color }) => ({ id, name, color })),
  }
}

function broadcastRoom(room: Room, except?: string) {
  broadcast(room, { type: 'room', room: roomInfo(room) }, except)
}

function broadcast(room: Room, msg: ServerMessage, except?: string) {
  const data = JSON.stringify(msg)
  for (const p of room.players.values()) if (p.id !== except) p.ws.send(data)
}

function send(ws: ServerWebSocket<Connection>, msg: ServerMessage) {
  ws.send(JSON.stringify(msg))
}

function cleanName(name: string) {
  // Printable characters only, collapsed whitespace
  const clean = name.replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH)
  return clean || 'Duck'
}

// Anything malformed is dropped: clients are not trusted
function parse(raw: string | Buffer): ClientMessage | null {
  let m: Record<string, unknown>
  try {
    m = JSON.parse(String(raw))
  } catch {
    return null
  }
  if (!m || typeof m !== 'object') return null
  const str = (k: string) => typeof m[k] === 'string'
  const num = (k: string) => typeof m[k] === 'number' && Number.isFinite(m[k])
  switch (m.type) {
    case 'create':
      return str('name') ? (m as ClientMessage) : null
    case 'join':
      return str('code') && str('name') ? (m as ClientMessage) : null
    case 'course':
      return str('course') ? (m as ClientMessage) : null
    case 'start':
      return m as ClientMessage
    case 'state':
      return num('x') && num('y') && num('heading') && num('progress') ? (m as ClientMessage) : null
    case 'finish':
      return num('time') && (m.time as number) > 0 ? (m as ClientMessage) : null
    default:
      return null
  }
}
