import { existsSync } from 'node:fs'
import { cp, rm } from 'node:fs/promises'

// Library build: one ES module (Pixi + Rapier bundled) that registers the
// <duck-race> custom element when imported. public/, if any, is copied alongside it.
// No code splitting: game.js has a stable name, so lazy chunks would 404 for
// anyone holding a cached copy after a redeploy.
await rm('dist', { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ['src/main.ts'],
  outdir: 'dist',
  naming: 'game.js',
  target: 'browser',
  format: 'esm',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

if (existsSync('public')) await cp('public', 'dist', { recursive: true })
