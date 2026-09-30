import * as THREE from "three";
import type { Venue } from "~/data/venues";
import { COURT, THREE_CORNER_Z } from "./constants";
import { skyTexture } from "./stage";

export interface CourtScene {
  group: THREE.Group;
  /** Lights that dim during a special move */
  dimmables: { light: THREE.Light; base: number }[];
  /** Crowd instances bob with hype */
  crowd?: THREE.InstancedMesh;
  crowdBase: THREE.Matrix4[];
  /** Rim group (wobbles on dunks) */
  rim: THREE.Group;
  net: THREE.Mesh;
  update(t: number, dt: number, hype: number): void;
  flash(intensity: number): void;
}

const PX = 80; // texture pixels per meter

function floorTexture(v: Venue) {
  const W = (COURT.halfWidth * 2 + 3) * PX;
  const D = (COURT.length + 3) * PX;
  const c = document.createElement("canvas");
  c.width = Math.round(W);
  c.height = Math.round(D);
  const g = c.getContext("2d")!;
  // texture coords: x ∈ [-halfWidth-1.5, +], z ∈ [-1.5, length+1.5]
  const tx = (x: number) => (x + COURT.halfWidth + 1.5) * PX;
  const tz = (z: number) => (z + 1.5) * PX;

  g.fillStyle = v.floor;
  g.fillRect(0, 0, c.width, c.height);
  const indoor = v.theme === "school" || v.theme === "arena" || v.theme === "gym";
  if (indoor) {
    // Maple hardwood: plank seams and per-board tint
    for (let x = 0; x < c.width; x += 0.08 * PX) {
      for (let y = -Math.random() * 200; y < c.height;) {
        const len = (1.5 + Math.random() * 2.5) * PX;
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "90,50,20" : "255,230,190"},${Math.random() * 0.12})`;
        g.fillRect(x, y, 0.08 * PX, len);
        g.fillStyle = "rgba(60,30,10,0.25)";
        g.fillRect(x, y + len - 1, 0.08 * PX, 1);
        y += len;
      }
      g.fillStyle = "rgba(60,30,10,0.2)";
      g.fillRect(x, 0, 1, c.height);
    }
  }
  // Concrete / asphalt grain
  for (let i = 0; i < (indoor ? 8000 : 60000); i++) {
    const a = Math.random() * 0.08;
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.6})`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }
  // Cracks
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.lineWidth = 2;
  for (let i = 0; i < (indoor ? 0 : 14); i++) {
    let x = Math.random() * c.width;
    let y = Math.random() * c.height;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (Math.random() - 0.5) * 60;
      y += (Math.random() - 0.3) * 50;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Painted playing area
  g.fillStyle = v.paint;
  g.globalAlpha = 0.85;
  g.fillRect(tx(-COURT.halfWidth), tz(0), COURT.halfWidth * 2 * PX, COURT.length * PX);
  // Key
  g.fillStyle = v.paintAlt;
  g.fillRect(tx(-COURT.laneHalfWidth), tz(0), COURT.laneHalfWidth * 2 * PX, COURT.laneLength * PX);
  // Three point area tint
  g.globalAlpha = 0.18;
  g.beginPath();
  g.moveTo(tx(-COURT.threeCornerX), tz(0));
  g.lineTo(tx(-COURT.threeCornerX), tz(THREE_CORNER_Z));
  const a0 = Math.atan2(THREE_CORNER_Z - COURT.rimZ, -COURT.threeCornerX);
  const a1 = Math.atan2(THREE_CORNER_Z - COURT.rimZ, COURT.threeCornerX);
  g.arc(tx(0), tz(COURT.rimZ), COURT.threeRadius * PX, a0, a1, true);
  g.lineTo(tx(COURT.threeCornerX), tz(0));
  g.closePath();
  g.fillStyle = "#ffffff";
  g.fill();
  g.globalAlpha = 1;

  // Lines
  g.strokeStyle = v.line;
  g.lineWidth = 0.06 * PX;
  g.strokeRect(tx(-COURT.halfWidth), tz(0), COURT.halfWidth * 2 * PX, COURT.length * PX);
  g.strokeRect(tx(-COURT.laneHalfWidth), tz(0), COURT.laneHalfWidth * 2 * PX, COURT.laneLength * PX);
  g.beginPath();
  g.arc(tx(0), tz(COURT.laneLength), 1.8 * PX, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(tx(-COURT.threeCornerX), tz(0));
  g.lineTo(tx(-COURT.threeCornerX), tz(THREE_CORNER_Z));
  g.arc(tx(0), tz(COURT.rimZ), COURT.threeRadius * PX, a0, a1, true);
  g.lineTo(tx(COURT.threeCornerX), tz(0));
  g.stroke();
  // Half-court circle
  g.beginPath();
  g.arc(tx(0), tz(COURT.length), 1.8 * PX, Math.PI, Math.PI * 2);
  g.stroke();
  // Restricted arc
  g.beginPath();
  g.arc(tx(0), tz(COURT.rimZ), 1.25 * PX, 0, Math.PI);
  g.stroke();

  if (indoor) {
    // Team name along the baseline + mascot medallion at half court
    const team = v.district.replace("Home of the ", "").toUpperCase();
    g.save();
    g.font = `900 ${0.9 * PX}px 'Bebas Neue', Impact, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = v.paintAlt;
    g.strokeStyle = v.theme === "school" ? "#6a4424" : "#ffffff";
    g.lineWidth = 0.05 * PX;
    g.translate(tx(0), tz(-0.75));
    g.rotate(Math.PI);
    g.fillText(team, 0, 0);
    g.strokeText(team, 0, 0);
    g.restore();
    g.save();
    g.translate(tx(0), tz(COURT.length));
    g.fillStyle = v.paintAlt;
    g.beginPath();
    g.arc(0, 0, 1.75 * PX, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = `900 ${1.3 * PX}px 'Bebas Neue', Impact, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.rotate(Math.PI);
    g.fillText(
      team
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 3),
      0,
      0.9 * PX,
    );
    g.restore();
  } else {
    // Center logo: a crown
    g.save();
    g.translate(tx(0), tz(COURT.checkZ + 2.2));
    g.globalAlpha = 0.5;
    g.fillStyle = v.line;
    g.beginPath();
    const s = 0.9 * PX;
    g.moveTo(-s, s * 0.5);
    g.lineTo(-s, -s * 0.4);
    g.lineTo(-s * 0.5, s * 0.05);
    g.lineTo(0, -s * 0.6);
    g.lineTo(s * 0.5, s * 0.05);
    g.lineTo(s, -s * 0.4);
    g.lineTo(s, s * 0.5);
    g.closePath();
    g.fill();
    g.font = `900 ${0.5 * PX}px 'Bebas Neue', Impact, sans-serif`;
    g.textAlign = "center";
    g.fillText("CONCRETE CROWN", 0, s * 1.3);
    g.restore();

    // Graffiti tag near the corner
    g.save();
    g.translate(tx(-5.5), tz(10.5));
    g.rotate(-0.3);
    g.font = `italic 900 ${0.9 * PX}px Impact, sans-serif`;
    g.globalAlpha = 0.35;
    g.fillStyle = v.accent;
    g.fillText(v.name.toUpperCase(), 0, 0);
    g.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function brickTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#6e6258";
  g.fillRect(0, 0, 256, 256);
  const bw = 64;
  const bh = 24;
  for (let row = 0; row * bh < 256; row++) {
    for (let col = -1; col * bw < 256; col++) {
      const x = col * bw + (row % 2 ? bw / 2 : 0);
      const tint = 110 + Math.random() * 40;
      g.fillStyle = `rgb(${tint + 40},${tint * 0.55},${tint * 0.42})`;
      g.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Night windows texture for skyscrapers (shared with the city hub) */
export function windowTexture(lit = 0.45) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b0e1a";
  g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 8)
    for (let x = 4; x < 64; x += 8)
      if (Math.random() < lit) {
        g.fillStyle = Math.random() < 0.8 ? "#ffd98a" : "#9fd7ff";
        g.fillRect(x, y, 4, 5);
      }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function mat(color: string, roughness = 0.6, metalness = 0, emissive?: string, ei = 1) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  if (emissive) {
    m.emissive = new THREE.Color(emissive);
    m.emissiveIntensity = ei;
  }
  return m;
}

function box(
  w: number,
  h: number,
  d: number,
  m: THREE.Material,
  x: number,
  y: number,
  z: number,
  parent: THREE.Object3D,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function textSign(text: string, color: string, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(0,0,0,0)";
  g.fillRect(0, 0, c.width, c.height);
  g.font = `900 ${c.height * 0.7}px 'Bebas Neue', Impact, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2);
  g.fillStyle = "#ffffff";
  g.shadowBlur = 0;
  g.globalAlpha = 0.6;
  g.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, side: THREE.DoubleSide }),
  );
}

function fenceTexture(color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(64, 64);
  g.moveTo(64, 0);
  g.lineTo(0, 64);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildHoop(group: THREE.Group, v: Venue) {
  const metal = mat(v.theme === "crown" ? "#c9a24a" : "#2b3140", 0.4, 0.7);
  // Pole & arm
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 16), metal);
  pole.position.set(0, 1.8, -0.9);
  pole.castShadow = true;
  group.add(pole);
  const arm = box(0.12, 0.12, 2.2, metal, 0, 3.4, 0.15, group);
  arm.rotation.x = 0.12;
  // Padding
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.9, 16), mat(v.accent, 0.8));
  pad.position.set(0, 0.95, -0.9);
  group.add(pad);
  // Backboard (glass-ish with a painted frame)
  const bw = COURT.backboardHalfWidth * 2;
  const bh = COURT.backboardTop - COURT.backboardBottom;
  const bb = new THREE.Mesh(
    new THREE.BoxGeometry(bw, bh, 0.05),
    new THREE.MeshPhysicalMaterial({
      color: "#dfe8f5",
      roughness: 0.05,
      transmission: 0.6,
      transparent: true,
      opacity: 0.55,
      thickness: 0.05,
    }),
  );
  bb.position.set(0, (COURT.backboardBottom + COURT.backboardTop) / 2, COURT.backboardZ - 0.025);
  group.add(bb);
  const frameM = mat("#f2f2f2", 0.5);
  const frame = new THREE.Group();
  frame.position.copy(bb.position);
  frame.position.z += 0.03;
  const fw = 0.05;
  box(bw, fw, 0.01, frameM, 0, bh / 2 - fw / 2, 0, frame);
  box(bw, fw, 0.01, frameM, 0, -bh / 2 + fw / 2, 0, frame);
  box(fw, bh, 0.01, frameM, bw / 2 - fw / 2, 0, 0, frame);
  box(fw, bh, 0.01, frameM, -bw / 2 + fw / 2, 0, 0, frame);
  // Shooter's square
  const sq = new THREE.Group();
  sq.position.set(0, COURT.rimHeight + 0.15 - (COURT.backboardBottom + COURT.backboardTop) / 2 + 0.07, 0);
  box(0.59, 0.05, 0.01, frameM, 0, 0.225, 0, sq);
  box(0.05, 0.45, 0.01, frameM, 0.27, 0, 0, sq);
  box(0.05, 0.45, 0.01, frameM, -0.27, 0, 0, sq);
  frame.add(sq);
  group.add(frame);

  // Rim
  const rim = new THREE.Group();
  rim.position.set(0, COURT.rimHeight, COURT.rimZ);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(COURT.rimRadius, 0.012, 10, 40), mat("#ff5a1f", 0.35, 0.6));
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  rim.add(ring);
  const bracket = box(0.08, 0.03, COURT.rimZ - COURT.backboardZ - COURT.rimRadius + 0.02, ring.material, 0, 0, 0, rim);
  bracket.position.z = -(COURT.rimRadius + (COURT.rimZ - COURT.backboardZ - COURT.rimRadius) / 2);
  // Chain / string net as a tapered open cylinder with a grid texture
  const netTexC = document.createElement("canvas");
  netTexC.width = netTexC.height = 64;
  const ng = netTexC.getContext("2d")!;
  ng.strokeStyle = v.theme === "cage" || v.theme === "crown" ? "#c9c9d2" : "#ffffff";
  ng.lineWidth = 3;
  ng.beginPath();
  ng.moveTo(0, 0);
  ng.lineTo(64, 64);
  ng.moveTo(64, 0);
  ng.lineTo(0, 64);
  ng.stroke();
  const netTex = new THREE.CanvasTexture(netTexC);
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  netTex.repeat.set(10, 3);
  const net = new THREE.Mesh(
    new THREE.CylinderGeometry(COURT.rimRadius, COURT.rimRadius * 0.62, 0.42, 20, 4, true),
    new THREE.MeshStandardMaterial({
      map: netTex,
      alphaTest: 0.3,
      transparent: true,
      side: THREE.DoubleSide,
      metalness: v.theme === "cage" ? 0.8 : 0,
      roughness: 0.6,
    }),
  );
  net.position.y = -0.21;
  rim.add(net);
  group.add(rim);
  return { rim, net };
}

function makeCrowd(v: Venue, group: THREE.Group) {
  if (v.crowd <= 0) return { mesh: undefined, base: [] as THREE.Matrix4[] };
  // One merged "person" silhouette: body capsule + head sphere
  const bodyG = new THREE.CapsuleGeometry(0.22, 0.75, 4, 8);
  bodyG.translate(0, 0.6, 0);
  const headG = new THREE.SphereGeometry(0.14, 10, 8);
  headG.translate(0, 1.34, 0);
  const geo = mergeGeos([bodyG, headG]);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), v.crowd);
  mesh.castShadow = true;
  const palette = ["#e84a5f", "#2a9df4", "#f6c343", "#ffffff", "#1b1b22", "#3ddc97", "#9b5de5", "#ff8c42", "#8d99ae"];
  const skins = ["#6b4430", "#a86f4c", "#e2b894", "#4a2d20", "#c68c63"];
  const base: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < v.crowd; i++) {
    // Along the sidelines and behind the half-court line
    const r = Math.random();
    let x: number;
    let z: number;
    if (r < 0.35) {
      x = -COURT.halfWidth - 1.6 - Math.random() * 1.6;
      z = 1 + Math.random() * 12;
    } else if (r < 0.7) {
      x = COURT.halfWidth + 1.6 + Math.random() * 1.6;
      z = 1 + Math.random() * 12;
    } else {
      x = (Math.random() - 0.5) * 13;
      z = COURT.length + 2.2 + Math.random() * 2;
    }
    let y = 0;
    if (v.theme === "arena") {
      // Fans sit in the tiered stands, wearing the home colors more often
      const tier = Math.floor(Math.random() * 8);
      const off = 2.2 + tier * 1.1;
      y = 0.95 + tier * 0.9 - 0.5;
      if (r < 0.35) x = -COURT.halfWidth - off;
      else if (r < 0.7) x = COURT.halfWidth + off;
      else z = COURT.length + off;
      z = r < 0.7 ? -8 + Math.random() * 28 : z;
      if (r >= 0.7) x = (Math.random() - 0.5) * (COURT.halfWidth * 2 + off * 2);
    }
    if (v.theme === "school") {
      // Pull-out bleachers along both sidelines
      const tier = Math.floor(Math.random() * 5);
      const off = 2.4 + tier * 0.8;
      y = tier * 0.45 + 0.1;
      x = (r < 0.5 ? -1 : 1) * (COURT.halfWidth + off);
      z = -1 + Math.random() * 15;
    }
    const face = Math.atan2(-x, 6 - z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), face);
    const s = 0.9 + Math.random() * 0.25;
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
    mesh.setMatrixAt(i, m);
    base.push(m.clone());
    const home = (v.theme === "arena" || v.theme === "school") && Math.random() < 0.45 ? v.accent : null;
    mesh.setColorAt(
      i,
      new THREE.Color(home ?? (Math.random() < 0.2 ? skins[i % skins.length] : palette[i % palette.length])),
    );
  }
  mesh.instanceColor!.needsUpdate = true;
  group.add(mesh);
  return { mesh, base };
}

function mergeGeos(geos: THREE.BufferGeometry[]) {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  let off = 0;
  for (const g0 of geos) {
    const g = g0.index ? g0 : g0;
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    const index = g.index!;
    for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + off);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

function lampPost(
  group: THREE.Group,
  x: number,
  z: number,
  color: string,
  intensity: number,
  dimmables: CourtScene["dimmables"],
  shadow: boolean,
) {
  const pm = mat("#1d2029", 0.5, 0.6);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 7, 10), pm);
  pole.position.set(x, 3.5, z);
  group.add(pole);
  const head = box(0.6, 0.18, 0.35, mat("#222", 0.4, 0.5, color, 3), x - Math.sign(x) * 0.25, 7, z, group);
  head.castShadow = false;
  const light = new THREE.SpotLight(color, intensity * 40, 26, 0.85, 0.55, 1.6);
  light.position.set(x - Math.sign(x) * 0.3, 6.9, z);
  light.target.position.set(x * 0.2, 0, z * 0.9 + 1);
  light.castShadow = shadow;
  if (shadow) {
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0005;
  }
  group.add(light, light.target);
  dimmables.push({ light, base: light.intensity });
}

export function buildCourt(v: Venue, opts: { shadows: boolean }): CourtScene {
  const group = new THREE.Group();
  const dimmables: CourtScene["dimmables"] = [];

  // Sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.MeshBasicMaterial({
      map: skyTexture(v.sky[0], v.sky[1]),
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  group.add(sky);

  // Ground apron + court
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(v.floor).multiplyScalar(0.55), roughness: 0.95 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.01;
  apron.receiveShadow = true;
  group.add(apron);

  const floorW = COURT.halfWidth * 2 + 3;
  const floorD = COURT.length + 3;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorW, floorD),
    new THREE.MeshStandardMaterial({
      map: floorTexture(v),
      roughness: v.wet ? 0.18 : 0.88,
      metalness: v.wet ? 0.25 : 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, COURT.length / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // Lights
  const hemi = new THREE.HemisphereLight(v.hemi.sky, v.hemi.ground, v.hemi.intensity);
  group.add(hemi);
  dimmables.push({ light: hemi, base: hemi.intensity });
  const sun = new THREE.DirectionalLight(v.sun.color, v.sun.intensity);
  const d = new THREE.Vector3(...v.sun.dir).normalize();
  sun.position.copy(d.multiplyScalar(20)).add(new THREE.Vector3(0, 0, 7));
  sun.target.position.set(0, 0, 7);
  sun.castShadow = opts.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.0004;
  group.add(sun, sun.target);
  dimmables.push({ light: sun, base: sun.intensity });

  if (v.lamps.intensity > 0) {
    lampPost(
      group,
      -COURT.halfWidth - 1.2,
      3,
      v.lamps.color,
      v.lamps.intensity,
      dimmables,
      opts.shadows && v.sun.intensity < 1,
    );
    lampPost(group, COURT.halfWidth + 1.2, 10, v.lamps.color, v.lamps.intensity, dimmables, false);
  }

  const { rim, net } = buildHoop(group, v);
  const crowd = makeCrowd(v, group);

  const extras: ((t: number, dt: number) => void)[] = [];
  let flashLight: THREE.PointLight | null = null;

  switch (v.theme) {
    case "harbor": {
      // Water, cranes, containers
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 60),
        new THREE.MeshStandardMaterial({ color: "#2a3f6a", roughness: 0.15, metalness: 0.4 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, -0.3, -32);
      group.add(water);
      const craneM = mat("#c2452d", 0.6, 0.3);
      for (const [x, z] of [
        [-22, -30],
        [10, -38],
        [30, -28],
      ]) {
        box(0.8, 22, 0.8, craneM, x, 11, z, group);
        box(0.8, 22, 0.8, craneM, x + 5, 11, z, group);
        box(18, 1, 1, craneM, x + 4, 22, z + 4, group).rotation.y = 0.3;
      }
      const cols = ["#2d6cdf", "#d9542c", "#e8b33a", "#3d9b6b"];
      for (let i = 0; i < 14; i++) {
        box(
          6,
          2.5,
          2.4,
          mat(cols[i % 4], 0.8, 0.2),
          -26 + i * 4,
          1.25 + (i % 3 === 0 ? 2.5 : 0),
          -12 - (i % 2) * 3,
          group,
        );
      }
      // Fence
      const fence = new THREE.Mesh(
        new THREE.PlaneGeometry(COURT.halfWidth * 2 + 4, 3.2),
        new THREE.MeshStandardMaterial({
          map: fenceTexture("#9aa0a8"),
          transparent: true,
          alphaTest: 0.3,
          side: THREE.DoubleSide,
        }),
      );
      (fence.material as THREE.MeshStandardMaterial).map!.repeat.set(30, 6);
      fence.position.set(0, 1.6, -2.2);
      group.add(fence);
      // String lights
      const bulbM = mat("#fff2c0", 0.3, 0, "#ffd27a", 4);
      for (let i = 0; i < 24; i++) {
        const x = -9 + i * 0.78;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), bulbM);
        b.position.set(x, 4.2 - Math.sin((i / 23) * Math.PI) * 0.6, -2.1);
        group.add(b);
      }
      break;
    }
    case "cage": {
      // Chain-link cage around the court + elevated train tracks overhead
      const fm = new THREE.MeshStandardMaterial({
        map: fenceTexture("#b8bcc4"),
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        metalness: 0.7,
        roughness: 0.4,
      });
      fm.map!.repeat.set(40, 8);
      const W = COURT.halfWidth * 2 + 2.4;
      for (const [x, z, ry, w] of [
        [0, -1.8, 0, W],
        [-W / 2, 6, Math.PI / 2, 15.6],
        [W / 2, 6, Math.PI / 2, 15.6],
      ] as const) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.5), fm);
        f.position.set(x, 2.25, z);
        f.rotation.y = ry;
        group.add(f);
      }
      const steel = mat("#3a2f2a", 0.7, 0.6);
      for (const z of [-4, 4, 12]) {
        box(1.2, 9, 1.2, steel, -COURT.halfWidth - 4, 4.5, z, group);
        box(1.2, 9, 1.2, steel, COURT.halfWidth + 4, 4.5, z, group);
      }
      box(COURT.halfWidth * 2 + 10, 1.4, 5, steel, 0, 9.5, 4, group);
      // Train that rolls overhead every so often
      const train = new THREE.Group();
      const carM = mat("#8c939c", 0.4, 0.8);
      const winM = mat("#fff0b0", 0.2, 0, "#ffe28a", 3);
      for (let i = 0; i < 4; i++) {
        box(14, 2.6, 3, carM, i * 14.5, 0, 0, train);
        for (let w = 0; w < 6; w++) box(1.2, 0.8, 3.05, winM, i * 14.5 - 5.5 + w * 2.2, 0.3, 0, train);
      }
      train.position.set(-80, 11.5, 4);
      group.add(train);
      let trainT = 6;
      extras.push((_t, dt) => {
        trainT -= dt;
        if (trainT < 0) {
          train.position.x += dt * 26;
          if (train.position.x > 90) {
            train.position.x = -80;
            trainT = 18 + Math.random() * 10;
          }
        }
      });
      break;
    }
    case "neon": {
      // Brick alley walls with neon signs
      const brick = mat("#3a2230", 0.9);
      box(1, 12, 26, brick, -COURT.halfWidth - 3, 6, 6, group);
      box(1, 12, 26, brick, COURT.halfWidth + 3, 6, 6, group);
      box(COURT.halfWidth * 2 + 7, 12, 1, brick, 0, 6, -3, group);
      const signs: [string, string, number, number, number, number][] = [
        ["SILK", "#ff4fd8", -COURT.halfWidth - 2.45, 5, 4, Math.PI / 2],
        ["노래방", "#3ad7ff", COURT.halfWidth + 2.45, 6, 8, -Math.PI / 2],
        ["24H", "#ffe04f", -COURT.halfWidth - 2.45, 7, 11, Math.PI / 2],
        ["NEON ALLEY", "#b46bff", 0, 7.5, -2.45, 0],
      ];
      for (const [text, color, x, y, z, ry] of signs) {
        const s = textSign(text, color, 4, 1.4);
        s.position.set(x, y, z);
        s.rotation.y = ry;
        group.add(s);
        const pl = new THREE.PointLight(color, 18, 12, 1.8);
        pl.position.set(x * 0.85, y - 1, z);
        group.add(pl);
        dimmables.push({ light: pl, base: pl.intensity });
      }
      // Rain streaks
      const rainGeo = new THREE.BufferGeometry();
      const N = 1400;
      const pts = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pts[i * 3] = (Math.random() - 0.5) * 22;
        pts[i * 3 + 1] = Math.random() * 14;
        pts[i * 3 + 2] = Math.random() * 20 - 3;
      }
      rainGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      const rain = new THREE.Points(
        rainGeo,
        new THREE.PointsMaterial({ color: "#c9b8ff", size: 0.05, transparent: true, opacity: 0.55 }),
      );
      group.add(rain);
      extras.push((_t, dt) => {
        const p = rainGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < N; i++) {
          let y = p.getY(i) - dt * 14;
          if (y < 0) y += 14;
          p.setY(i, y);
        }
        p.needsUpdate = true;
      });
      break;
    }
    case "park": {
      const trunk = mat("#5a3d2a", 0.9);
      const leaves = [mat("#2f7d3a", 0.9), mat("#3f9a45", 0.9), mat("#276b33", 0.9)];
      for (let i = 0; i < 16; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * (COURT.halfWidth + 6 + Math.random() * 8);
        const z = -6 + Math.random() * 24;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 8), trunk);
        t.position.set(x, 1.5, z);
        t.castShadow = true;
        group.add(t);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 + Math.random(), 1), leaves[i % 3]);
        crown.position.set(x, 4 + Math.random(), z);
        crown.castShadow = true;
        group.add(crown);
      }
      // Bleachers
      const bm = mat("#c8ccd4", 0.4, 0.7);
      for (let r = 0; r < 4; r++) {
        box(0.5, 0.1, 12, bm, COURT.halfWidth + 1.8 + r * 0.6, 0.4 + r * 0.45, 7, group);
        box(0.5, 0.1, 12, bm, -COURT.halfWidth - 1.8 - r * 0.6, 0.4 + r * 0.45, 7, group);
      }
      // Grass
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat("#4c8a3a", 1));
      grass.rotation.x = -Math.PI / 2;
      grass.position.y = -0.02;
      grass.receiveShadow = true;
      group.add(grass);
      apron.visible = false;
      break;
    }
    case "subway": {
      // Abandoned station: tiled walls, platform edges, tracks, pillars, flickering tubes
      const tile = new THREE.MeshStandardMaterial({ color: "#c9c2a8", roughness: 0.5 });
      const tileC = document.createElement("canvas");
      tileC.width = tileC.height = 64;
      const tg = tileC.getContext("2d")!;
      tg.fillStyle = "#d8d0b4";
      tg.fillRect(0, 0, 64, 64);
      tg.strokeStyle = "#8a826c";
      tg.lineWidth = 2;
      for (let i = 0; i <= 64; i += 16) {
        tg.beginPath();
        tg.moveTo(i, 0);
        tg.lineTo(i, 64);
        tg.moveTo(0, i);
        tg.lineTo(64, i);
        tg.stroke();
      }
      tile.map = new THREE.CanvasTexture(tileC);
      tile.map.wrapS = tile.map.wrapT = THREE.RepeatWrapping;
      tile.map.repeat.set(24, 5);
      tile.map.colorSpace = THREE.SRGBColorSpace;
      box(COURT.halfWidth * 2 + 12, 7, 1, tile, 0, 3.5, -3.5, group);
      box(1, 7, 26, tile, -COURT.halfWidth - 5, 3.5, 6, group);
      box(1, 7, 26, tile, COURT.halfWidth + 5, 3.5, 6, group);
      box(COURT.halfWidth * 2 + 12, 0.6, 26, mat("#1a1712", 0.9), 0, 7.2, 6, group);
      // Track bed along one side (sunken)
      box(3, 0.3, 26, mat("#15120e", 1), COURT.halfWidth + 3, -0.2, 6, group);
      for (const dx of [-0.6, 0.6])
        box(0.1, 0.12, 26, mat("#6a6058", 0.4, 0.8), COURT.halfWidth + 3 + dx, 0.0, 6, group);
      box(0.5, 0.05, 26, mat("#e6c200", 0.6), COURT.halfWidth + 1.3, 0.02, 6, group);
      const pill = mat("#3a4a3a", 0.6, 0.3);
      for (const z of [-1, 5, 11]) {
        box(0.6, 7, 0.6, pill, -COURT.halfWidth - 1.6, 3.5, z, group);
        box(0.6, 7, 0.6, pill, COURT.halfWidth + 1.6, 3.5, z, group);
      }
      const signL = textSign("LINE 0", "#a6ff3a", 5, 1.4);
      signL.position.set(0, 5.5, -2.95);
      group.add(signL);
      // Flickering fluorescent tubes
      const tubes: THREE.PointLight[] = [];
      for (const z of [2, 8]) {
        const tube = new THREE.PointLight("#fff4d0", 14, 14, 1.8);
        tube.position.set(0, 6.5, z);
        group.add(tube);
        tubes.push(tube);
        box(3, 0.1, 0.2, mat("#fff", 0.2, 0, "#fff4d0", 4), 0, 6.8, z, group);
      }
      extras.push((t) => {
        tubes[0].intensity = Math.sin(t * 37) > 0.93 ? 2 : 14;
      });
      apron.material = mat("#24201a", 0.95);
      break;
    }
    case "gym": {
      // Pro training facility: hardwood, padded walls, banners, overhead lights
      const wall = mat("#1b2a55", 0.7);
      box(COURT.halfWidth * 2 + 8, 10, 1, wall, 0, 5, -3, group);
      box(1, 10, 26, wall, -COURT.halfWidth - 4, 5, 6, group);
      box(1, 10, 26, wall, COURT.halfWidth + 4, 5, 6, group);
      box(COURT.halfWidth * 2 + 8, 0.5, 26, mat("#222630", 0.8), 0, 10, 6, group);
      const lightM = mat("#fff", 0.2, 0, "#ffffff", 3);
      for (let x = -4; x <= 4; x += 4) for (let z = 1; z <= 12; z += 5.5) box(1.6, 0.1, 0.8, lightM, x, 9.7, z, group);
      const banner1 = textSign("THE COMBINE", "#6fa8ff", 7, 1.6);
      banner1.position.set(0, 7.5, -2.45);
      group.add(banner1);
      const banner2 = textSign("KANE PERFORMANCE", "#ffffff", 8, 1.2);
      banner2.position.set(-COURT.halfWidth - 3.45, 6.5, 6);
      banner2.rotation.y = Math.PI / 2;
      group.add(banner2);
      // Scout table
      box(5, 0.9, 0.9, mat("#11151f", 0.4), COURT.halfWidth + 2, 0.45, 10, group);
      apron.material = mat("#8a6a44", 0.6);
      break;
    }
    case "spillway": {
      // Concrete storm drain: curved walls, shallow reflective water, green emergency lights
      const conc = mat("#3d4644", 0.9);
      const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 34, 32, 1, true, Math.PI * 0.5, Math.PI), conc);
      tunnel.rotation.x = Math.PI / 2;
      tunnel.rotation.z = Math.PI / 2;
      tunnel.position.set(0, 1, 6);
      (tunnel.material as THREE.MeshStandardMaterial).side = THREE.BackSide;
      group.add(tunnel);
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({
          color: "#0b3a33",
          roughness: 0.05,
          metalness: 0.6,
          transparent: true,
          opacity: 0.5,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, 0.015, 6);
      group.add(water);
      for (const [x, z] of [
        [-9, 0],
        [9, 4],
        [-9, 10],
        [9, 13],
      ]) {
        const l = new THREE.PointLight("#3dffb0", 16, 14, 1.8);
        l.position.set(x, 4, z);
        group.add(l);
        dimmables.push({ light: l, base: l.intensity });
        box(0.4, 0.3, 0.4, mat("#0f0", 0.3, 0, "#3dffb0", 4), x * 1.05, 4, z, group);
      }
      const grate = textSign("DRAIN 4", "#2de0c8", 4, 1.2);
      grate.position.set(0, 6, -4);
      group.add(grate);
      // Dripping water streaks
      const dripGeo = new THREE.BufferGeometry();
      const N = 500;
      const pts = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pts[i * 3] = (Math.random() - 0.5) * 20;
        pts[i * 3 + 1] = Math.random() * 12;
        pts[i * 3 + 2] = Math.random() * 20 - 3;
      }
      dripGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      group.add(
        new THREE.Points(
          dripGeo,
          new THREE.PointsMaterial({ color: "#9ffff0", size: 0.04, transparent: true, opacity: 0.5 }),
        ),
      );
      extras.push((_t, dt) => {
        const p = dripGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < N; i++) {
          let y = p.getY(i) - dt * 9;
          if (y < 0) y += 12;
          p.setY(i, y);
        }
        p.needsUpdate = true;
      });
      apron.material = mat("#1c2422", 0.95);
      break;
    }
    case "glass": {
      // The Architect's arena: glass walls over a night city, neon grid, VIP box
      const glassM = new THREE.MeshPhysicalMaterial({
        color: "#b8a0c8",
        roughness: 0.05,
        transmission: 0.8,
        transparent: true,
        opacity: 0.25,
      });
      for (const [x, z, ry, w] of [
        [0, -3, 0, COURT.halfWidth * 2 + 8],
        [-COURT.halfWidth - 4, 6, Math.PI / 2, 22],
        [COURT.halfWidth + 4, 6, Math.PI / 2, 22],
      ] as const) {
        const g = new THREE.Mesh(new THREE.PlaneGeometry(w, 9), glassM);
        g.position.set(x, 4.5, z);
        g.rotation.y = ry;
        group.add(g);
      }
      const frameM = mat("#2a1a24", 0.3, 0.8);
      for (let x = -COURT.halfWidth - 4; x <= COURT.halfWidth + 4; x += 3.8)
        box(0.12, 9, 0.12, frameM, x, 4.5, -3, group);
      // Neon grid lines in the ceiling
      const neon = mat("#ff3a6e", 0.3, 0, "#ff3a6e", 3);
      for (let z = -2; z <= 14; z += 4) box(COURT.halfWidth * 2 + 8, 0.05, 0.05, neon, 0, 9, z, group);
      const vip = textSign("KANE", "#ff3a6e", 5, 1.4);
      vip.position.set(0, 7.5, -2.9);
      group.add(vip);
      apron.material = mat("#0a0a0e", 0.2, 0.4);
      const win = windowTexture(0.5);
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const r = 50 + Math.random() * 30;
        const h = 30 + Math.random() * 50;
        const w = 5 + Math.random() * 8;
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, w),
          new THREE.MeshStandardMaterial({
            color: "#0b0e1a",
            emissive: "#ffffff",
            emissiveMap: win,
            emissiveIntensity: 0.8,
          }),
        );
        b.position.set(Math.cos(a) * r, h / 2 - 70, Math.sin(a) * r + 6);
        group.add(b);
      }
      break;
    }
    case "school": {
      // High-school gym: brick walls, painted wainscot, banners, bleachers,
      // cheer squad on the baseline, scoreboard and exit signs
      const W = COURT.halfWidth + 7;
      const brick = brickTexture();
      const brickM = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9 });
      const back = box(W * 2, 12, 0.6, brickM, 0, 6, -4.5, group);
      brick.repeat.set(26, 9);
      const sideBrick = brick.clone();
      sideBrick.repeat.set(24, 9);
      sideBrick.needsUpdate = true;
      const sideM = new THREE.MeshStandardMaterial({ map: sideBrick, roughness: 0.9 });
      box(0.6, 12, 32, sideM, -W, 6, 10, group);
      box(0.6, 12, 32, sideM, W, 6, 10, group);
      back.receiveShadow = true;
      // Painted lower wall + trim
      const band = mat(v.paintAlt, 0.7);
      box(W * 2, 2.4, 0.1, band, 0, 1.2, -4.15, group);
      box(W * 2, 0.25, 0.12, mat("#6a4424", 0.6), 0, 2.5, -4.12, group);
      for (const x of [-W + 0.35, W - 0.35]) box(0.1, 2.4, 32, band, x, 1.2, 10, group);
      // Wall pads under the hoop + exit doors
      box(8, 2, 0.3, mat("#15161b", 0.8), 0, 1, -4.0, group);
      for (const x of [-9, 9]) {
        box(2.2, 2.6, 0.2, mat("#1a1b20", 0.6), x, 1.3, -4.05, group);
        box(0.8, 0.3, 0.1, mat("#300", 0.3, 0, "#ff2a2a", 3), x, 3, -4.0, group);
      }
      // Big mascot on the back wall
      const mascot = textSign(v.district.replace("Home of the ", "").toUpperCase(), v.paintAlt, 11, 2.6);
      mascot.position.set(0, 8.3, -4.1);
      group.add(mascot);
      // Championship banners
      const bannerTex = (top: string, mid: string) => {
        const c = document.createElement("canvas");
        c.width = 128;
        c.height = 256;
        const g = c.getContext("2d")!;
        g.fillStyle = v.paintAlt;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(128, 0);
        g.lineTo(128, 210);
        g.lineTo(64, 256);
        g.lineTo(0, 210);
        g.fill();
        g.fillStyle = "#12203a";
        g.textAlign = "center";
        g.font = "900 22px 'Bebas Neue', Impact, sans-serif";
        g.fillText(top, 64, 40);
        g.font = "900 30px 'Bebas Neue', Impact, sans-serif";
        g.fillText(mid, 64, 110);
        g.font = "700 16px sans-serif";
        g.fillText("VARSITY BOYS", 64, 160);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshStandardMaterial({ map: t, transparent: true, side: THREE.DoubleSide, roughness: 0.9 });
      };
      const titles = [
        ["STATE", "CHAMPS"],
        ["CITY", "CHAMPS"],
        ["REGIONAL", "CHAMPS"],
        ["STATE", "FINALS"],
        ["CITY", "CHAMPS"],
      ];
      titles.forEach(([a, b], i) => {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.8), bannerTex(a, b));
        pl.position.set(W - 0.4, 8.2, 2 + i * 2.6);
        pl.rotation.y = -Math.PI / 2;
        group.add(pl);
        const pr = pl.clone();
        pr.position.x = -W + 0.4;
        pr.rotation.y = Math.PI / 2;
        group.add(pr);
      });
      // Scoreboard
      const sb = new THREE.Group();
      box(4.2, 2, 0.4, mat("#0d0f14", 0.4, 0.5), 0, 0, 0, sb);
      const digits = textSign("HOME 00  VISITOR 00", "#ff9a2a", 4, 1);
      digits.position.set(0, 0.2, 0.22);
      sb.add(digits);
      sb.position.set(-7, 7.2, -4.1);
      group.add(sb);
      // Bleachers
      const seat = mat("#8a6a44", 0.7);
      for (let tier = 0; tier < 5; tier++) {
        const off = 2.4 + tier * 0.8;
        for (const sx of [-1, 1])
          box(0.8, 0.12 + tier * 0.45, 17, seat, sx * (COURT.halfWidth + off), (0.12 + tier * 0.45) / 2, 6.5, group);
      }
      // Cheer squad along the back wall
      const cheerBody = new THREE.CapsuleGeometry(0.17, 0.9, 4, 8);
      cheerBody.translate(0, 0.75, 0);
      const cheerHead = new THREE.SphereGeometry(0.12, 10, 8);
      cheerHead.translate(0, 1.5, 0);
      const cheerArms = new THREE.BoxGeometry(0.7, 0.08, 0.08);
      cheerArms.rotateZ(Math.PI / 2 - 0.4);
      cheerArms.translate(0, 1.7, 0);
      const skins = ["#6b4430", "#e2b894", "#a86f4c", "#4a2d20", "#c68c63"];
      const cheerers: THREE.Group[] = [];
      for (let i = 0; i < 12; i++) {
        const x = -8.5 + i * 1.55;
        if (Math.abs(x) < 4.2) continue; // leave the hoop clear
        const cg = new THREE.Group();
        const uni = mat(i % 2 ? "#f2f4f8" : v.paintAlt, 0.6);
        const bm = new THREE.Mesh(cheerBody, uni);
        const hm = new THREE.Mesh(cheerHead, mat(skins[i % skins.length], 0.6));
        const am = new THREE.Mesh(cheerArms, mat(skins[i % skins.length], 0.6));
        bm.castShadow = true;
        cg.add(bm, hm, am);
        cg.position.set(x, 0, -3.3);
        group.add(cg);
        cheerers.push(cg);
      }
      extras.push((t) => {
        cheerers.forEach((cg, i) => {
          cg.position.y = Math.max(0, Math.sin(t * 5 + i * 0.7)) * 0.12;
          cg.children[2].rotation.z = Math.sin(t * 4 + i) * 0.5;
        });
      });
      // Ceiling + light panels
      box(W * 2, 0.4, 34, mat("#2a2320", 0.9), 0, 12, 10, group);
      const lightM = mat("#fff", 0.2, 0, "#ffffff", 3);
      for (let x = -6; x <= 6; x += 4) for (let z = 0; z <= 14; z += 4.5) box(1.8, 0.1, 0.9, lightM, x, 11.7, z, group);
      apron.material = mat("#b8905c", 0.5);
      break;
    }
    case "arena": {
      // Indoor pro arena: tiered stands, jumbotron, rafters, team banners
      const seatM = mat("#1c2130", 0.8);
      for (let tier = 0; tier < 8; tier++) {
        const y = 0.5 + tier * 0.9;
        const off = 2.2 + tier * 1.1;
        box(1.2, 0.9, 30, seatM, -COURT.halfWidth - off, y, 6, group);
        box(1.2, 0.9, 30, seatM, COURT.halfWidth + off, y, 6, group);
        box(COURT.halfWidth * 2 + off * 2, 0.9, 1.2, seatM, 0, y, COURT.length + off, group);
      }
      box(COURT.halfWidth * 2 + 30, 1, 1, mat("#0c0e14", 0.9), 0, 14, -8, group);
      const roofM = mat("#0a0b10", 0.9);
      box(COURT.halfWidth * 2 + 30, 0.5, 40, roofM, 0, 18, 6, group);
      // Jumbotron over center court
      const jumbo = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 5), mat("#111", 0.4, 0.6));
      jumbo.add(shell);
      for (let i = 0; i < 4; i++) {
        const scr = textSign(v.district.toUpperCase(), v.accent, 4.6, 2.6);
        scr.position.set(Math.sin((i * Math.PI) / 2) * 2.52, 0, Math.cos((i * Math.PI) / 2) * 2.52);
        scr.rotation.y = (i * Math.PI) / 2;
        jumbo.add(scr);
      }
      jumbo.position.set(0, 12, COURT.length);
      group.add(jumbo);
      extras.push((_t, dt) => (jumbo.rotation.y += dt * 0.2));
      // Arena lights
      for (const [x, z] of [
        [-5, 3],
        [5, 3],
        [-5, 10],
        [5, 10],
      ]) {
        const l = new THREE.SpotLight("#ffffff", 900, 40, 0.7, 0.4, 1.6);
        l.position.set(x, 16, z);
        l.target.position.set(x * 0.3, 0, z);
        group.add(l, l.target);
        dimmables.push({ light: l, base: l.intensity });
      }
      // Team banner behind the hoop
      const banner = textSign(v.district.replace("Home of the ", "").toUpperCase(), v.accent, 9, 2.2);
      banner.position.set(0, 7, -7.5);
      group.add(banner);
      apron.material = mat("#8a6a44", 0.6);
      break;
    }
    case "crown": {
      // Rooftop edge, gold railing, skyline
      const rail = mat("#c9a24a", 0.3, 0.9);
      const edge = mat("#1c1c24", 0.6, 0.3);
      box(COURT.halfWidth * 2 + 6, 0.5, 22, edge, 0, -0.26, 6, group);
      for (const x of [-COURT.halfWidth - 2.8, COURT.halfWidth + 2.8]) box(0.08, 0.08, 20, rail, x, 1.1, 6, group);
      box(COURT.halfWidth * 2 + 5.6, 0.08, 0.08, rail, 0, 1.1, -3.8, group);
      apron.material = new THREE.MeshStandardMaterial({ color: "#05060c", roughness: 1 });
      apron.position.y = -40;
      // Skyline with lit windows
      const winTex = windowTexture();
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2;
        const r = 45 + Math.random() * 25;
        const h = 20 + Math.random() * 45;
        const w = 5 + Math.random() * 7;
        const m = new THREE.MeshStandardMaterial({
          color: "#0b0e1a",
          emissive: "#ffffff",
          emissiveMap: winTex,
          emissiveIntensity: 0.9,
          roughness: 0.8,
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m);
        b.position.set(Math.cos(a) * r, h / 2 - 50, Math.sin(a) * r + 6);
        group.add(b);
      }
      // Gold crown sculpture behind the hoop
      const crownM = mat("#e2b23a", 0.25, 1, "#6a4a00", 0.4);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.8, 24, 1, true), crownM);
      base.position.set(0, 6, -5);
      group.add(base);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1, 8), crownM);
        const a = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 1.3, 6.9, -5 + Math.sin(a) * 1.3);
        group.add(spike);
      }
      break;
    }
  }

  if (v.storm) {
    flashLight = new THREE.PointLight("#b8c8ff", 0, 200, 0);
    flashLight.position.set(-10, 40, -30);
    group.add(flashLight);
    let next = 4;
    let f = 0;
    extras.push((_t, dt) => {
      next -= dt;
      if (next < 0) {
        f = 1;
        next = 5 + Math.random() * 9;
      }
      f = Math.max(0, f - dt * 3);
      flashLight!.intensity = (f > 0.6 || (f > 0.2 && f < 0.35) ? 1 : 0) * 25000 * f;
      sky.material.color.setScalar(1 + f * 2);
    });
  } else {
    flashLight = new THREE.PointLight("#ffffff", 0, 200, 0);
    flashLight.position.set(0, 20, 8);
    group.add(flashLight);
  }
  let manual = 0;

  return {
    group,
    dimmables,
    crowd: crowd.mesh,
    crowdBase: crowd.base,
    rim,
    net,
    update(t, dt, hype) {
      for (const e of extras) e(t, dt);
      if (crowd.mesh) {
        const m = new THREE.Matrix4();
        const off = new THREE.Matrix4();
        for (let i = 0; i < crowd.base.length; i++) {
          const jump = Math.max(0, Math.sin(t * (6 + (i % 5)) + i)) * 0.18 * hype;
          off.makeTranslation(0, jump + Math.sin(t * 2 + i) * 0.02, 0);
          m.multiplyMatrices(off, crowd.base[i]);
          crowd.mesh.setMatrixAt(i, m);
        }
        crowd.mesh.instanceMatrix.needsUpdate = true;
      }
      if (manual > 0 && flashLight && !v.storm) {
        manual = Math.max(0, manual - dt * 4);
        flashLight.intensity = manual * 3000;
      }
    },
    flash(intensity) {
      manual = intensity;
    },
  };
}
