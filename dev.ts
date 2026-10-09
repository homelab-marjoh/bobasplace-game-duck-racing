import index from './index.html'
import { raceSocket, upgradeRace, type Connection } from './server/relay'

// Dev harness: bundles index.html on request with hot reload, hosts the race relay on
// /race, and serves public/ at the root like the production deployment does.
const server = Bun.serve<Connection>({
  port: Number(process.env.PORT) || 5173,
  development: true,
  routes: { '/': index },
  async fetch(req, server) {
    const { pathname } = new URL(req.url)
    if (pathname === '/race') {
      return upgradeRace(req, server) ? undefined : new Response('Expected a WebSocket', { status: 400 })
    }
    const file = Bun.file(`public${pathname}`)
    return (await file.exists()) ? new Response(file) : new Response('Not found', { status: 404 })
  },
  websocket: raceSocket,
})

console.log(`Game dev harness on ${server.url}`)
