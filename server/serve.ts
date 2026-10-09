import { raceSocket, upgradeRace, type Connection } from './relay'

// Production server: serves the built bundle (dist/) to embedding pages and hosts the race
// relay on /race, so online play needs no extra deployment.

const PORT = Number(process.env.PORT) || 80
// Pages allowed to load game.js and connect to the relay (comma-separated)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'https://bobasplace.se').split(',').map((o) => o.trim())
const DIST = `${import.meta.dir}/../dist`

const server = Bun.serve<Connection>({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url)
    const origin = req.headers.get('origin')

    if (url.pathname === '/race') {
      // Browsers let any page open a WebSocket, so check who's asking
      if (origin && !ALLOWED_ORIGINS.includes(origin) && origin !== url.origin) {
        return new Response('Forbidden', { status: 403 })
      }
      return upgradeRace(req, server) ? undefined : new Response('Expected a WebSocket', { status: 400 })
    }

    // Only plain file names from dist/, nothing nested
    const name = url.pathname.slice(1)
    if (!/^[\w.-]+$/.test(name) || name.startsWith('.')) return new Response('Not found', { status: 404 })
    const file = Bun.file(`${DIST}/${name}`)
    if (!(await file.exists())) return new Response('Not found', { status: 404 })

    const headers = new Headers({
      // game.js has a stable name, so always revalidate it
      'Cache-Control': name === 'game.js' ? 'no-cache' : 'public, max-age=604800',
    })
    // Host pages load the bundle cross-origin as an ES module
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin)
      headers.set('Vary', 'Origin')
    }
    return new Response(file, { headers })
  },
  websocket: raceSocket,
})

console.log(`Serving game and race relay on ${server.url}`)
