import * as THREE from "three";

/**
 * Rig-agnostic procedural posing.
 *
 * Both the procedural "baller" bodies and the Higgsfield rigged GLB expose the
 * same handful of joints. Poses are authored as IK targets (hands, feet) plus
 * torso/head rotations in *character space* (x = character's left, y = up,
 * z = facing). The solver aims whatever bones the rig has at those targets, so
 * one animation set drives any humanoid skeleton.
 */

export interface RigBones {
  hips: THREE.Object3D;
  spine: THREE.Object3D[];
  neck?: THREE.Object3D;
  head: THREE.Object3D;
  armL: [THREE.Object3D, THREE.Object3D, THREE.Object3D];
  armR: [THREE.Object3D, THREE.Object3D, THREE.Object3D];
  legL: [THREE.Object3D, THREE.Object3D, THREE.Object3D];
  legR: [THREE.Object3D, THREE.Object3D, THREE.Object3D];
}

export interface Proportions {
  height: number;
  hipY: number;
  shoulderY: number;
  shoulderHalf: number;
  armLen: number;
  legLen: number;
  hipHalf: number;
  ankleY: number;
  headY: number;
}

export interface PoseTargets {
  /** Offset of the hips from rest (character space). Negative y = crouch. */
  hipsOffset: THREE.Vector3;
  /** Pitch (fwd lean), yaw (twist), roll of the pelvis */
  hipsRot: THREE.Vector3;
  /** Lean forward (x), twist (y), side bend (z) spread over the spine */
  spineRot: THREE.Vector3;
  headRot: THREE.Vector3;
  handL: THREE.Vector3;
  handR: THREE.Vector3;
  footL: THREE.Vector3;
  footR: THREE.Vector3;
  elbowPoleL: THREE.Vector3;
  elbowPoleR: THREE.Vector3;
  kneePoleL: THREE.Vector3;
  kneePoleR: THREE.Vector3;
  /** 0 = hands follow targets fully */
  footYawL: number;
  footYawR: number;
}

export function createPose(): PoseTargets {
  return {
    hipsOffset: new THREE.Vector3(),
    hipsRot: new THREE.Vector3(),
    spineRot: new THREE.Vector3(),
    headRot: new THREE.Vector3(),
    handL: new THREE.Vector3(),
    handR: new THREE.Vector3(),
    footL: new THREE.Vector3(),
    footR: new THREE.Vector3(),
    elbowPoleL: new THREE.Vector3(0.4, -0.2, -1),
    elbowPoleR: new THREE.Vector3(-0.4, -0.2, -1),
    kneePoleL: new THREE.Vector3(0.15, 0, 1),
    kneePoleR: new THREE.Vector3(-0.15, 0, 1),
    footYawL: 0,
    footYawR: 0,
  };
}

export function copyPose(dst: PoseTargets, src: PoseTargets) {
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

/** Blend b into a by t (in place on out) */
export function blendPose(out: PoseTargets, a: PoseTargets, b: PoseTargets, t: number) {
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

interface RestState {
  q: THREE.Quaternion;
  p: THREE.Vector3;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _e = new THREE.Euler();

export class RigPoser {
  readonly proportions: Proportions;
  private rest = new Map<THREE.Object3D, RestState>();
  private restHipsLocal = new THREE.Vector3();
  /** Rest orientation of feet / head relative to the character root */
  private restFootL = new THREE.Quaternion();
  private restFootR = new THREE.Quaternion();
  private restHead = new THREE.Quaternion();
  private rootQ = new THREE.Quaternion();
  private rootQInv = new THREE.Quaternion();

  constructor(
    private root: THREE.Object3D,
    private bones: RigBones,
  ) {
    const all = [
      bones.hips,
      ...bones.spine,
      bones.neck,
      bones.head,
      ...bones.armL,
      ...bones.armR,
      ...bones.legL,
      ...bones.legR,
    ].filter(Boolean) as THREE.Object3D[];
    for (const b of all) this.rest.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
    this.root.updateMatrixWorld(true);
    this.readRoot();
    this.toRootLocal(bones.hips, this.restHipsLocal);
    this.relToRoot(bones.legL[2], this.restFootL);
    this.relToRoot(bones.legR[2], this.restFootR);
    this.relToRoot(bones.head, this.restHead);
    this.proportions = this.measure();
  }

  private readRoot() {
    this.root.getWorldQuaternion(this.rootQ);
    this.rootQInv.copy(this.rootQ).invert();
  }

  private toRootLocal(o: THREE.Object3D, out: THREE.Vector3) {
    o.getWorldPosition(out);
    return this.root.worldToLocal(out);
  }

  private relToRoot(o: THREE.Object3D, out: THREE.Quaternion) {
    o.getWorldQuaternion(out);
    out.premultiply(this.rootQInv);
  }

  private measure(): Proportions {
    const b = this.bones;
    const p = (o: THREE.Object3D) => this.toRootLocal(o, new THREE.Vector3());
    const hips = p(b.hips);
    const shL = p(b.armL[0]);
    const shR = p(b.armR[0]);
    const elL = p(b.armL[1]);
    const whL = p(b.armL[2]);
    const thL = p(b.legL[0]);
    const thR = p(b.legR[0]);
    const knL = p(b.legL[1]);
    const anL = p(b.legL[2]);
    const head = p(b.head);
    const armLen = shL.distanceTo(elL) + elL.distanceTo(whL);
    const legLen = thL.distanceTo(knL) + knL.distanceTo(anL);
    const height = Math.max(head.y * 1.12, hips.y * 1.9);
    return {
      height,
      hipY: hips.y,
      shoulderY: (shL.y + shR.y) / 2,
      shoulderHalf: Math.abs(shL.x - shR.x) / 2,
      armLen,
      legLen,
      hipHalf: Math.abs(thL.x - thR.x) / 2,
      ankleY: anL.y,
      headY: head.y,
    };
  }

  private reset() {
    for (const [bone, r] of this.rest) {
      bone.quaternion.copy(r.q);
      bone.position.copy(r.p);
    }
  }

  /** Rotate a bone by a world-space rotation about its own pivot */
  private rotateWorld(bone: THREE.Object3D, rw: THREE.Quaternion) {
    const parent = bone.parent!;
    parent.getWorldQuaternion(_q2);
    _q3.copy(_q2).invert().multiply(rw).multiply(_q2);
    bone.quaternion.premultiply(_q3);
    bone.updateMatrixWorld(true);
  }

  /** Rotation expressed in character space → world space */
  private charRot(x: number, y: number, z: number, out: THREE.Quaternion) {
    _e.set(x, y, z, "YXZ");
    out.setFromEuler(_e);
    return out.premultiply(this.rootQ).multiply(this.rootQInv);
  }

  private setWorldQuat(bone: THREE.Object3D, qw: THREE.Quaternion) {
    bone.parent!.getWorldQuaternion(_q2);
    bone.quaternion.copy(_q2.invert().multiply(qw));
    bone.updateMatrixWorld(true);
  }

  private aim(bone: THREE.Object3D, child: THREE.Object3D, targetWorld: THREE.Vector3) {
    bone.getWorldPosition(_v1);
    child.getWorldPosition(_v2);
    _v2.sub(_v1).normalize();
    _v3.copy(targetWorld).sub(_v1);
    if (_v3.lengthSq() < 1e-8) return;
    _v3.normalize();
    _q1.setFromUnitVectors(_v2, _v3);
    this.rotateWorld(bone, _q1);
  }

  private solveLimb(
    chain: [THREE.Object3D, THREE.Object3D, THREE.Object3D],
    target: THREE.Vector3,
    pole: THREE.Vector3,
  ) {
    const [a, b, c] = chain;
    const S = a.getWorldPosition(new THREE.Vector3());
    const E = b.getWorldPosition(new THREE.Vector3());
    const W = c.getWorldPosition(new THREE.Vector3());
    const l1 = S.distanceTo(E);
    const l2 = E.distanceTo(W);
    const T = this.root.localToWorld(_v4.copy(target));
    const toT = T.clone().sub(S);
    let d = toT.length();
    if (d < 1e-5) return;
    const dir = toT.divideScalar(d);
    d = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-3), (l1 + l2) * 0.9995);
    const poleW = pole.clone().applyQuaternion(this.rootQ);
    poleW.addScaledVector(dir, -poleW.dot(dir));
    if (poleW.lengthSq() < 1e-6) poleW.set(0, 0, 1).applyQuaternion(this.rootQ);
    poleW.normalize();
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const elbow = S.clone().addScaledVector(dir, along).addScaledVector(poleW, h);
    this.aim(a, b, elbow);
    const end = S.clone().addScaledVector(dir, d);
    this.aim(b, c, end);
  }

  apply(p: PoseTargets) {
    const b = this.bones;
    this.reset();
    this.root.updateMatrixWorld(true);
    this.readRoot();

    // Pelvis translation
    const hipsWorld = this.root.localToWorld(_v4.copy(this.restHipsLocal).add(p.hipsOffset));
    b.hips.parent!.worldToLocal(hipsWorld);
    b.hips.position.copy(hipsWorld);
    b.hips.updateMatrixWorld(true);

    // Pelvis rotation
    this.rotateWorld(b.hips, this.charRot(p.hipsRot.x, p.hipsRot.y, p.hipsRot.z, new THREE.Quaternion()));

    // Spine: spread lean/twist across the chain
    const n = b.spine.length;
    if (n) {
      const q = new THREE.Quaternion();
      for (const s of b.spine) {
        this.rotateWorld(s, this.charRot(p.spineRot.x / n, p.spineRot.y / n, p.spineRot.z / n, q));
      }
    }

    // Head: mostly stabilized so the eyes stay on the play
    const headStable = this.charRot(p.headRot.x, p.headRot.y, p.headRot.z, new THREE.Quaternion());
    headStable.multiply(this.rootQ).multiply(this.restHead);
    const headNow = b.head.getWorldQuaternion(new THREE.Quaternion());
    headNow.slerp(headStable, 0.75);
    this.setWorldQuat(b.head, headNow);

    // Limbs
    this.solveLimb(b.armL, p.handL, p.elbowPoleL);
    this.solveLimb(b.armR, p.handR, p.elbowPoleR);
    this.solveLimb(b.legL, p.footL, p.kneePoleL);
    this.solveLimb(b.legR, p.footR, p.kneePoleR);

    // Keep feet flat on the floor
    const fq = new THREE.Quaternion();
    this.setWorldQuat(b.legL[2], this.charRot(0, p.footYawL, 0, fq).multiply(this.rootQ).multiply(this.restFootL));
    this.setWorldQuat(b.legR[2], this.charRot(0, p.footYawR, 0, fq).multiply(this.rootQ).multiply(this.restFootR));
  }
}

/* ------------------------------------------------------------------ */
/* Bone discovery for arbitrary humanoid GLB rigs (Meshy, Mixamo, UE…) */

function sideOf(name: string): "L" | "R" | null {
  const n = name.toLowerCase();
  if (n.includes("left")) return "L";
  if (n.includes("right")) return "R";
  if (/(^|[^a-z])l([^a-z]|$)/.test(n)) return "L";
  if (/(^|[^a-z])r([^a-z]|$)/.test(n)) return "R";
  return null;
}

function partOf(name: string): string | null {
  const n = name
    .toLowerCase()
    .replace(/mixamorig\d*[:_]?/, "")
    .replace(/left|right/g, "")
    .replace(/(^|[^a-z])[lr](?=[^a-z]|$)/g, "$1")
    .replace(/[^a-z]/g, "");
  if (/thumb|index|middle|ring|pinky|finger|toe|end|top|eye|jaw|twist/.test(n)) return null;
  if (n.includes("hand")) return "hand";
  if (n.includes("forearm") || n.includes("lowerarm")) return "fore";
  if (n.includes("shoulder") || n.includes("clavicle")) return null;
  if (n.includes("upperarm") || n === "arm") return "upper";
  if (n.includes("upleg") || n.includes("thigh") || n.includes("upperleg")) return "thigh";
  if (n.includes("calf") || n.includes("shin") || n.includes("lowerleg") || n === "leg" || n === "knee") return "shin";
  if (n.includes("foot") || n.includes("ankle")) return "foot";
  if (n.includes("hips") || n.includes("pelvis")) return "hips";
  if (n.includes("spine") || n.includes("chest")) return "spine";
  if (n.includes("neck")) return "neck";
  if (n.includes("head")) return "head";
  return null;
}

function depth(o: THREE.Object3D) {
  let d = 0;
  let p = o.parent;
  while (p) {
    d++;
    p = p.parent;
  }
  return d;
}

export function findHumanoidBones(model: THREE.Object3D): RigBones | null {
  const found: Record<string, THREE.Object3D[]> = {};
  model.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    const part = partOf(o.name);
    if (!part) return;
    const side = ["hand", "fore", "upper", "thigh", "shin", "foot"].includes(part) ? sideOf(o.name) : "";
    if (side === null) return;
    const key = part + side;
    (found[key] ??= []).push(o);
  });
  const first = (k: string) => found[k]?.sort((a, b) => depth(a) - depth(b))[0];
  const hips = first("hips");
  const head = first("head");
  const need = [
    "upperL",
    "foreL",
    "handL",
    "upperR",
    "foreR",
    "handR",
    "thighL",
    "shinL",
    "footL",
    "thighR",
    "shinR",
    "footR",
  ];
  if (!hips || !head || need.some((k) => !first(k))) return null;
  const spine = (found["spine"] ?? []).sort((a, b) => depth(a) - depth(b));
  return {
    hips,
    spine,
    neck: first("neck"),
    head,
    armL: [first("upperL")!, first("foreL")!, first("handL")!],
    armR: [first("upperR")!, first("foreR")!, first("handR")!],
    legL: [first("thighL")!, first("shinL")!, first("footL")!],
    legR: [first("thighR")!, first("shinR")!, first("footR")!],
  };
}
