import { STATE_INTERVAL_MS, type ClientMessage, type DuckState, type RoomInfo, type ServerMessage } from './protocol'

/**
 * The connection to the race relay, for one room. Holds the latest room info and
 * hands every server message to `onMessage`.
 */
export class Session {
  room: RoomInfo | null = null
  /** Your player id, once in a room. */
  you = ''
  onMessage?: (msg: ServerMessage) => void
  /** The connection dropped or couldn't be made; the session is dead. */
  onClose?: (reason: string) => void

  private ws: WebSocket
  private lastState = 0
  private closed = false

  private constructor(url: string) {
    this.ws = new WebSocket(url)
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage
      if (msg.type === 'joined') this.you = msg.you
      if (msg.type === 'joined' || msg.type === 'room') this.room = msg.room
      this.onMessage?.(msg)
    }
    this.ws.onclose = () => {
      if (this.closed) return
      this.closed = true
      this.onClose?.(this.room ? 'Lost connection to the race server' : "Couldn't reach the race server")
    }
  }

  /** Opens a connection; resolves once it's open, or rejects. */
  static connect(url: string): Promise<Session> {
    const session = new Session(url)
    return new Promise((resolve, reject) => {
      session.ws.addEventListener('open', () => resolve(session), { once: true })
      session.ws.addEventListener('error', () => reject(new Error("Couldn't reach the race server")), { once: true })
    })
  }

  get isHost() {
    return !!this.room && this.room.hostId === this.you
  }

  send(msg: ClientMessage) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  /** Sends your position, at most every STATE_INTERVAL_MS. */
  sendState(state: DuckState) {
    const now = performance.now()
    if (now - this.lastState < STATE_INTERVAL_MS) return
    this.lastState = now
    this.send({ type: 'state', ...state })
  }

  close() {
    this.closed = true
    this.ws.close()
  }
}

/** The relay's address: `override`, or /race on the server that served the game. */
export function raceServerUrl(override?: string | null) {
  // The dev server compiles import.meta.url to a file:// path, so there use the page
  const base = process.env.NODE_ENV === 'development' ? location.href : import.meta.url
  const url = new URL(override || '/race', base)
  if (url.protocol === 'http:') url.protocol = 'ws:'
  if (url.protocol === 'https:') url.protocol = 'wss:'
  return url.href
}
