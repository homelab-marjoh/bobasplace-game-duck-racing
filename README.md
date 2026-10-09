# bobasplace-game-duck-racing

Microfrontend for Boba's Place duck racing (Pixi + Rapier): top-down races on water courses, alone
against the clock or online against friends. Builds to a single ES module, `game.js`, that registers
a `<bobas-game>` custom element. Any page can load it at runtime from this app's own deployment,
which also hosts the online race relay.

```html
<script type="module" src="https://game.bobasplace.se/game.js"></script>
<bobas-game></bobas-game>
```

- The element fills its parent (100% × 100%), but never below a minimum size (320×240 by default; set `--bobas-game-min-width` / `--bobas-game-min-height` on `bobas-game`). The parent needs a definite height, otherwise the game falls back to the minimum. The canvas resizes with the element and
  lives in a shadow root. The `debug` attribute draws the physics colliders.
- There are several courses (`src/game/track/courses.ts`: shape, width, laps and colours each). The
  start and finish screens are a menu: left/right (or a tap near the screen's edge) picks a course,
  space/Enter/tap starts a 3-2-1 countdown. Each course keeps its own best time in `localStorage`,
  and the menu opens on the course played last; `<bobas-game track="clover-creek">` overrides that.
  When Boba finishes, the element dispatches a bubbling `race-finish` event with
  `detail: { track, time, best, newBest, laps, online }` (times in ms).
- Online: "Race online" on the menu opens a panel to create a room (you get a 4-letter code) or
  join one, with a nickname. Up to 8 ducks; the host picks the course and starts, everyone gets
  the same countdown, and results come in when all have finished (or 45 s after the first one
  does). Each browser runs its own duck and sends its position 20 times a second; rivals are
  drawn slightly in the past, interpolated between updates, and ducks pass through each other.
  Times are reported by the clients, so a determined cheat can fake one.
- Keyboard: `w`/`s` (or up/down) paddle and brake/reverse, `a`/`d` (or left/right) steer. Only those
  keys are intercepted (plus space/Enter to start), and never while typing in an input. On touch or
  with the mouse, hold anywhere and Boba paddles toward that point.
- `src/game/config.ts` holds the tunables: Boba's handling, wake, camera and settings shared by all
  courses. `createGame()` in `src/game/game.ts` wires everything up and runs the race; its
  handle's `destroy()` is safe at any time and frees the Pixi app and Rapier world. The rest of
  `src/game/`:
  - `track/`: the course definitions (`courses.ts`), a course's shape and bank colliders
    (`track.ts`), how it's drawn (`scenery.ts`) and the curve maths (`geometry.ts`). A new course's
    curves must stay wider than half its width, or the inner bank folds over itself.
  - `entities/`: Boba's movement (`boba.ts`) and drawing (`duck.ts`), and the wake ripples.
  - `input/controls.ts`: keyboard and pointer, turned into throttle and steering.
  - `race/`: lap counting and the race clock (`lapCounter.ts`), and what's kept in `localStorage`.
  - `online/`: the message protocol shared with the relay, the connection, rival ducks and the
    lobby panel (HTML over the canvas).
  - `ui/`: the HUD and minimap. `camera.ts` follows Boba and shakes; `debug.ts` draws colliders.
- `server/`: `relay.ts` is the race relay (rooms, start, positions, results); `serve.ts` is the
  production server, which serves `dist/` with CORS for the embedding pages and the relay on `/race`.
  Set `ALLOWED_ORIGINS` (comma-separated, default `https://bobasplace.se`) for the pages allowed to
  load the game and join races, and `PORT` (default 80). The game connects to `/race` next to
  `game.js` unless `<bobas-game server="wss://…/race">` says otherwise.
- Everything is drawn with Pixi graphics; there are no image assets. Anything put in `public/` is
  copied next to `game.js`.
- `bun run dev` serves a harness page (`index.html`) with the element and the relay
  (`PORT=5199 bun run dev` for another port); `bun run build` writes `dist/`.
