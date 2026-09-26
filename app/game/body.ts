import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Baller, Look } from "~/data/characters";
import { findHumanoidBones, RigPoser, type RigBones } from "./rig";

/**
 * A character body: a root Object3D (placed & rotated by gameplay) plus a
 * RigPoser that turns pose targets into bone rotations.
 */
export interface Body {
  root: THREE.Group;
  poser: RigPoser;
  /** Materials that glow during specials */
  glowMaterials: THREE.MeshStandardMaterial[];
  kind: "procedural" | "higgsfield";
  dispose(): void;
}

/* ------------------------------------------------------------ helpers */

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness = 0.7, metalness = 0, emissive?: string) {
  const key = `${color}|${roughness}|${metalness}|${emissive ?? ""}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = 0.6;
    }
    matCache.set(key, m);
  }
  return m;
}

function joint(parent: THREE.Object3D, name: string, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function addMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, pos?: THREE.Vector3Like) {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(pos.x, pos.y, pos.z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Tapered capsule spanning from the joint origin to `to` (joint-local) */
function segment(
  parent: THREE.Object3D,
  to: THREE.Vector3,
  r0: number,
  r1: number,
  material: THREE.Material,
  bulge = 0,
  zScale = 1,
) {
  const len = to.length();
  const geo = new THREE.CapsuleGeometry(1, len, 6, 14);
  // Taper: radius r0 at the start (y = +len/2 before flip) to r1 at the end
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const half = len / 2 + 1;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp((half - y) / (2 * half), 0, 1); // 0 at top → 1 at bottom
    const r = THREE.MathUtils.lerp(r0, r1, t) * (1 + bulge * Math.sin(t * Math.PI));
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Cap vertices: keep the hemispheres proportional
    const capY = y > len / 2 ? (y - len / 2) * r : y < -len / 2 ? (y + len / 2) * r : 0;
    const coreY = THREE.MathUtils.clamp(y, -len / 2, len / 2);
    pos.setXYZ(i, x * r, coreY + capY, z * r * zScale);
  }
  geo.computeVertexNormals();
  const m = addMesh(parent, geo, material);
  // Capsule is along +Y (top = start); orient top → origin, bottom → `to`
  const dir = to.clone().normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  m.position.copy(to).multiplyScalar(0.5);
  return m;
}

function lathe(profile: [number, number][], segments = 24) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

function roundedBox(w: number, h: number, d: number, r: number) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r);
  shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h - r * 2,
    bevelEnabled: true,
    bevelSize: r * 0.9,
    bevelThickness: r,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -(h - r * 2) / 2, 0);
  return geo;
}

function numberTexture(num: string, fg: string, trim: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 256);
  g.font = "900 150px 'Bebas Neue', 'Arial Narrow', Impact, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 14;
  g.strokeStyle = trim;
  g.strokeText(num, 128, 138);
  g.fillStyle = fg;
  g.fillText(num, 128, 138);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function contrastText(hex: string) {
  const c = new THREE.Color(hex);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return l > 0.45 ? "#10131a" : "#f6f7fb";
}

/* -------------------------------------------------- procedural baller */

export function buildProceduralBody(baller: Baller): Body {
  const look: Look = baller.look;
  const H = baller.height;
  const b = look.build;
  const root = new THREE.Group();
  root.name = `baller-${baller.id}`;

  const skin = mat(look.skin, 0.55);
  const jersey = mat(look.jersey, 0.8);
  const trim = mat(look.jerseyTrim, 0.7);
  const shorts = mat(look.shorts, 0.85);
  const stripe = mat(look.shortsStripe, 0.7);
  const shoe = mat(look.shoes, 0.45);
  const sole = mat(look.soles, 0.5, 0, look.soles);
  const hair = mat(look.hairColor, 0.9);
  const sock = mat("#f1f1f1", 0.9);
  const dark = mat("#161616", 0.4);
  const white = mat("#f6f6f6", 0.3);
  const gold = mat("#e8c15a", 0.25, 0.9);

  // Landmarks (athletic proportions, ~7.5 heads)
  const hipY = 0.53 * H;
  const shoulderHalf = 0.118 * H * (0.92 + b * 0.1);
  const hipHalf = 0.055 * H * (0.9 + b * 0.1);
  const thighLen = 0.215 * H;
  const shinLen = 0.235 * H;
  const upperArmLen = 0.175 * H;
  const foreArmLen = 0.155 * H;
  const limbR = 0.028 * H * (0.85 + b * 0.25);

  const hips = joint(root, "hips", 0, hipY, 0);
  const spine = joint(hips, "spine", 0, 0.04 * H, 0);
  const chest = joint(spine, "chest", 0, 0.11 * H, 0);
  const neck = joint(chest, "neck", 0, 0.125 * H, 0);
  const head = joint(neck, "head", 0, 0.05 * H, 0.005 * H);

  // Torso — jersey (lathe, elliptical)
  const tw = shoulderHalf;
  const torso = lathe(
    [
      [0.0, -0.1 * H],
      [tw * 0.78, -0.095 * H],
      [tw * 0.8, -0.03 * H],
      [tw * 0.78, 0.04 * H],
      [tw * 0.86, 0.12 * H],
      [tw * 0.93, 0.19 * H],
      [tw * 0.8, 0.225 * H],
      [tw * 0.4, 0.243 * H],
      [0.0, 0.245 * H],
    ],
    28,
  );
  const torsoMesh = addMesh(spine, torso, jersey);
  torsoMesh.scale.set(1, 1, 0.62);
  // Arm-hole & neck trim
  const neckTrim = addMesh(chest, new THREE.TorusGeometry(0.045 * H, 0.006 * H, 8, 24), trim);
  neckTrim.position.set(0, 0.128 * H, 0.004 * H);
  neckTrim.rotation.x = Math.PI / 2 + 0.25;
  neckTrim.scale.set(1, 0.8, 1);
  // Hem trim
  const hem = addMesh(spine, new THREE.TorusGeometry(tw * 0.79, 0.005 * H, 6, 28), trim);
  hem.position.y = -0.085 * H;
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(1, 0.62, 1);

  // Jersey numbers
  const numMat = new THREE.MeshStandardMaterial({
    map: numberTexture(look.number, contrastText(look.jersey), look.jerseyTrim),
    transparent: true,
    roughness: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const front = addMesh(chest, new THREE.PlaneGeometry(0.11 * H, 0.11 * H), numMat);
  front.position.set(0, 0.025 * H, tw * 0.6);
  front.castShadow = false;
  const back = addMesh(chest, new THREE.PlaneGeometry(0.13 * H, 0.13 * H), numMat);
  back.position.set(0, 0.035 * H, -tw * 0.6);
  back.rotation.y = Math.PI;
  back.castShadow = false;

  // Shorts (baggy) around the pelvis
  const shortsTop = lathe(
    [
      [0, 0.02 * H],
      [hipHalf * 1.9, 0.02 * H],
      [hipHalf * 2.05, -0.03 * H],
      [hipHalf * 2.15, -0.08 * H],
      [0, -0.08 * H],
    ],
    24,
  );
  addMesh(hips, shortsTop, shorts).scale.set(1, 1, 0.72);
  const waist = addMesh(hips, new THREE.TorusGeometry(hipHalf * 1.92, 0.008 * H, 6, 24), stripe);
  waist.position.y = 0.018 * H;
  waist.rotation.x = Math.PI / 2;
  waist.scale.set(1, 0.72, 1);

  // Neck + head
  segment(neck, new THREE.Vector3(0, 0.06 * H, 0), 0.034 * H, 0.03 * H, skin);
  const headSize = 0.13 * H * 0.5;
  const skull = lathe(
    [
      [0, -headSize * 1.05],
      [headSize * 0.52, -headSize * 0.98],
      [headSize * 0.8, -headSize * 0.6],
      [headSize * 0.9, -headSize * 0.05],
      [headSize * 0.9, headSize * 0.35],
      [headSize * 0.7, headSize * 0.78],
      [headSize * 0.35, headSize * 0.98],
      [0, headSize],
    ],
    24,
  );
  const headMesh = addMesh(head, skull, skin);
  headMesh.position.y = headSize * 1.05;
  headMesh.scale.set(0.9, 1.02, 1.0);
  const hc = new THREE.Vector3(0, headSize * 1.05, 0); // head center (joint-local)

  // Face
  const eyeWhite = white;
  for (const s of [1, -1]) {
    const eye = addMesh(head, new THREE.SphereGeometry(headSize * 0.13, 10, 8), eyeWhite);
    eye.position.set(s * headSize * 0.32, hc.y + headSize * 0.12, headSize * 0.78);
    eye.scale.set(1.2, 0.8, 0.5);
    const pupil = addMesh(head, new THREE.SphereGeometry(headSize * 0.075, 8, 6), dark);
    pupil.position.set(s * headSize * 0.32, hc.y + headSize * 0.11, headSize * 0.84);
    pupil.scale.set(1, 1, 0.5);
    const brow = addMesh(head, roundedBox(headSize * 0.34, headSize * 0.07, headSize * 0.08, headSize * 0.02), hair);
    brow.position.set(s * headSize * 0.32, hc.y + headSize * 0.3, headSize * 0.8);
    brow.rotation.z = s * -0.12;
    const ear = addMesh(head, new THREE.SphereGeometry(headSize * 0.2, 10, 8), skin);
    ear.position.set(s * headSize * 0.84, hc.y + headSize * 0.05, 0);
    ear.scale.set(0.45, 1, 0.75);
    if (look.earrings) {
      const ring = addMesh(head, new THREE.TorusGeometry(headSize * 0.08, headSize * 0.02, 6, 12), gold);
      ring.position.set(s * headSize * 0.86, hc.y - headSize * 0.18, headSize * 0.02);
      ring.rotation.y = Math.PI / 2;
    }
  }
  const nose = addMesh(head, new THREE.SphereGeometry(headSize * 0.14, 10, 8), skin);
  nose.position.set(0, hc.y - headSize * 0.08, headSize * 0.86);
  nose.scale.set(1.1, 0.9, 0.9);
  const mouth = addMesh(head, new THREE.CapsuleGeometry(headSize * 0.035, headSize * 0.22, 4, 8), mat("#3a1f1a", 0.6));
  mouth.position.set(0, hc.y - headSize * 0.38, headSize * 0.8);
  mouth.rotation.z = Math.PI / 2;

  // Hair styles
  const cap = (scale = 1.04, thetaLen = Math.PI * 0.52, material: THREE.Material = hair) => {
    const g = new THREE.SphereGeometry(headSize * 0.92 * scale, 24, 14, 0, Math.PI * 2, 0, thetaLen);
    const m = addMesh(head, g, material);
    m.position.set(0, hc.y + headSize * 0.08, -headSize * 0.03);
    m.rotation.x = -0.18;
    return m;
  };
  switch (look.hair) {
    case "twists": {
      cap(1.06, Math.PI * 0.55);
      const tipMat = mat(look.hairTip ?? look.hairColor, 0.8);
      const twistGeo = new THREE.CapsuleGeometry(headSize * 0.07, headSize * 0.32, 3, 6);
      const tipGeo = new THREE.SphereGeometry(headSize * 0.085, 6, 5);
      for (let ring = 0; ring < 4; ring++) {
        const phi = 0.15 + ring * 0.3;
        const count = 6 + ring * 4;
        for (let i = 0; i < count; i++) {
          const th = (i / count) * Math.PI * 2 + ring * 0.4;
          const dir = new THREE.Vector3(Math.sin(phi) * Math.sin(th), Math.cos(phi), Math.sin(phi) * Math.cos(th));
          if (dir.z > 0.55 && ring > 1) continue; // keep the forehead clear
          const base = hc.clone().addScaledVector(dir, headSize * 0.92);
          base.y += headSize * 0.05;
          const t = addMesh(head, twistGeo, hair);
          t.position.copy(base).addScaledVector(dir, headSize * 0.16);
          t.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir
              .clone()
              .add(new THREE.Vector3(0, 0.6, 0))
              .normalize(),
          );
          const tip = addMesh(head, tipGeo, tipMat);
          tip.position.copy(t.position).addScaledVector(
            dir
              .clone()
              .add(new THREE.Vector3(0, 0.6, 0))
              .normalize(),
            headSize * 0.22,
          );
        }
      }
      break;
    }
    case "cap": {
      cap(1.02, Math.PI * 0.5);
      const hat = mat(look.jersey, 0.6);
      const dome = addMesh(
        head,
        new THREE.SphereGeometry(headSize * 1.0, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        hat,
      );
      dome.position.set(0, hc.y + headSize * 0.18, -headSize * 0.02);
      dome.rotation.x = -0.15;
      const brim = addMesh(head, roundedBox(headSize * 1.2, headSize * 0.06, headSize * 0.8, headSize * 0.03), hat);
      brim.position.set(0, hc.y + headSize * 0.2, -headSize * 1.1);
      brim.rotation.x = -0.25;
      const btn = addMesh(head, new THREE.SphereGeometry(headSize * 0.1, 8, 6), mat(look.jerseyTrim, 0.5));
      btn.position.set(0, hc.y + headSize * 1.18, -headSize * 0.18);
      break;
    }
    case "shaved": {
      const s = cap(1.005, Math.PI * 0.5);
      s.material = new THREE.MeshStandardMaterial({
        color: look.hairColor,
        roughness: 1,
        transparent: true,
        opacity: 0.45,
      });
      break;
    }
    case "silver-part": {
      cap(1.08, Math.PI * 0.56);
      for (const s of [1, -1]) {
        const swoop = addMesh(head, new THREE.SphereGeometry(headSize * 0.5, 14, 10), hair);
        swoop.position.set(s * headSize * 0.45, hc.y + headSize * 0.62, headSize * 0.42);
        swoop.scale.set(1.0, 0.55, 0.8);
        swoop.rotation.z = s * 0.5;
      }
      break;
    }
    case "afro-puff": {
      cap(1.05, Math.PI * 0.55);
      const puffGeo = new THREE.IcosahedronGeometry(headSize * 0.78, 3);
      const p = puffGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        const n = 1 + 0.06 * Math.sin(v.x * 40) * Math.sin(v.y * 37) * Math.sin(v.z * 43);
        v.multiplyScalar(n);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      puffGeo.computeVertexNormals();
      const puff = addMesh(head, puffGeo, hair);
      puff.position.set(0, hc.y + headSize * 1.35, -headSize * 0.35);
      const cuff = addMesh(head, new THREE.TorusGeometry(headSize * 0.42, headSize * 0.09, 8, 18), gold);
      cuff.position.set(0, hc.y + headSize * 0.82, -headSize * 0.22);
      cuff.rotation.x = Math.PI / 2 - 0.4;
      break;
    }
    case "fade":
    default: {
      cap(1.03, Math.PI * 0.48);
    }
  }
  if (look.headband) {
    const band = addMesh(
      head,
      new THREE.CylinderGeometry(headSize * 0.96, headSize * 0.96, headSize * 0.22, 24, 1, true),
      mat(look.headband, 0.5, 0.2),
    );
    band.position.set(0, hc.y + headSize * 0.42, 0);
    band.scale.set(0.93, 1, 1.02);
    band.rotation.x = -0.12;
  }
  if (look.beard) {
    const beard = addMesh(
      head,
      new THREE.SphereGeometry(headSize * 0.92, 20, 12, Math.PI * 0.14, Math.PI * 0.72, Math.PI * 0.62, Math.PI * 0.3),
      mat(look.beard, 0.95),
    );
    beard.position.copy(hc);
    beard.rotation.y = 0;
    beard.scale.set(0.95, 1.05, 1.02);
  }
  if (look.chain) {
    const chain = addMesh(chest, new THREE.TorusGeometry(0.06 * H, 0.004 * H, 6, 24), gold);
    chain.position.set(0, 0.1 * H, 0.03 * H);
    chain.rotation.x = Math.PI / 2 + 0.55;
  }

  // Arms
  const armL: THREE.Object3D[] = [];
  const armR: THREE.Object3D[] = [];
  for (const s of [1, -1] as const) {
    const shoulder = joint(chest, s > 0 ? "upperArmL" : "upperArmR", s * shoulderHalf, 0.13 * H, -0.004 * H);
    const upperDir = new THREE.Vector3(s * 0.12, -1, 0).normalize().multiplyScalar(upperArmLen);
    const deltoid = addMesh(shoulder, new THREE.SphereGeometry(limbR * 1.55, 12, 10), skin);
    deltoid.scale.set(1, 1.1, 1);
    segment(shoulder, upperDir, limbR * 1.25, limbR * 0.95, skin, 0.12);
    const elbow = joint(shoulder, s > 0 ? "foreArmL" : "foreArmR", upperDir.x, upperDir.y, upperDir.z);
    const foreDir = new THREE.Vector3(0, -1, 0.04).normalize().multiplyScalar(foreArmLen);
    segment(elbow, foreDir, limbR * 1.0, limbR * 0.72, skin, 0.08);
    const wrist = joint(elbow, s > 0 ? "handL" : "handR", foreDir.x, foreDir.y, foreDir.z);
    const palm = addMesh(wrist, roundedBox(limbR * 1.9, limbR * 2.4, limbR * 0.9, limbR * 0.35), skin);
    palm.position.y = -limbR * 1.3;
    const thumb = addMesh(wrist, new THREE.CapsuleGeometry(limbR * 0.32, limbR * 0.9, 3, 6), skin);
    thumb.position.set(-s * limbR * 0.2, -limbR * 0.9, limbR * 0.7);
    thumb.rotation.x = 0.6;
    if (s > 0 && look.sleeveLeft) {
      const sl = mat(look.sleeveLeft, 0.6);
      segment(shoulder, upperDir, limbR * 1.33, limbR * 1.05, sl, 0.1);
      segment(elbow, foreDir.clone().multiplyScalar(0.92), limbR * 1.08, limbR * 0.82, sl, 0.06);
    }
    (s > 0 ? armL : armR).push(shoulder, elbow, wrist);
  }

  // Legs
  const legL: THREE.Object3D[] = [];
  const legR: THREE.Object3D[] = [];
  for (const s of [1, -1] as const) {
    const hipJ = joint(hips, s > 0 ? "thighL" : "thighR", s * hipHalf, -0.04 * H, 0);
    const thighDir = new THREE.Vector3(s * 0.02, -1, 0.0).normalize().multiplyScalar(thighLen);
    segment(hipJ, thighDir, limbR * 1.75, limbR * 1.25, skin, 0.1);
    // Baggy shorts leg
    const legShort = segment(hipJ, thighDir.clone().multiplyScalar(0.72), limbR * 2.3, limbR * 2.05, shorts);
    legShort.castShadow = true;
    const st = segment(hipJ, thighDir.clone().multiplyScalar(0.7), limbR * 0.35, limbR * 0.35, stripe);
    st.position.x += s * limbR * 2.05;
    const knee = joint(hipJ, s > 0 ? "shinL" : "shinR", thighDir.x, thighDir.y, thighDir.z);
    const shinDir = new THREE.Vector3(0, -1, -0.02).normalize().multiplyScalar(shinLen);
    segment(knee, shinDir, limbR * 1.3, limbR * 0.85, skin, 0.18);
    if (s < 0 && look.kneeBraceRight) {
      const brace = addMesh(
        knee,
        new THREE.CylinderGeometry(limbR * 1.55, limbR * 1.45, 0.07 * H, 16),
        mat(look.kneeBraceRight, 0.6),
      );
      brace.position.y = -0.01 * H;
      const pad = addMesh(knee, new THREE.TorusGeometry(limbR * 0.6, limbR * 0.25, 6, 12), mat("#2d3240", 0.5));
      pad.position.set(0, -0.005 * H, limbR * 1.45);
    }
    const ankle = joint(knee, s > 0 ? "footL" : "footR", shinDir.x, shinDir.y, shinDir.z);
    const sockM = addMesh(ankle, new THREE.CylinderGeometry(limbR * 0.95, limbR * 0.9, 0.05 * H, 12), sock);
    sockM.position.y = 0.02 * H;
    const shoeBody = addMesh(ankle, roundedBox(limbR * 2.5, 0.055 * H, 0.15 * H, limbR * 0.6), shoe);
    shoeBody.position.set(0, -0.005 * H, 0.03 * H);
    const soleM = addMesh(ankle, roundedBox(limbR * 2.6, 0.018 * H, 0.155 * H, limbR * 0.3), sole);
    soleM.position.set(0, -0.03 * H, 0.03 * H);
    const collar = addMesh(ankle, new THREE.CylinderGeometry(limbR * 1.2, limbR * 1.25, 0.04 * H, 14), shoe);
    collar.position.y = 0.008 * H;
    (s > 0 ? legL : legR).push(hipJ, knee, ankle);
  }

  // Blob shadow keeps players grounded even with shadows off
  root.add(blobShadow(0.42 * (0.9 + b * 0.15)));

  const bones: RigBones = {
    hips,
    spine: [spine, chest],
    neck,
    head,
    armL: armL as RigBones["armL"],
    armR: armR as RigBones["armR"],
    legL: legL as RigBones["legL"],
    legR: legR as RigBones["legR"],
  };
  root.updateMatrixWorld(true);
  const poser = new RigPoser(root, bones);

  return {
    root,
    poser,
    glowMaterials: [jersey, trim],
    kind: "procedural",
    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      numMat.map?.dispose();
      numMat.dispose();
    },
  };
}

let blobTex: THREE.Texture | null = null;
export function blobShadow(radius: number) {
  if (!blobTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, "rgba(0,0,0,0.55)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.name = "blob";
  m.renderOrder = 1;
  return m;
}

/* ------------------------------------------------- Higgsfield GLB body */

const glbCache = new Map<string, Promise<THREE.Group | null>>();

function loadGlb(urls: string[]): Promise<THREE.Group | null> {
  const key = urls.join("|");
  let p = glbCache.get(key);
  if (!p) {
    p = (async () => {
      const loader = new GLTFLoader();
      for (const url of urls) {
        try {
          const gltf = await loader.loadAsync(url);
          return gltf.scene;
        } catch {
          // try the next source
        }
      }
      return null;
    })();
    glbCache.set(key, p);
  }
  return p;
}

/** Loads a static GLB scene (first source that works) */
export function loadGlbScene(urls: string[]) {
  return loadGlb(urls);
}

/**
 * Loads a Higgsfield-generated rigged GLB and wraps it in a Body.
 * Returns null if it can't be loaded or its skeleton isn't humanoid enough,
 * in which case the caller falls back to the procedural body.
 */
export async function loadHiggsfieldBody(baller: Baller, urls: string[]): Promise<Body | null> {
  const template = await loadGlb(urls);
  if (!template) return null;
  const model = SkeletonUtils.clone(template) as THREE.Group;
  const bones = findHumanoidBones(model);
  if (!bones) {
    console.warn(`[higgsfield] ${baller.id}: no humanoid skeleton found, using procedural body`);
    return null;
  }

  const root = new THREE.Group();
  root.name = `higgsfield-${baller.id}`;
  const holder = new THREE.Group();
  holder.add(model);
  root.add(holder);
  root.updateMatrixWorld(true);

  // Face +Z: the character's left shoulder must end up on +X
  const l = bones.armL[0].getWorldPosition(new THREE.Vector3());
  const r = bones.armR[0].getWorldPosition(new THREE.Vector3());
  const v = l.sub(r);
  holder.rotation.y = Math.atan2(v.z, v.x);
  root.updateMatrixWorld(true);

  // Scale to the character's height, feet on the floor, centered on the hips
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = size.y > 1e-4 ? baller.height / size.y : 1;
  holder.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model);
  const hipsW = bones.hips.getWorldPosition(new THREE.Vector3());
  holder.position.set(-hipsW.x, -box2.min.y, -hipsW.z);
  root.updateMatrixWorld(true);

  const glow: THREE.MeshStandardMaterial[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      const mm = m.material as THREE.MeshStandardMaterial;
      if (mm && "emissive" in mm) {
        m.material = mm.clone();
        glow.push(m.material as THREE.MeshStandardMaterial);
      }
    }
  });
  root.add(blobShadow(0.42));

  const poser = new RigPoser(root, bones);
  return {
    root,
    poser,
    glowMaterials: glow,
    kind: "higgsfield",
    dispose() {
      for (const m of glow) m.dispose();
    },
  };
}
