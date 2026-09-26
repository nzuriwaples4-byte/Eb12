import { COURT, distToRim, isThreePoint } from "./constants";
import { chance, clamp, gaussian, rand } from "./math";
import type { Match } from "./match";
import type { Player } from "./player";
import { emptyIntent, type Intent } from "./types";

/**
 * CPU baller brain. Reads the match, returns the same Intent a human produces,
 * so AI plays by exactly the same rules and animations.
 */
export class AiBrain {
  private decisionT = 0;
  private plan: "drive" | "shoot" | "clear" | "setup" = "setup";
  private driveSide = 1;
  private perceived = { x: 0, z: 0 };
  private releaseAt = 0.45;
  private holdingShot = false;
  private contestUsed = false;
  private lastOppAction: string | null = null;

  constructor(
    private me: Player,
    private match: Match,
  ) {}

  private get skill() {
    // 0..1 overall skill from difficulty
    return [0.35, 0.62, 0.88][this.match.config.difficulty] ?? 0.6;
  }

  think(dt: number): Intent {
    const m = this.match;
    const me = this.me;
    const opp = m.players[1 - me.id];
    const it = emptyIntent();
    const reaction = 12 - (1 - this.skill) * 8;
    this.perceived.x += (opp.pos.x - this.perceived.x) * Math.min(1, dt * reaction);
    this.perceived.z += (opp.pos.z - this.perceived.z) * Math.min(1, dt * reaction);

    if (m.phase !== "live") return it;

    // Finishing an in-progress jumper: release near the chosen time
    if (me.action?.type === "shoot" && !me.action.released) {
      it.shootHeld = me.action.t < this.releaseAt;
      it.shootRelease = me.action.t >= this.releaseAt;
      return it;
    }
    if (me.busy()) return it;

    if (me.hasBall) this.offense(dt, it, opp);
    else if (opp.hasBall) this.defense(dt, it, opp);
    else this.chaseBall(it);
    return it;
  }

  private moveTo(it: Intent, x: number, z: number, slowRadius = 0.6) {
    const dx = x - this.me.pos.x;
    const dz = z - this.me.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.08) return d;
    const k = Math.min(1, d / slowRadius);
    it.moveX = (dx / d) * k;
    it.moveZ = (dz / d) * k;
    return d;
  }

  private startShot(it: Intent) {
    const s = this.skill;
    const r = this.me.baller.ratings;
    const accuracy = clamp(0.25 + s * 0.45 + (r.shooting - 60) / 200, 0.1, 0.95);
    // Ideal release ≈ 0.43s; error shrinks with accuracy
    this.releaseAt = 0.43 + gaussian(0, 0.12 * (1 - accuracy));
    it.shootPress = true;
    it.shootHeld = true;
    this.holdingShot = true;
  }

  private offense(dt: number, it: Intent, opp: Player) {
    const m = this.match;
    const me = this.me;
    const r = me.baller.ratings;
    const d = distToRim(me.pos.x, me.pos.z);
    const gap = Math.hypot(opp.pos.x - me.pos.x, opp.pos.z - me.pos.z);
    const oppDown = opp.action?.type === "stumble";
    // Is the defender between me and the rim?
    const toRimX = -me.pos.x;
    const toRimZ = COURT.rimZ - me.pos.z;
    const toOppX = opp.pos.x - me.pos.x;
    const toOppZ = opp.pos.z - me.pos.z;
    const cos = (toRimX * toOppX + toRimZ * toOppZ) / (Math.hypot(toRimX, toRimZ) * Math.hypot(toOppX, toOppZ) + 1e-6);
    const between = cos > 0.75 && gap < 2.2 && !oppDown;

    if (m.needClear) {
      // Take it back behind the arc
      const ang = Math.atan2(me.pos.x, me.pos.z - COURT.rimZ);
      const tx = Math.sin(ang) * (COURT.threeRadius + 0.8);
      const tz = COURT.rimZ + Math.cos(ang) * (COURT.threeRadius + 0.8);
      this.moveTo(it, tx, Math.max(tz, 3.5));
      it.turbo = gap < 2;
      return;
    }

    this.decisionT -= dt;
    const shotClock = m.shotClock;

    if (me.hype >= 100 && d < 9 && chance(dt * 2)) {
      it.special = true;
      return;
    }
    if (d < 2.6 && (!between || oppDown || chance(dt * 1.5))) {
      it.shootPress = true;
      it.turbo = r.dunk > 60 || chance(0.3);
      return;
    }
    if (shotClock < 2.2 && d < 10) {
      this.startShot(it);
      return;
    }

    if (this.decisionT <= 0) {
      this.decisionT = rand(0.25, 0.55) * (1.3 - this.skill * 0.5);
      const three = isThreePoint(me.pos.x, me.pos.z);
      const likesThree = r.three > 80;
      const open = gap > 1.8 || oppDown;
      const inRange = three ? d < 8.2 : d < 6.2;
      const shootP = open && inRange ? (three ? (likesThree ? 0.6 : 0.25) : r.shooting > 75 ? 0.45 : 0.25) : 0.04;
      if (chance(shootP)) {
        this.startShot(it);
        return;
      }
      if (gap < 1.7 && me.jukeCd <= 0 && chance(0.25 + r.handles / 250)) {
        it.juke = true;
        this.driveSide = -this.driveSide;
        return;
      }
      if (gap < 2.2 && me.trickCd <= 0 && chance(me.baller.flair * 0.25)) {
        it.trick = true;
        return;
      }
      if (gap > 3.5 && d < 7 && chance(me.baller.flair * 0.12)) {
        it.lob = true;
        return;
      }
      this.plan = chance(0.7) ? "drive" : "setup";
      if (chance(0.3)) this.driveSide = -this.driveSide;
    }

    if (this.plan === "drive") {
      // Attack the rim, slipping to the side of the defender
      const side = this.driveSide * (between ? 1.4 : 0.4);
      this.moveTo(it, side, COURT.rimZ + 1.0, 0.3);
      it.turbo = me.turbo > 0.3 && (oppDown || gap > 1.2) && chance(0.8);
    } else {
      // Probe around the perimeter
      const favorite = r.three > 85 ? COURT.threeRadius + 0.5 : 5.2;
      const ang = Math.sin(m.time * 0.6 + me.id) * 0.9;
      this.moveTo(it, Math.sin(ang) * favorite, COURT.rimZ + Math.cos(ang) * favorite);
    }
  }

  private defense(_dt: number, it: Intent, opp: Player) {
    const m = this.match;
    const me = this.me;
    const r = me.baller.ratings;
    const hx = this.perceived.x;
    const hz = this.perceived.z;
    // Stay between the handler and the rim
    const tx = -hx;
    const tz = COURT.rimZ - hz;
    const tl = Math.hypot(tx, tz) || 1;
    const oppShooter = opp.baller.ratings.three > 85 && isThreePoint(hx, hz);
    const gapWant = (m.needClear ? 2.2 : oppShooter ? 0.95 : 1.2) - this.skill * 0.15;
    const px = hx + (tx / tl) * gapWant;
    const pz = hz + (tz / tl) * gapWant;
    const d = this.moveTo(it, px, pz, 0.4);
    it.turbo = d > 1.6;

    const gap = Math.hypot(opp.pos.x - me.pos.x, opp.pos.z - me.pos.z);
    const oa = opp.action?.type ?? null;
    if (oa !== this.lastOppAction) {
      this.contestUsed = false;
      this.lastOppAction = oa;
    }
    // Contest / block
    if (!this.contestUsed && opp.action) {
      const t = opp.action.t;
      const react = 0.08 + (1 - this.skill) * 0.2;
      if (opp.action.type === "shoot" && gap < 2.6 && t > react) {
        this.contestUsed = true;
        if (chance(0.55 + this.skill * 0.4)) it.shootPress = true;
      }
      if ((opp.action.type === "layup" || opp.action.type === "dunk") && gap < 2.2 && t > react + 0.05) {
        this.contestUsed = true;
        if (chance(0.35 + this.skill * 0.35 + r.block / 400)) it.shootPress = true;
      }
    }
    // Gamble for steals
    const trickBonus = oa === "trick" ? 3 : 1;
    if (gap < 1.35 && me.stealCd <= 0 && !opp.action?.type?.match(/shoot|layup|dunk|special/)) {
      if (chance(_dt * me.baller.aggression * 0.9 * trickBonus * (0.6 + this.skill))) it.juke = true;
    }
  }

  private chaseBall(it: Intent) {
    const b = this.match.ball;
    const me = this.me;
    // Predict where the ball will be reachable
    const lead = b.vel.y > 0 ? 0.5 : 0.25;
    let x = b.pos.x + b.vel.x * lead;
    let z = b.pos.z + b.vel.z * lead;
    if (b.shot && b.shot.t < 0.6) {
      // Box out near the rim while the shot is in the air
      x = b.pos.x * 0.3;
      z = COURT.rimZ + 1.4;
    }
    const d = this.moveTo(it, x, z, 0.3);
    it.turbo = d > 1.5;
    if (
      d < 1.1 &&
      b.pos.y > me.height * 0.9 &&
      b.pos.y < me.height * 1.35 + 0.7 &&
      b.vel.y < 1 &&
      chance(0.25 + this.skill * 0.4)
    ) {
      it.shootPress = true;
    }
  }
}
