import * as THREE from "three";
import { BALL_RADIUS, COURT, GRAVITY, RIM_CENTER } from "./constants";

export type BallEvent = "floor" | "rim" | "board" | "score" | "net";

export interface ShotInfo {
  shooter: number;
  points: number;
  make: boolean;
  /** Seconds since the ball left the hand */
  t: number;
  kind: "jumper" | "layup" | "dunk" | "special" | "lob";
  counted: boolean;
  /** The defender already had their one chance to block it */
  blockRolled?: boolean;
}

/** Simple rigid-sphere ball: gravity, floor, backboard, rim torus, net drag */
export class Ball {
  pos = new THREE.Vector3(0, 1, 8);
  vel = new THREE.Vector3();
  spin = new THREE.Vector3();
  state: "held" | "air" | "dead" = "held";
  holder = 0;
  shot: ShotInfo | null = null;
  /** Last player to touch it */
  lastTouch = 0;
  /** Time spent inside the net (slows the ball) */
  private inNet = 0;
  private prevY = 1;

  launch(from: THREE.Vector3, target: THREE.Vector3, apexAbove: number) {
    this.pos.copy(from);
    const apex = Math.max(from.y, target.y) + apexAbove;
    const vy = Math.sqrt(2 * GRAVITY * (apex - from.y));
    const tUp = vy / GRAVITY;
    const tDown = Math.sqrt((2 * (apex - target.y)) / GRAVITY);
    const T = tUp + tDown;
    this.vel.set((target.x - from.x) / T, vy, (target.z - from.z) / T);
    this.spin.set(-8, 0, 0);
    this.state = "air";
    this.inNet = 0;
    return T;
  }

  step(dt: number, out: BallEvent[]) {
    if (this.state !== "air") return;
    this.prevY = this.pos.y;
    // Guided makes: gently steer toward the rim center on the way down
    if (this.shot?.make && this.vel.y < 0 && this.pos.y > RIM_CENTER.y - 0.05) {
      const k = Math.min(1, dt * 8);
      const dx = RIM_CENTER.x - this.pos.x;
      const dz = RIM_CENTER.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) {
        this.pos.x += dx * k * 0.6;
        this.pos.z += dz * k * 0.6;
      }
    }
    this.vel.y -= GRAVITY * dt;
    if (this.inNet > 0) {
      this.vel.multiplyScalar(Math.exp(-dt * 6));
      this.inNet -= dt;
    }
    this.pos.addScaledVector(this.vel, dt);
    if (this.shot) this.shot.t += dt;

    // Floor
    if (this.pos.y < BALL_RADIUS) {
      this.pos.y = BALL_RADIUS;
      if (this.vel.y < -0.6) out.push("floor");
      this.vel.y = -this.vel.y * 0.74;
      this.vel.x *= 0.92;
      this.vel.z *= 0.92;
      if (Math.abs(this.vel.y) < 0.5) this.vel.y = 0;
    }

    // Backboard (thin box facing +z)
    const bz = COURT.backboardZ;
    if (
      this.pos.z - BALL_RADIUS < bz &&
      this.pos.z > bz - 0.3 &&
      Math.abs(this.pos.x) < COURT.backboardHalfWidth &&
      this.pos.y > COURT.backboardBottom &&
      this.pos.y < COURT.backboardTop &&
      this.vel.z < 0
    ) {
      this.pos.z = bz + BALL_RADIUS;
      this.vel.z = -this.vel.z * 0.6;
      out.push("board");
    }

    // Rim: torus of radius R in the horizontal plane
    const rx = this.pos.x - RIM_CENTER.x;
    const rz = this.pos.z - RIM_CENTER.z;
    const rd = Math.hypot(rx, rz) || 1e-6;
    const cx = RIM_CENTER.x + (rx / rd) * COURT.rimRadius;
    const cz = RIM_CENTER.z + (rz / rd) * COURT.rimRadius;
    const nx = this.pos.x - cx;
    const ny = this.pos.y - RIM_CENTER.y;
    const nz = this.pos.z - cz;
    const nd = Math.hypot(nx, ny, nz);
    const minD = BALL_RADIUS + 0.012;
    if (nd < minD && !(this.shot?.make && this.shot.t > 0.2)) {
      const inv = 1 / (nd || 1e-6);
      const n = new THREE.Vector3(nx * inv, ny * inv, nz * inv);
      this.pos.addScaledVector(n, minD - nd);
      const vn = this.vel.dot(n);
      if (vn < 0) {
        this.vel.addScaledVector(n, -vn * 1.55);
        this.vel.multiplyScalar(0.82);
        // a little randomness keeps rim-outs lively
        this.vel.x += (Math.random() - 0.5) * 0.4;
        this.vel.z += (Math.random() - 0.5) * 0.4;
        out.push("rim");
      }
    }

    // Through the hoop?
    if (this.prevY >= RIM_CENTER.y && this.pos.y < RIM_CENTER.y && this.vel.y < 0 && rd < COURT.rimRadius - 0.03) {
      if (this.shot && !this.shot.counted) {
        this.shot.counted = true;
        out.push("score");
      }
      out.push("net");
      this.inNet = 0.18;
      this.vel.x *= 0.3;
      this.vel.z *= 0.3;
    }

    // Pole behind the baseline
    if (this.pos.z < -0.6 && this.pos.z > -1.2 && Math.abs(this.pos.x) < 0.25 && this.pos.y < 3.6) {
      this.vel.z = Math.abs(this.vel.z) * 0.5;
    }
  }
}
