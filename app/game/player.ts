import * as THREE from "three";
import type { Baller } from "~/data/characters";
import * as A from "./animator";
import type { Body } from "./body";
import { clamp, damp, dampAngle, smooth } from "./math";
import { createPose, type PoseTargets } from "./rig";
import { emptyStats, type PlayerStats } from "./types";

export type ActionType =
  | "shoot"
  | "layup"
  | "dunk"
  | "juke"
  | "trick"
  | "steal"
  | "block"
  | "stumble"
  | "lob"
  | "special"
  | "hang"
  | "celebrate"
  | "dejected";

export interface Action {
  type: ActionType;
  t: number;
  dur: number;
  /** Free-form per-action data */
  released?: boolean;
  releaseT?: number;
  releaseAt?: number;
  quality?: number;
  kind?: string;
  from?: THREE.Vector3;
  to?: THREE.Vector3;
  dir?: number;
  fall?: boolean;
  make?: boolean;
  points?: number;
  hand?: A.Hand;
  checked?: boolean;
  style?: number;
  jumpH?: number;
  contest?: number;
}

export class Player {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  /** Airborne height (m) */
  y = 0;
  action: Action | null = null;
  hasBall = false;
  dribbleHand: A.Hand = "R";
  dribble = 0;
  stride = 0;
  hype = 0;
  turbo = 1;
  jukeCd = 0;
  stealCd = 0;
  trickCd = 0;
  stats: PlayerStats = emptyStats();
  pose: PoseTargets = createPose();
  ballLocal = new THREE.Vector3();
  /** Where gameplay wants the character to look */
  faceTarget = new THREE.Vector3();
  private blendFrom: PoseTargets = createPose();
  private tmpPose: PoseTargets = createPose();
  private lastAction: ActionType | null = null;
  private blend = 1;
  private velLocal = new THREE.Vector2();
  glow = 0;
  glowColor = new THREE.Color("#ffffff");

  constructor(
    public id: 0 | 1,
    public baller: Baller,
    public body: Body,
  ) {}

  get height() {
    return this.baller.height;
  }

  /** Top speed in m/s */
  maxSpeed(turbo: boolean) {
    const base = 3.6 + (this.baller.ratings.speed / 100) * 1.4;
    const withBall = this.hasBall ? 0.93 : 1;
    return base * withBall * (turbo ? 1.38 : 1);
  }

  busy() {
    return !!this.action && !["celebrate", "dejected"].includes(this.action.type);
  }

  airborne() {
    return this.y > 0.05;
  }

  startAction(a: Action) {
    this.action = a;
  }

  /** Reach height of the highest hand right now */
  reach() {
    const up = this.action && ["block", "shoot", "layup", "dunk", "hang", "special"].includes(this.action.type);
    return this.y + this.height * (up ? 1.32 : 0.85);
  }

  setGlow(color: string, amount: number) {
    this.glowColor.set(color);
    this.glow = amount;
  }

  /** Builds this frame's pose + held-ball position, then applies it to the rig. */
  animate(dt: number, t: number, defending: boolean) {
    const p = this.body.poser.proportions;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    // Local velocity in character space (x = left, z = forward)
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    this.velLocal.set(this.vel.x * c - this.vel.z * s, this.vel.x * s + this.vel.z * c);
    this.stride += (speed / (0.6 + speed * 0.14)) * dt * 0.5;
    const dribbleRate = 1.9 + clamp(speed / 6, 0, 1) * 0.9;
    this.dribble = (this.dribble + dt * dribbleRate) % 1;

    const input: A.AnimInput = {
      t,
      velLocal: this.velLocal,
      speed,
      stride: this.stride,
      hasBall: this.hasBall,
      dribbleHand: this.dribbleHand,
      dribble: this.dribble,
      defending,
      crouch: 0.5,
    };
    const out = this.tmpPose;
    const ball = this.ballLocal;
    const a = this.action;
    const type = a?.type ?? null;

    if (!a) {
      A.locomotion(p, input, out);
      if (this.hasBall) A.dribble(p, input, out, ball);
    } else {
      const k = a.t;
      const u = clamp(a.t / a.dur, 0, 1);
      switch (a.type) {
        case "shoot": {
          const jh = A.jumpShot(p, k, !!a.released, a.releaseT ?? 0, out, ball);
          this.y = jh * (a.jumpH ?? 1);
          break;
        }
        case "layup":
        case "dunk":
        case "special": {
          const air = this.y > 0.02;
          if (!air && u < 0.2) {
            A.locomotion(p, input, out);
            A.holdChest(p, out, ball, smooth(u / 0.2) * 0.3);
          } else {
            const kind = (a.kind ?? "dunk") as "layup" | "dunk" | "windmill" | "tomahawk" | "reverse";
            const airU = clamp((u - 0.2) / 0.6, 0, 1);
            A.finishPose(p, airU, kind, out, ball, !!a.released);
          }
          break;
        }
        case "hang":
          A.hangPose(p, out);
          break;
        case "juke":
          A.crossover(p, u, a.hand ?? "R", out, ball);
          break;
        case "trick":
          A.trick(p, u, (a.kind ?? "between") as "between" | "behind" | "spin" | "wrap", a.hand ?? "R", out, ball);
          break;
        case "steal":
          A.stealPose(p, u, out);
          break;
        case "block":
          A.reachPose(p, u, out, 0.2);
          break;
        case "stumble":
          A.stumblePose(p, u, a.dir ?? 1, !!a.fall, out);
          break;
        case "lob":
          A.lobPose(p, u, out, ball);
          break;
        case "celebrate":
          A.celebratePose(p, t, a.style ?? 0, out);
          break;
        case "dejected":
          A.idle(p, t, out);
          out.spineRot.x = 0.35;
          out.headRot.x = 0.45;
          break;
      }
    }

    // Smoothly blend between states so actions never pop
    if (type !== this.lastAction) {
      A.restPose(p, this.blendFrom);
      copyInto(this.blendFrom, this.pose);
      this.blend = 0;
      this.lastAction = type;
    }
    this.blend = Math.min(1, this.blend + dt * 10);
    if (this.blend < 1) blendInto(this.pose, this.blendFrom, out, smooth(this.blend));
    else copyInto(this.pose, out);

    // Place the character
    const root = this.body.root;
    root.position.set(this.pos.x, this.y, this.pos.z);
    root.rotation.y = this.yaw;
    root.updateMatrixWorld(true);
    this.body.poser.apply(this.pose);

    // Special-move glow
    for (const m of this.body.glowMaterials) {
      m.emissive.copy(this.glowColor);
      m.emissiveIntensity = this.glow;
    }
  }

  /** World-space position of the held ball */
  ballWorld(out: THREE.Vector3) {
    return this.body.root.localToWorld(out.copy(this.ballLocal));
  }

  faceTowards(x: number, z: number, dt: number, rate = 10) {
    const target = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.yaw = dampAngle(this.yaw, target, rate, dt);
  }

  approach(vx: number, vz: number, dt: number, accel = 14) {
    this.vel.x = damp(this.vel.x, vx, accel, dt);
    this.vel.z = damp(this.vel.z, vz, accel, dt);
  }
}

function copyInto(dst: PoseTargets, src: PoseTargets) {
  dst.hipsOffset.copy(src.hipsOffset);
  dst.hipsRot.copy(src.hipsRot);
  dst.spineRot.copy(src.spineRot);
  dst.headRot.copy(src.headRot);
  dst.handL.copy(src.handL);
  dst.handR.copy(src.handR);
  dst.footL.copy(src.footL);
  dst.footR.copy(src.footR);
  dst.elbowPoleL.copy(src.elbowPoleL);
  dst.elbowPoleR.copy(src.elbowPoleR);
  dst.kneePoleL.copy(src.kneePoleL);
  dst.kneePoleR.copy(src.kneePoleR);
  dst.footYawL = src.footYawL;
  dst.footYawR = src.footYawR;
}

function blendInto(out: PoseTargets, a: PoseTargets, b: PoseTargets, t: number) {
  out.hipsOffset.lerpVectors(a.hipsOffset, b.hipsOffset, t);
  out.hipsRot.lerpVectors(a.hipsRot, b.hipsRot, t);
  out.spineRot.lerpVectors(a.spineRot, b.spineRot, t);
  out.headRot.lerpVectors(a.headRot, b.headRot, t);
  out.handL.lerpVectors(a.handL, b.handL, t);
  out.handR.lerpVectors(a.handR, b.handR, t);
  out.footL.lerpVectors(a.footL, b.footL, t);
  out.footR.lerpVectors(a.footR, b.footR, t);
  out.elbowPoleL.lerpVectors(a.elbowPoleL, b.elbowPoleL, t);
  out.elbowPoleR.lerpVectors(a.elbowPoleR, b.elbowPoleR, t);
  out.kneePoleL.lerpVectors(a.kneePoleL, b.kneePoleL, t);
  out.kneePoleR.lerpVectors(a.kneePoleR, b.kneePoleR, t);
  out.footYawL = a.footYawL + (b.footYawL - a.footYawL) * t;
  out.footYawR = a.footYawR + (b.footYawR - a.footYawR) * t;
}
