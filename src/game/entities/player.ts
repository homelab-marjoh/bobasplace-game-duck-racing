import RAPIER from '@dimforge/rapier2d-compat'
import { Container } from 'pixi.js'
import { PLAYER, SCALE } from '../config'
import type { DriveInput } from '../input/controls'
import type { Point } from '../track/geometry'
import { drawDuck } from './duck'

/**
 * The player's duck, seen from above: it paddles like a slidey car. Heading is tracked here
 * rather than by the physics body, so bumping a bank never spins it around.
 */
export class Player extends Container {
  rigidBody: RAPIER.RigidBody
  collider: RAPIER.Collider

  private heading = 0
  // Signed speed along the heading, from the last physics step
  private forwardSpeed = 0
  private prev = { x: 0, y: 0, heading: 0 }
  private curr = { x: 0, y: 0, heading: 0 }
  private duck = drawDuck()
  private waddle = 0

  constructor(world: RAPIER.World) {
    super()
    this.addChild(this.duck)

    // Rotation is locked: the heading is ours. CCD keeps a fast duck out of the banks.
    this.rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().lockRotations().setCcdEnabled(true))
    // No friction, so your duck slides along a bank instead of sticking to it
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.ball(PLAYER.radius).setFriction(0).setRestitution(0.3),
      this.rigidBody,
    )
    this.collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
  }

  /** Absolute speed along the heading, physics units/s. */
  get speed() {
    return Math.abs(this.forwardSpeed)
  }

  /** Rendered (interpolated) velocity, physics units/s. */
  get velocity(): Point {
    return { x: Math.cos(this.rotation) * this.forwardSpeed, y: Math.sin(this.rotation) * this.forwardSpeed }
  }

  /** Physics position, in physics units. */
  get physicsPosition(): Point {
    return this.rigidBody.translation()
  }

  /** Physics heading, radians. */
  get physicsHeading() {
    return this.heading
  }

  /** Rendered (interpolated) position, in physics units. */
  get renderedPosition(): Point {
    return { x: this.x / SCALE, y: this.y / SCALE }
  }

  reset(x: number, y: number, heading: number) {
    this.rigidBody.setTranslation({ x, y }, true)
    this.rigidBody.setLinvel({ x: 0, y: 0 }, true)
    this.heading = heading
    this.forwardSpeed = 0
    this.prev = { x, y, heading }
    this.curr = { x, y, heading }
    this.update()
  }

  /** Applies input to the body; call once per fixed physics step, right before it. */
  preStep(dt: number, { throttle, steer }: DriveInput) {
    const { x, y } = this.rigidBody.translation()
    this.prev = this.curr
    this.curr = { x, y, heading: this.heading }
    const vel = this.rigidBody.linvel()

    // Steering needs speed, and flips when reversing like a car
    const fwdBefore = vel.x * Math.cos(this.heading) + vel.y * Math.sin(this.heading)
    const authority = Math.max(-1, Math.min(fwdBefore / PLAYER.turnRefSpeed, 1))
    this.heading += steer * PLAYER.turnRate * authority * dt

    // Split the velocity along the new heading: the sideways part is drift, which
    // dies out at the grip rate, so turns slide a little
    const fx = Math.cos(this.heading)
    const fy = Math.sin(this.heading)
    let fwd = vel.x * fx + vel.y * fy
    const side = (-vel.x * fy + vel.y * fx) * Math.exp(-PLAYER.grip * dt)

    if (throttle > 0) {
      fwd = Math.min(fwd + (fwd < 0 ? PLAYER.brake : PLAYER.accel) * dt, PLAYER.maxSpeed)
    } else if (throttle < 0) {
      fwd = fwd > 0 ? fwd - PLAYER.brake * dt : Math.max(fwd - PLAYER.reverseAccel * dt, -PLAYER.maxReverse)
    } else {
      const step = PLAYER.drag * dt
      fwd = Math.abs(fwd) <= step ? 0 : fwd - Math.sign(fwd) * step
    }

    this.forwardSpeed = fwd
    this.rigidBody.setLinvel({ x: fx * fwd - fy * side, y: fy * fwd + fx * side }, true)
  }

  /**
   * Syncs the drawing; `alpha` (0..1) interpolates between the last two physics steps and
   * `dt` is the frame time in seconds, which drives the waddle.
   */
  update(alpha = 1, dt = 0) {
    const x = this.prev.x + (this.curr.x - this.prev.x) * alpha
    const y = this.prev.y + (this.curr.y - this.prev.y) * alpha
    this.position.set(x * SCALE, y * SCALE)
    this.rotation = this.prev.heading + (this.curr.heading - this.prev.heading) * alpha

    this.waddle += dt * this.speed * PLAYER.anim.waddlePerSpeed * Math.PI * 2
    if (this.speed < 0.3) this.waddle = 0
    this.duck.rotation = Math.sin(this.waddle) * PLAYER.anim.waddleRadians
  }
}
