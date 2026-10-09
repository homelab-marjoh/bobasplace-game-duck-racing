export interface Theme {
  grass: number
  grassDark: number
  bush: number
  sand: number
  water: number
  waterLight: number
  reed: number
}

export interface Course {
  /** Stable id: used for the `track` attribute, the stored best time and the finish event. */
  id: string
  name: string
  /**
   * Closed loop of control points (physics units, y down), smoothed into a curve.
   * The first point is the start/finish line and the course runs toward the second.
   * Keep curves gentler than half the width, or the inner bank folds over itself.
   */
  points: [number, number][]
  /** Water width, physics units. */
  width: number
  laps: number
  theme: Theme
}

const SPRING: Theme = {
  grass: 0x5fa548,
  grassDark: 0x4a8c38,
  bush: 0x3b7a2e,
  sand: 0xe8d39a,
  water: 0x3d9bd6,
  waterLight: 0x6cc0ee,
  reed: 0x7a5a2e,
}

export const COURSES: Course[] = [
  {
    id: 'duck-pond',
    name: 'Duck Pond',
    points: [
      [0, 0], [30, -4], [55, 2], [68, 18], [62, 36], [44, 40], [30, 32], [16, 36],
      [6, 50], [-16, 55], [-34, 45], [-38, 25], [-26, 10],
    ],
    width: 9,
    laps: 3,
    theme: SPRING,
  },
  {
    // A wide, fast oval: room to hold full speed through the bends
    id: 'big-lake',
    name: 'Big Lake',
    points: [
      [0, 0], [40, 0], [70, 6], [88, 26], [84, 52], [60, 64], [30, 58], [0, 64],
      [-26, 56], [-36, 30], [-24, 8],
    ],
    width: 11,
    laps: 3,
    theme: {
      ...SPRING,
      grass: 0x7cb85a,
      grassDark: 0x66a046,
      water: 0x2f86c9,
      waterLight: 0x5fb0e8,
    },
  },
  {
    // Three lobes; the narrow necks between them punish a wide line
    id: 'clover-creek',
    name: 'Clover Creek',
    points: [
      [16, 24], [7, 34], [-9, 47], [-30, 47], [-41, 31], [-36, 12], [-31, 0], [-36, -12],
      [-41, -31], [-30, -47], [-9, -47], [7, -34], [16, -24], [30, -22], [50, -16], [61, 0],
      [50, 16], [30, 22],
    ],
    width: 8,
    laps: 3,
    theme: {
      grass: 0x9aa645,
      grassDark: 0x7f8a35,
      bush: 0xc0662b,
      sand: 0xd9b98a,
      water: 0x3a7fa8,
      waterLight: 0x5e9fc4,
      reed: 0x6b4a24,
    },
  },
  {
    // Four lobes and the longest lap, so one lap fewer
    id: 'lily-lagoon',
    name: 'Lily Lagoon',
    points: [
      [35, 18], [30, 29], [22, 48], [0, 53], [-18, 39], [-26, 25], [-42, 21], [-68, 16],
      [-75, 0], [-56, -13], [-35, -18], [-30, -29], [-22, -48], [0, -53], [18, -39], [26, -25],
      [42, -21], [68, -16], [75, 0], [56, 13],
    ],
    width: 8,
    laps: 2,
    theme: {
      grass: 0x4fae6a,
      grassDark: 0x3c9456,
      bush: 0x2f7d47,
      sand: 0xf3e2b0,
      water: 0x1fb5b0,
      waterLight: 0x63d8d0,
      reed: 0x7a5a2e,
    },
  },
]

/** The course with `id`, or the first one. */
export function findCourse(id: string | null | undefined): number {
  return Math.max(0, COURSES.findIndex((c) => c.id === id))
}
