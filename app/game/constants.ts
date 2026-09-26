/** All distances in meters, time in seconds. The hoop sits at the z = 0 end. */
export const COURT = {
  halfWidth: 7.5,
  /** Half-court line */
  length: 14,
  rimHeight: 3.05,
  rimRadius: 0.2286,
  rimZ: 1.575,
  backboardZ: 1.2,
  backboardHalfWidth: 0.915,
  backboardBottom: 2.9,
  backboardTop: 3.97,
  threeRadius: 6.75,
  threeCornerX: 6.6,
  laneHalfWidth: 2.45,
  laneLength: 5.8,
  checkZ: 9.2,
} as const;

export const BALL_RADIUS = 0.12;
export const GRAVITY = 9.81;

export const RIM_CENTER = { x: 0, y: COURT.rimHeight, z: COURT.rimZ };

/** Corner three straight lines end where they meet the arc */
export const THREE_CORNER_Z = COURT.rimZ + Math.sqrt(COURT.threeRadius ** 2 - COURT.threeCornerX ** 2);

export function isThreePoint(x: number, z: number): boolean {
  if (z <= THREE_CORNER_Z) return Math.abs(x) >= COURT.threeCornerX;
  return Math.hypot(x, z - COURT.rimZ) >= COURT.threeRadius;
}

export function distToRim(x: number, z: number): number {
  return Math.hypot(x, z - COURT.rimZ);
}

export const SHOT_CLOCK = 14;
