// Pixels per physics unit
export const SCALE = 30

// Physics runs at a fixed rate so gameplay doesn't depend on the display refresh rate
export const FIXED_DT = 1 / 60
export const MAX_FRAME_TIME = 0.1

// Seconds of 3-2-1 before the clock starts
export const COUNTDOWN = 3
// localStorage keys: best times get the course id appended
export const BEST_TIME_KEY = 'duck-race:best-time'
export const LAST_TRACK_KEY = 'duck-race:track'
export const NAME_KEY = 'duck-race:name'

// Shared by every course; the courses themselves are in track/courses.ts
export const TRACK = {
  // Sand strip drawn outside the water on each side
  bank: 0.8,
  // Spacing of the progress samples along the centreline
  sampleSpacing: 0.5,
  // Your duck starts this far behind the line
  startBehind: 3,
  // Distance between rows on the starting grid in online races
  gridRowGap: 3,
  // Grass beyond the course's bounding box
  margin: 40,
  decorSeed: 7,
  // Grass tufts, bushes and flowers per square unit
  decorDensity: 0.027,
}

// Speeds are in physics units/s, accelerations in units/s^2, turning in radians/s
export const PLAYER = {
  radius: 0.8,
  maxSpeed: 16,
  accel: 12,
  brake: 28,
  reverseAccel: 8,
  maxReverse: 5,
  // Slow-down while coasting
  drag: 4,
  turnRate: 3,
  // Steering only gets full authority from this speed up, so your duck can't spin on the spot
  turnRefSpeed: 5,
  // How fast sideways drift dies out (1/s); lower is slidier
  grip: 4,

  anim: {
    waddlePerSpeed: 0.9, // waddle cycles/s per unit of speed
    waddleRadians: 0.07,
  },
}

export const WAKE = {
  spacing: 0.9, // units travelled between ripples
  tailOffset: 0.9, // ripples start this far behind your duck's centre
  minSpeed: 1.5,
  life: 0.9, // seconds
  startRadius: 0.35,
  growth: 1.4, // units/s
  alpha: 0.5,
}

export const CAMERA = {
  // Units visible across the screen's shorter side
  viewSize: 20,
  // Looks ahead of your duck by this many seconds of velocity
  lookahead: 0.35,
  smoothing: 6,
}
