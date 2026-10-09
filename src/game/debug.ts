import type RAPIER from '@dimforge/rapier2d-compat'
import { Graphics } from 'pixi.js'
import { SCALE } from './config'

/** Outlines of every physics collider, redrawn each frame (the `debug` attribute). */
export class PhysicsDebug extends Graphics {
  draw(world: RAPIER.World) {
    const { vertices, colors } = world.debugRender()
    this.clear()
    for (let i = 0; i < vertices.length / 4; i++) {
      const alpha = colors[i * 8 + 3]
      this.moveTo(vertices[i * 4] * SCALE, vertices[i * 4 + 1] * SCALE)
        .lineTo(vertices[i * 4 + 2] * SCALE, vertices[i * 4 + 3] * SCALE)
        .stroke({ width: 2, color: 0xff00ff, alpha: Number.isFinite(alpha) ? alpha : 1 })
    }
  }
}
