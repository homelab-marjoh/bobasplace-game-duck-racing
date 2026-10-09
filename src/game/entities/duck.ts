import { Graphics } from 'pixi.js'

/** Your duck's yellow; other racers get one of `RIVAL_COLORS`. */
export const PLAYER_COLOR = 0xffd23f
// No yellows, so nobody looks like you
export const RIVAL_COLORS = [0x4da3ff, 0xff7eb6, 0x5bd16f, 0xa77bff, 0xff8a3d, 0xff5a5a, 0x3fd9c9, 0xf2f2f2]

/** A top-down duck of `color` facing +x, about 2.2 units long, centred on its body. */
export function drawDuck(color = PLAYER_COLOR) {
  return new Graphics()
    .ellipse(3, 4, 26, 18)
    .fill({ color: 0x000000, alpha: 0.18 }) // shadow on the water
    .poly([-31, 0, -19, -9, -19, 9])
    .fill(shade(color, 0.86)) // tail
    .ellipse(-4, 0, 24, 17)
    .fill(color) // body
    .ellipse(-8, -10, 14, 6)
    .fill(shade(color, 0.92)) // wings
    .ellipse(-8, 10, 14, 6)
    .fill(shade(color, 0.92))
    .circle(14, 0, 11)
    .fill(shade(color, 1.06)) // head
    .ellipse(26, 0, 7, 4.5)
    .fill(0xff8c1a) // beak
    .circle(18, -6, 2.2)
    .fill(0x1a1a1a) // eyes
    .circle(18, 6, 2.2)
    .fill(0x1a1a1a)
}

// Scales each channel; above 1 lightens
function shade(color: number, factor: number) {
  const channel = (shift: number) => Math.min(255, Math.round(((color >> shift) & 0xff) * factor)) << shift
  return channel(16) | channel(8) | channel(0)
}
