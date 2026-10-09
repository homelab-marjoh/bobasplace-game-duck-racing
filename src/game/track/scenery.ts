import { Container, Graphics } from 'pixi.js'
import { SCALE, TRACK } from '../config'
import { mulberry32 } from './geometry'
import type { Track } from './track'

const px = (units: number) => units * SCALE

/** Everything you see of the course: grass, water channel, reeds and the finish line. */
export function createScenery(track: Track): Container {
  const scenery = new Container()
  scenery.addChild(drawGround(track), drawWater(track), drawReeds(track), drawFinishLine(track))
  return scenery
}

function drawWater(track: Track) {
  const { theme, width } = track.course
  const path = track.samples.flatMap((p) => [px(p.x), px(p.y)])
  return (
    new Graphics()
      .poly(path, true)
      .stroke({ width: px(width + TRACK.bank * 2), color: theme.sand, join: 'round' })
      .poly(path, true)
      .stroke({ width: px(width), color: theme.water, join: 'round' })
      // Lighter, shallower-looking middle
      .poly(path, true)
      .stroke({ width: px(width * 0.45), color: theme.waterLight, alpha: 0.35, join: 'round' })
  )
}

// Grass out past the course, scattered with tufts, bushes and flowers
function drawGround(track: Track) {
  const { theme, width } = track.course
  const { minX, minY, maxX, maxY } = track.bounds
  const m = TRACK.margin
  const g = new Graphics()
    .rect(px(minX - m), px(minY - m), px(maxX - minX + m * 2), px(maxY - minY + m * 2))
    .fill(theme.grass)

  const random = mulberry32(TRACK.decorSeed)
  const spread = TRACK.margin * 0.6
  const area = (maxX - minX + spread * 2) * (maxY - minY + spread * 2)
  for (let i = 0; i < area * TRACK.decorDensity; i++) {
    const p = {
      x: minX - spread + random() * (maxX - minX + spread * 2),
      y: minY - spread + random() * (maxY - minY + spread * 2),
    }
    // Keep clear of the water and its sand
    if (track.distanceToCentre(p) < width / 2 + TRACK.bank + 1.5) continue
    const x = px(p.x)
    const y = px(p.y)
    const kind = random()
    if (kind < 0.7) {
      // Grass tuft
      for (let k = 0; k < 3; k++) g.circle(x + (k - 1) * 5, y + (k % 2) * 3, 4).fill(theme.grassDark)
    } else if (kind < 0.9) {
      // Bush
      const r = 14 + random() * 12
      g.circle(x, y, r).fill(theme.bush)
      g.circle(x - r * 0.3, y - r * 0.3, r * 0.45).fill({ color: theme.grassDark, alpha: 0.8 })
    } else {
      // Flower
      const petal = random() < 0.5 ? 0xffffff : 0xffa3c4
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        g.circle(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3).fill(petal)
      }
      g.circle(x, y, 2.5).fill(0xffd23f)
    }
  }
  return g
}

// Clumps of cattails on the sand, alternating sides along the course
function drawReeds(track: Track) {
  const { theme, width } = track.course
  const random = mulberry32(TRACK.decorSeed + 1)
  const g = new Graphics()
  for (let i = 0; i < track.count; i += 9) {
    if (random() < 0.45) continue
    const side = random() < 0.5 ? 1 : -1
    const p = track.offset(i, side * (width / 2 + TRACK.bank * 0.5))
    // Skip spots where another part of the course runs close by
    if (track.distanceToCentre(p) < width / 2 + TRACK.bank * 0.3) continue
    for (let k = 0; k < 4; k++) {
      const x = px(p.x) + (random() - 0.5) * 18
      const y = px(p.y) + (random() - 0.5) * 18
      g.circle(x, y, 5).fill(theme.grassDark).ellipse(x, y, 2.5, 4).fill(theme.reed)
    }
  }
  return g
}

// Two columns of checkers across the water at sample 0
function drawFinishLine(track: Track) {
  const { width } = track.course
  const cell = px(0.6)
  const half = px(width / 2)
  const g = new Graphics()
  for (let col = 0; col < 2; col++) {
    for (let row = 0; row * cell < half * 2; row++) {
      const y = -half + row * cell
      g.rect((col - 1) * cell, y, cell, Math.min(cell, half - y)).fill((row + col) % 2 ? 0xffffff : 0x222222)
    }
  }
  g.position.set(px(track.samples[0].x), px(track.samples[0].y))
  g.rotation = track.headingAt(0)
  return g
}
