import { BEST_TIME_KEY, LAST_TRACK_KEY, NAME_KEY } from './config'

// localStorage can be blocked (private windows, site data off); then nothing persists

/** Best total race time on the course in ms, or 0 if there isn't one yet. */
export function loadBest(courseId: string): number {
  return Number(read(`${BEST_TIME_KEY}:${courseId}`)) || 0
}

export function saveBest(courseId: string, best: number) {
  write(`${BEST_TIME_KEY}:${courseId}`, String(best))
}

/** Id of the course picked last time, so the menu opens on it. */
export function loadLastCourse(): string | null {
  return read(LAST_TRACK_KEY)
}

export function saveLastCourse(courseId: string) {
  write(LAST_TRACK_KEY, courseId)
}

/** Nickname used online last time. */
export function loadName(): string {
  return read(NAME_KEY) ?? ''
}

export function saveName(name: string) {
  write(NAME_KEY, name)
}

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not persisted
  }
}
