import { createGame, type Game } from './game/game'

// <duck-race [track="clover-creek"] [server="wss://…/race"] [debug]></duck-race>
// Fires a `race-finish` CustomEvent ({ track, time, best, newBest, laps, online }, times in ms)
// when your duck crosses the line on the last lap.
// The element fills its parent (100% x 100%) but never shrinks below
// --duck-race-min-width / --duck-race-min-height (default 320px x 240px); the parent
// needs a definite height, otherwise the element falls back to the minimum. The canvas
// follows the element's size. It lives in a shadow root so the host page's styles
// can't affect it. `track` picks the course the menu opens on (a course id; defaults to
// the last one played). `server` is the online race relay (defaults to /race next to the
// bundle). `debug` draws physics colliders.
const STYLE = `
  :host {
    display: block;
    width: 100%;
    height: 100%;
    min-width: var(--duck-race-min-width, 320px);
    min-height: var(--duck-race-min-height, 240px);
  }
  /* Out of flow, so the canvas can't hold the element open when its parent shrinks */
  .mount { position: relative; width: 100%; height: 100%; overflow: hidden; }
  canvas { position: absolute; inset: 0; }
`

class DuckRaceElement extends HTMLElement {
  static observedAttributes = ['debug', 'track', 'server']

  private game?: Game
  private connected = false

  connectedCallback() {
    this.connected = true
    void this.start()
  }

  disconnectedCallback() {
    this.connected = false
    this.stop()
  }

  attributeChangedCallback() {
    if (!this.connected) return
    this.stop()
    void this.start()
  }

  private async start() {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = STYLE
    const mount = document.createElement('div')
    mount.className = 'mount'
    shadow.replaceChildren(style, mount)

    const game = await createGame(mount, {
      debug: this.hasAttribute('debug'),
      track: this.getAttribute('track'),
      server: this.getAttribute('server'),
      onFinish: (detail) =>
        this.dispatchEvent(new CustomEvent('race-finish', { detail, bubbles: true, composed: true })),
    })
    // Removed, or restarted by an attribute change, while still loading
    if (!this.connected || mount.parentNode !== shadow) game.destroy()
    else this.game = game
  }

  private stop() {
    this.game?.destroy()
    this.game = undefined
    this.shadowRoot?.replaceChildren()
  }
}

if (!customElements.get('duck-race')) {
  customElements.define('duck-race', DuckRaceElement)
}
