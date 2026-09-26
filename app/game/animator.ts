import * as THREE from "three";
import { arc, clamp, lerp, smooth } from "./math";
import { createPose, type PoseTargets, type Proportions } from "./rig";

/**
 * Procedural basketball animation. Every function writes IK targets in
 * character space (x = left, y = up, z = forward) scaled to the rig's
 * measured proportions, so the same moves fit a 5'11" guard or a 6'9" big.
 */

export type Hand = "L" | "R";

export interface AnimInput {
  t: number;
  /** Local-space velocity (x = left, z = forward), m/s */
  velLocal: THREE.Vector2;
  speed: number;
  /** Stride phase accumulator (cycles) */
  stride: number;
  hasBall: boolean;
  dribbleHand: Hand;
  /** 0..1 dribble phase */
  dribble: number;
  defending: boolean;
  crouch: number;
}

export interface AnimOutput {
  pose: PoseTargets;
  /** Where the ball should be (character space) when held */
  ball: THREE.Vector3;
}

const side = (h: Hand) => (h === "L" ? 1 : -1);

export function restPose(p: Proportions, out: PoseTargets = createPose()) {
  out.hipsOffset.set(0, 0, 0);
  out.hipsRot.set(0, 0, 0);
  out.spineRot.set(0, 0, 0);
  out.headRot.set(0, 0, 0);
  out.handL.set(p.shoulderHalf + 0.05, p.shoulderY - p.armLen * 0.975, 0.06);
  out.handR.set(-(p.shoulderHalf + 0.05), p.shoulderY - p.armLen * 0.975, 0.06);
  out.footL.set(p.hipHalf * 1.2, p.ankleY, 0);
  out.footR.set(-p.hipHalf * 1.2, p.ankleY, 0);
  out.elbowPoleL.set(0.2, 0, -1);
  out.elbowPoleR.set(-0.2, 0, -1);
  out.kneePoleL.set(0.12, 0, 1);
  out.kneePoleR.set(-0.12, 0, 1);
  out.footYawL = 0.12;
  out.footYawR = -0.12;
  return out;
}

/** Athletic stance with feet under the hips */
function stance(p: Proportions, out: PoseTargets, crouch: number, width = 1) {
  restPose(p, out);
  const drop = crouch * p.legLen * 0.16;
  out.hipsOffset.y = -drop;
  out.hipsRot.x = crouch * 0.18;
  out.spineRot.x = crouch * 0.12;
  out.headRot.x = -crouch * 0.1;
  out.footL.x = p.hipHalf * (1.5 + width * 0.9);
  out.footR.x = -p.hipHalf * (1.5 + width * 0.9);
}

/** Idle / breathing, optional ball on hip */
export function idle(p: Proportions, t: number, out: PoseTargets, ball?: THREE.Vector3) {
  stance(p, out, 0.25, 0.4);
  const br = Math.sin(t * 1.7);
  out.hipsOffset.y += br * 0.006;
  out.spineRot.x += br * 0.015;
  out.headRot.y = Math.sin(t * 0.37) * 0.15;
  if (ball) {
    ball.set(-(p.shoulderHalf + 0.16), p.hipY - 0.02, 0.1);
    out.handR.set(ball.x - 0.02, ball.y + 0.1, ball.z);
    out.elbowPoleR.set(-1, 0, -0.3);
  }
}

/** Run / shuffle cycle — feet travel along the local velocity direction */
export function locomotion(p: Proportions, a: AnimInput, out: PoseTargets) {
  const sp = a.speed;
  const run = clamp(sp / 6.5, 0, 1);
  const crouch = a.defending ? 0.9 : a.hasBall ? 0.55 : 0.3;
  stance(p, out, lerp(crouch, crouch * 0.7, run), a.defending ? 1.1 : 0.5);

  if (sp > 0.15) {
    const dirX = a.velLocal.x / Math.max(sp, 1e-3);
    const dirZ = a.velLocal.y / Math.max(sp, 1e-3);
    const stride = lerp(0.25, 0.75, run) * (a.defending ? 0.6 : 1);
    const lift = lerp(0.05, 0.2, run) * (a.defending ? 0.5 : 1);
    const ph = a.stride * Math.PI * 2;
    for (const [foot, off] of [
      [out.footL, 0],
      [out.footR, Math.PI],
    ] as const) {
      const c = Math.cos(ph + off);
      const s = Math.sin(ph + off);
      foot.x += dirX * c * stride * 0.5;
      foot.z += dirZ * c * stride * 0.5;
      foot.y += Math.max(0, -s) * lift;
    }
    out.hipsOffset.y -= Math.abs(Math.sin(ph)) * 0.035 * run;
    out.hipsOffset.y += 0.02 * run;
    // Lean into the run
    out.hipsRot.x += dirZ * run * 0.12;
    out.spineRot.x += dirZ * run * 0.14;
    out.spineRot.z -= dirX * run * 0.12;
    out.hipsRot.y = Math.sin(ph) * 0.12 * run;
    out.spineRot.y = -Math.sin(ph) * 0.18 * run;
    // Arm swing (only for free arms)
    const swing = Math.sin(ph) * lerp(0.1, 0.45, run);
    out.handL.z += -swing;
    out.handR.z += swing;
    out.handL.y += Math.abs(swing) * 0.25 + run * 0.12;
    out.handR.y += Math.abs(swing) * 0.25 + run * 0.12;
  }
  if (a.defending) {
    // Active hands: wide and up
    out.handL.set(p.shoulderHalf + 0.34, p.shoulderY - 0.05 + Math.sin(a.t * 6) * 0.03, 0.22);
    out.handR.set(-(p.shoulderHalf + 0.34), p.shoulderY - 0.18 + Math.sin(a.t * 6 + 1) * 0.03, 0.3);
    out.elbowPoleL.set(1, -0.4, -0.3);
    out.elbowPoleR.set(-1, -0.4, -0.3);
    out.headRot.x = -0.25;
  }
}

/** Dribble: returns ball position (character space) and moves the dribble hand */
export function dribble(p: Proportions, a: AnimInput, out: PoseTargets, ball: THREE.Vector3) {
  const s = side(a.dribbleHand);
  const run = clamp(a.speed / 6.5, 0, 1);
  const top = p.hipY - 0.1 - out.hipsOffset.y * -0.5;
  const phase = a.dribble;
  // Bounce: sharp at the floor (phase 0.5), soft at the hand
  const h = Math.abs(Math.cos(Math.PI * phase));
  const bx = s * (p.shoulderHalf + 0.12);
  const bz = 0.28 + run * 0.35;
  ball.set(bx, 0.12 + (top - 0.12) * Math.pow(h, 0.8), bz);
  const hand = s > 0 ? out.handL : out.handR;
  const handY = Math.max(ball.y + 0.12, top - 0.04);
  hand.set(bx, lerp(handY, ball.y + 0.13, smooth((ball.y - (top - 0.3)) / 0.3)), bz - 0.02);
  const pole = s > 0 ? out.elbowPoleL : out.elbowPoleR;
  pole.set(s * 1, -0.2, -0.6);
  // Off-hand protects the ball
  const off = s > 0 ? out.handR : out.handL;
  off.set(-s * (p.shoulderHalf + 0.18), p.hipY + 0.12, 0.28);
  out.spineRot.y += s * 0.12;
}

/** Ball held in both hands at the chest (triple threat / gather) */
export function holdChest(p: Proportions, out: PoseTargets, ball: THREE.Vector3, lift = 0) {
  const y = lerp(p.hipY + 0.12, p.shoulderY + 0.25, lift);
  ball.set(0, y, 0.3 - lift * 0.1);
  out.handL.set(0.1, y, ball.z - 0.02);
  out.handR.set(-0.1, y, ball.z - 0.02);
  out.elbowPoleL.set(1, -1, -0.2);
  out.elbowPoleR.set(-1, -1, -0.2);
}

/**
 * Jump shot. k = seconds into the action. Returns jump height (m).
 * gather 0 → 0.2, air 0.2 → 0.85, land 0.85 → 1.05
 */
export function jumpShot(
  p: Proportions,
  k: number,
  released: boolean,
  releaseK: number,
  out: PoseTargets,
  ball: THREE.Vector3,
) {
  stance(p, out, 0.3, 0.3);
  const gather = smooth(k / 0.2);
  const airU = clamp((k - 0.2) / 0.65, 0, 1);
  const jumpH = k > 0.2 && k < 0.85 ? arc(airU) * 0.5 : 0;
  // Crouch into the gather, extend in the air
  out.hipsOffset.y -= (1 - smooth((k - 0.1) / 0.15)) * gather * p.legLen * 0.12;
  if (k > 0.85) out.hipsOffset.y -= arc(clamp((k - 0.85) / 0.2, 0, 1) * 0.5) * p.legLen * 0.1;
  out.footL.y += jumpH > 0 ? 0.05 : 0;
  out.footR.y += jumpH > 0 ? 0.05 : 0;
  out.footL.z -= jumpH * 0.2;
  out.footR.z += jumpH * 0.1;
  out.headRot.x = -0.15;

  const set = smooth((k - 0.1) / 0.3);
  if (!released) {
    // Ball rises from chest to the set point above the forehead
    const y = lerp(p.hipY + 0.15, p.headY + 0.22, set);
    ball.set(-0.08, y, lerp(0.3, 0.14, set));
    out.handR.set(ball.x - 0.02, ball.y - 0.14, ball.z - 0.04);
    out.handL.set(ball.x + 0.14, ball.y - 0.02, ball.z);
    out.elbowPoleR.set(-0.3, -1, 0.2);
    out.elbowPoleL.set(1, -0.6, 0);
  } else {
    // Follow through: shooting arm extended, wrist "in the cookie jar"
    const ft = smooth((k - releaseK) / 0.12);
    const hold = k < 0.95 ? 1 : 1 - smooth((k - 0.95) / 0.15);
    out.handR.set(-0.1, lerp(p.headY + 0.1, p.headY + 0.42, ft * hold), lerp(0.1, 0.42, ft * hold));
    out.handL.set(0.2, lerp(p.headY, p.shoulderY + 0.1, ft), 0.2);
    out.elbowPoleR.set(-0.3, -1, 0.1);
    out.elbowPoleL.set(1, -0.5, 0);
  }
  return jumpH;
}

/** Layup / dunk body during the airborne phase. u = 0..1 of air time. */
export function finishPose(
  p: Proportions,
  u: number,
  kind: "layup" | "dunk" | "windmill" | "tomahawk" | "reverse",
  out: PoseTargets,
  ball: THREE.Vector3,
  released: boolean,
) {
  stance(p, out, 0.1, 0.2);
  // Knee drive: one knee high, other leg trailing
  out.footL.set(p.hipHalf, p.ankleY + 0.35 + 0.2 * Math.sin(u * Math.PI), 0.35);
  out.footR.set(-p.hipHalf, p.ankleY + 0.1, -0.25);
  out.hipsRot.x = -0.05;
  out.spineRot.x = -0.1;
  out.headRot.x = -0.35;

  const reach = p.shoulderY + p.armLen * 0.95;
  if (kind === "layup") {
    const y = lerp(p.shoulderY + 0.1, reach, smooth(u * 1.6));
    ball.set(-0.12, y + 0.12, 0.35);
    out.handR.set(-0.12, y, 0.33);
    out.handL.set(0.25, p.shoulderY + 0.15, 0.25);
  } else if (kind === "windmill") {
    const ang = -Math.PI * 0.5 + u * Math.PI * 1.9;
    const r = p.armLen * 0.95;
    const cx = -(p.shoulderHalf + 0.05);
    const x = cx - Math.sin(ang) * 0.1;
    const y = p.shoulderY + Math.sin(ang) * r;
    const z = Math.cos(ang) * r * 0.8;
    out.handR.set(x, y, z);
    ball.set(x, y + 0.13, z);
    out.handL.set(0.35, p.shoulderY + 0.25, 0.3);
    out.spineRot.x = -0.25 + u * 0.4;
  } else if (kind === "tomahawk") {
    const back = u < 0.6 ? smooth(u / 0.6) : 1 - smooth((u - 0.6) / 0.25);
    const y = reach + 0.05;
    const z = lerp(0.3, -0.35, back);
    out.handR.set(-0.1, y - (1 - back) * 0.1, z);
    out.handL.set(0.1, y - (1 - back) * 0.1, z);
    ball.set(0, y + 0.1, z);
    out.spineRot.x = lerp(-0.35, 0.3, u);
  } else {
    // two-hand power dunk (also used for reverse)
    const y = lerp(p.shoulderY + 0.2, reach, smooth(u * 1.4));
    ball.set(0, y + 0.12, 0.3);
    out.handR.set(-0.1, y, 0.28);
    out.handL.set(0.1, y, 0.28);
    out.spineRot.x = lerp(-0.2, 0.2, u);
  }
  if (released) {
    out.handR.y = Math.min(out.handR.y, reach);
    out.handL.y = Math.min(out.handL.y, reach);
  }
  out.elbowPoleR.set(-1, -0.2, -0.4);
  out.elbowPoleL.set(1, -0.2, -0.4);
}

/** Hanging on the rim after a dunk */
export function hangPose(p: Proportions, out: PoseTargets) {
  stance(p, out, 0, 0.3);
  const reach = p.shoulderY + p.armLen * 0.98;
  out.handR.set(-0.15, reach, 0.35);
  out.handL.set(0.15, reach, 0.35);
  out.footL.set(p.hipHalf * 1.6, p.ankleY + 0.05, 0.12);
  out.footR.set(-p.hipHalf * 1.6, p.ankleY + 0.1, 0.05);
  out.spineRot.x = -0.1;
  out.headRot.x = 0.2;
}

/** Crossover: ball swaps hands low in front. u = 0..1. dir = +1 moving left */
export function crossover(p: Proportions, u: number, from: Hand, out: PoseTargets, ball: THREE.Vector3) {
  stance(p, out, 0.85, 1.3);
  const s0 = side(from);
  const x = lerp(s0, -s0, smooth(u)) * (p.shoulderHalf + 0.1);
  const y = 0.15 + 0.35 * Math.abs(Math.cos(Math.PI * u));
  ball.set(x, y, 0.4);
  const hand = u < 0.5 ? (s0 > 0 ? out.handL : out.handR) : s0 > 0 ? out.handR : out.handL;
  hand.set(x, y + 0.13, 0.38);
  const other = u < 0.5 ? (s0 > 0 ? out.handR : out.handL) : s0 > 0 ? out.handL : out.handR;
  other.set(-Math.sign(x || 1) * (p.shoulderHalf + 0.2), p.hipY - 0.05, 0.3);
  // Hips sell the fake then explode the other way
  const sell = Math.sin(u * Math.PI);
  out.hipsOffset.x = s0 * 0.12 * (1 - u) - s0 * 0.14 * u;
  out.spineRot.z = s0 * 0.25 * sell;
  out.spineRot.x += 0.15;
  out.headRot.z = -s0 * 0.1 * sell;
}

/** Flashy dribble moves. kind picks the trick. */
export function trick(
  p: Proportions,
  u: number,
  kind: "between" | "behind" | "spin" | "wrap",
  from: Hand,
  out: PoseTargets,
  ball: THREE.Vector3,
) {
  const s0 = side(from);
  stance(p, out, 0.8, 1.2);
  if (kind === "between") {
    // Lunge forward with the off-foot, ball goes under the legs
    const lead = s0 > 0 ? out.footR : out.footL;
    lead.z += 0.45;
    const x = lerp(s0, -s0, smooth(u)) * (p.shoulderHalf + 0.1);
    const y = 0.14 + 0.4 * Math.abs(Math.cos(Math.PI * u * 2));
    ball.set(x, y, 0.1);
  } else if (kind === "behind") {
    const a = lerp(0, Math.PI, smooth(u));
    ball.set(
      Math.cos(a) * s0 * (p.shoulderHalf + 0.15),
      0.25 + 0.3 * Math.sin(u * Math.PI * 2) ** 2,
      -Math.sin(a) * 0.35,
    );
    out.spineRot.y = s0 * 0.3 * Math.sin(u * Math.PI);
  } else if (kind === "wrap") {
    const a = u * Math.PI * 2;
    ball.set(Math.cos(a) * (p.shoulderHalf + 0.2), p.hipY - 0.05, Math.sin(a) * 0.4);
  } else {
    // spin: the body yaw is handled by gameplay; ball tucked on the hip
    ball.set(s0 * (p.shoulderHalf + 0.15), p.hipY - 0.05 - 0.2 * Math.sin(u * Math.PI), 0.2);
    out.spineRot.x += 0.2;
  }
  const near = ball.x >= 0 ? out.handL : out.handR;
  near.set(ball.x, ball.y + 0.13, ball.z);
  const far = ball.x >= 0 ? out.handR : out.handL;
  far.set(-Math.sign(ball.x || 1) * (p.shoulderHalf + 0.25), p.hipY + 0.1, 0.25);
}

/** Steal lunge */
export function stealPose(p: Proportions, u: number, out: PoseTargets) {
  stance(p, out, 0.9, 1.1);
  const reach = Math.sin(clamp(u, 0, 1) * Math.PI);
  out.footR.z += 0.35 * reach;
  out.handR.set(-0.15, p.hipY - 0.2, 0.3 + reach * p.armLen * 0.9);
  out.handL.set(p.shoulderHalf + 0.3, p.shoulderY - 0.1, 0.1);
  out.spineRot.x += 0.35 * reach;
  out.spineRot.y = -0.25 * reach;
  out.elbowPoleR.set(-1, -0.5, 0);
}

/** Block / rebound / contest jump: both arms straight up */
export function reachPose(p: Proportions, u: number, out: PoseTargets, lean = 0.1) {
  stance(p, out, u < 0.1 || u > 0.9 ? 0.6 : 0.1, 0.5);
  const up = p.shoulderY + p.armLen * 0.98;
  const k = smooth(u * 3);
  out.handL.set(0.14, lerp(p.shoulderY, up, k), 0.18 + lean);
  out.handR.set(-0.14, lerp(p.shoulderY, up, k), 0.18 + lean);
  out.elbowPoleL.set(1, 0, -0.5);
  out.elbowPoleR.set(-1, 0, -0.5);
  out.footL.y += u > 0.1 && u < 0.9 ? 0.08 : 0;
  out.footR.y += u > 0.1 && u < 0.9 ? 0.12 : 0;
  out.headRot.x = -0.4;
}

/** Ankles broken: stumble (u 0..1). Big ones end on the floor. */
export function stumblePose(p: Proportions, u: number, dir: number, fall: boolean, out: PoseTargets) {
  stance(p, out, 0.6, 1.3);
  const wobble = Math.sin(u * Math.PI * 4) * (1 - u);
  if (fall) {
    const down = u < 0.7 ? smooth(u / 0.25) : 1 - smooth((u - 0.7) / 0.3);
    out.hipsOffset.y = -down * (p.hipY - 0.18);
    out.hipsOffset.z = -down * 0.25;
    out.footL.z += down * 0.55;
    out.footR.z += down * 0.45;
    out.footL.y += down * 0.02;
    out.handL.set(p.shoulderHalf + 0.15, 0.05 + (1 - down) * 0.6, -0.25);
    out.handR.set(-(p.shoulderHalf + 0.15), 0.05 + (1 - down) * 0.6, -0.25);
    out.spineRot.x = -0.35 * down;
    out.headRot.x = 0.2 * down;
  } else {
    out.hipsOffset.x = dir * 0.15 * Math.sin(u * Math.PI);
    out.spineRot.z = dir * 0.4 * Math.sin(u * Math.PI) + wobble * 0.2;
    out.handL.set(p.shoulderHalf + 0.45, p.shoulderY + 0.25 * wobble, 0);
    out.handR.set(-(p.shoulderHalf + 0.45), p.shoulderY - 0.25 * wobble, 0);
    out.footL.x += dir * 0.2;
  }
}

/** Celebration flex (u loops) */
export function celebratePose(p: Proportions, t: number, style: number, out: PoseTargets) {
  stance(p, out, 0.15, 0.6);
  const pump = Math.sin(t * 7) * 0.5 + 0.5;
  if (style === 0) {
    // Double flex
    out.handL.set(p.shoulderHalf + 0.25, p.shoulderY + 0.2, 0.05);
    out.handR.set(-(p.shoulderHalf + 0.25), p.shoulderY + 0.2, 0.05);
    out.elbowPoleL.set(1, -0.2, 0);
    out.elbowPoleR.set(-1, -0.2, 0);
    out.spineRot.x = -0.2;
    out.headRot.x = -0.25;
  } else if (style === 1) {
    // Fist pump
    out.handR.set(-0.2, lerp(p.shoulderY + 0.1, p.shoulderY + p.armLen * 0.9, pump), 0.2);
    out.elbowPoleR.set(-1, -0.4, 0);
    out.spineRot.x = -0.15;
  } else {
    // "Lights out": hand over the eyes, looking away cool
    out.handR.set(-0.02, p.headY + 0.1, 0.18);
    out.elbowPoleR.set(-1, -0.2, 0.2);
    out.headRot.y = 0.5;
    out.spineRot.y = 0.2;
  }
}

/** Throw the ball off the backboard to yourself */
export function lobPose(p: Proportions, u: number, out: PoseTargets, ball: THREE.Vector3) {
  stance(p, out, 0.4, 0.5);
  const up = smooth(u / 0.6);
  const y = lerp(p.hipY + 0.1, p.shoulderY + p.armLen * 0.8, up);
  ball.set(0, y + 0.1, 0.35);
  out.handL.set(0.1, y, 0.33);
  out.handR.set(-0.1, y, 0.33);
  out.spineRot.x = -0.15 * up;
}
