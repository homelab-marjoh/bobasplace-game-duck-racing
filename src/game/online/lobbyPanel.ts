import { BOBA_COLOR, RIVAL_COLORS } from '../entities/duck'
import { COURSES } from '../track/courses'
import { formatTime } from '../ui/hud'
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH, type ResultEntry, type RoomInfo } from './protocol'

const STYLE = `
  .lobby {
    position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
    width: min(340px, calc(100% - 24px)); box-sizing: border-box;
    padding: 12px 14px; border-radius: 10px;
    background: rgba(0, 0, 0, 0.62); color: #fff;
    font: 15px/1.35 system-ui, sans-serif;
  }
  .lobby[hidden] { display: none; }
  .lobby .row { display: flex; gap: 8px; margin-top: 8px; }
  .lobby input {
    flex: 1; min-width: 0; padding: 7px 9px; border: 0; border-radius: 6px;
    font: inherit; background: #fff; color: #111;
  }
  .lobby input.code { flex: 0 0 5.5em; text-transform: uppercase; letter-spacing: 0.15em; }
  .lobby button {
    padding: 7px 12px; border: 0; border-radius: 6px; cursor: pointer;
    font: inherit; font-weight: 600; background: #ffd23f; color: #222;
  }
  .lobby button.quiet { background: rgba(255, 255, 255, 0.18); color: #fff; }
  .lobby button:disabled { opacity: 0.5; cursor: default; }
  .lobby .title { font-weight: 700; font-size: 17px; }
  .lobby .code-big { font-size: 22px; letter-spacing: 0.2em; font-weight: 700; color: #ffd23f; }
  .lobby .muted { opacity: 0.75; font-size: 13px; }
  .lobby .error { color: #ff9a9a; margin-top: 6px; }
  .lobby ol, .lobby ul { margin: 8px 0 0; padding-left: 1.4em; }
  .lobby ul { list-style: none; padding-left: 0; }
  .lobby .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
  .lobby .spread { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
`

type View = 'button' | 'form' | 'room' | 'hidden'

/**
 * The online lobby, as HTML over the canvas: a "Race online" button, then a form to
 * create or join a room, then the room itself (code, players, results, start/leave).
 */
export class LobbyPanel {
  onCreate?: (name: string) => void
  onJoin?: (code: string, name: string) => void
  onStart?: () => void
  onLeave?: () => void

  private root = document.createElement('div')
  private style = document.createElement('style')
  private defaultName: string

  constructor(container: HTMLElement, defaultName: string) {
    this.defaultName = defaultName
    this.style.textContent = STYLE
    this.root.className = 'lobby'
    container.append(this.style, this.root)
    this.showButton()
  }

  /** Just the way in: shown on the solo menu. */
  showButton(error = '') {
    this.render('button', `
      <div class="spread">
        <span>Race friends online</span>
        <button data-action="open">Race online</button>
      </div>
      ${error ? `<div class="error">${escape(error)}</div>` : ''}
    `)
  }

  showForm(error = '') {
    this.render('form', `
      <div class="title">Race online</div>
      <div class="row"><input class="name" maxlength="${MAX_NAME_LENGTH}" placeholder="Your name" value="${escape(this.defaultName)}"></div>
      <div class="row"><button data-action="create" style="flex:1">Create a room</button></div>
      <div class="row">
        <input class="code" maxlength="${ROOM_CODE_LENGTH}" placeholder="CODE" autocapitalize="characters">
        <button data-action="join" style="flex:1">Join room</button>
      </div>
      <div class="row"><button class="quiet" data-action="cancel">Back</button></div>
      ${error ? `<div class="error">${escape(error)}</div>` : ''}
    `)
    this.root.querySelector<HTMLInputElement>('input.name')?.focus()
  }

  /** Connecting or waiting on the server. */
  showBusy(text: string) {
    this.render('form', `<div>${escape(text)}</div>`)
  }

  /** The room you're in; `results` once a race in it has been called. */
  showRoom(room: RoomInfo, you: string, results: ResultEntry[] | null) {
    const host = room.players.find((p) => p.id === room.hostId)
    const isHost = room.hostId === you
    const course = COURSES.find((c) => c.id === room.course)?.name ?? room.course
    const players = room.players
      .map((p) => {
        const color = p.id === you ? BOBA_COLOR : RIVAL_COLORS[p.color % RIVAL_COLORS.length]
        const tags = [p.id === you && 'you', p.id === room.hostId && 'host'].filter(Boolean).join(', ')
        return `<li><span class="dot" style="background:#${color.toString(16).padStart(6, '0')}"></span>${escape(p.name)}${tags ? ` <span class="muted">(${tags})</span>` : ''}</li>`
      })
      .join('')
    const resultList = results
      ? `<div class="title" style="margin-top:10px">Results</div><ol>${results
          .map((r) => `<li>${escape(r.name)}${r.id === you ? ' <span class="muted">(you)</span>' : ''} — ${r.time === null ? 'DNF' : formatTime(r.time)}</li>`)
          .join('')}</ol>`
      : ''
    const status =
      room.phase === 'racing'
        ? '<div class="muted">A race is on; you\'ll be in the next one</div>'
        : isHost
          ? '<div class="muted">◀ ▶ picks the course</div>'
          : `<div class="muted">Waiting for ${escape(host?.name ?? 'the host')} to start</div>`
    this.render('room', `
      <div class="spread">
        <span>Room <span class="code-big">${room.code}</span></span>
        <span class="muted">${escape(course)}</span>
      </div>
      <ul>${players}</ul>
      ${resultList}
      <div class="row" style="align-items:center">${status}</div>
      <div class="row">
        ${isHost ? `<button data-action="start" style="flex:1" ${room.phase === 'racing' ? 'disabled' : ''}>${results ? 'Race again' : 'Start race'}</button>` : ''}
        <button class="quiet" data-action="leave" ${isHost ? '' : 'style="flex:1"'}>Leave</button>
      </div>
    `)
  }

  hide() {
    this.render('hidden', '')
  }

  destroy() {
    this.root.remove()
    this.style.remove()
  }

  private render(view: View, html: string) {
    this.root.hidden = view === 'hidden'
    this.root.innerHTML = html
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
      button.addEventListener('click', () => this.act(button.dataset.action!))
    }
    // Enter in a field does that row's job
    this.root.querySelector('input.name')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') this.act('create')
    })
    this.root.querySelector('input.code')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') this.act('join')
    })
  }

  private act(action: string) {
    const name = this.root.querySelector<HTMLInputElement>('input.name')?.value.trim() ?? ''
    const code = this.root.querySelector<HTMLInputElement>('input.code')?.value.trim().toUpperCase() ?? ''
    if (action === 'create' || action === 'join') {
      if (!name) return this.showForm('Pick a name first')
      if (action === 'join' && code.length !== ROOM_CODE_LENGTH) return this.showForm('Room codes are 4 letters')
      this.defaultName = name
    }
    if (action === 'open') this.showForm()
    else if (action === 'cancel') this.showButton()
    else if (action === 'create') this.onCreate?.(name)
    else if (action === 'join') this.onJoin?.(code, name)
    else if (action === 'start') this.onStart?.()
    else if (action === 'leave') this.onLeave?.()
  }
}

function escape(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
