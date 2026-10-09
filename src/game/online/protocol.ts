// Messages between the game and the race relay (server/relay.ts), sent as JSON over a
// WebSocket. Shared by both sides, so keep it free of DOM and Bun APIs.

export const MAX_PLAYERS = 8
export const MAX_NAME_LENGTH = 16
export const ROOM_CODE_LENGTH = 4
/** Countdown the relay asks every client to run before a race, ms. */
export const START_COUNTDOWN_MS = 3000
/** Once someone finishes, the others get this long before results are called, ms. */
export const FINISH_GRACE_MS = 45000
/** How often a racing client sends its position, ms. */
export const STATE_INTERVAL_MS = 50

export type RoomPhase = 'lobby' | 'racing' | 'results'

export interface PlayerInfo {
  id: string
  name: string
  /** Index into the remote duck palette; unique within the room. */
  color: number
}

export interface RoomInfo {
  code: string
  hostId: string
  course: string
  phase: RoomPhase
  players: PlayerInfo[]
}

export interface ResultEntry {
  id: string
  name: string
  /** Total race time in ms, or null if they didn't finish. */
  time: number | null
}

/** A racer's position: physics units, heading in radians, laps done as a fraction. */
export interface DuckState {
  x: number
  y: number
  heading: number
  progress: number
}

export type ClientMessage =
  | { type: 'create'; name: string }
  | { type: 'join'; code: string; name: string }
  | { type: 'course'; course: string }
  | { type: 'start' }
  | ({ type: 'state' } & DuckState)
  | { type: 'finish'; time: number }

export type ServerMessage =
  | { type: 'joined'; you: string; room: RoomInfo }
  | { type: 'room'; room: RoomInfo }
  /** `grid` maps player id to starting slot. */
  | { type: 'start'; course: string; grid: Record<string, number>; countdownMs: number }
  | ({ type: 'state'; id: string } & DuckState)
  | { type: 'finish'; id: string; time: number }
  | { type: 'results'; results: ResultEntry[] }
  | { type: 'error'; message: string }
