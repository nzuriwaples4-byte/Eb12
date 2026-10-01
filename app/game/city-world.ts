import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { assetSources, type AssetId } from "~/data/higgsfield-assets";
import { windowTexture } from "./court";
import { rand } from "./math";
import { skyTexture } from "./stage";
import { CITIES, type CityTheme } from "~/data/cities";

/**
 * A New York-style city on a Manhattan grid. Avenues run north/south (z),
 * streets east/west (x). Lots between them get walk-ups with fire escapes
 * and water towers, brownstones, glass towers and an art-deco spire. The
 * center 2x2 blocks are a park with cage courts; a Times Square-style
 * intersection glows with billboards north of it.
 */

export const GRID = {
  avenues: [-120, -60, 0, 60, 120],
  streets: [-120, -80, -40, 0, 40, 80, 120],
  road: 12,
  walk: 3,
  bound: 128,
};

export const PARK = { minX: -54, maxX: 54, minZ: -34, maxZ: 34 };
/** Named places the route turns into POIs */
export const PLACES = {
  spawn: { x: 0, z: 26 },
  courts: [
    { x: -26, z: -16 },
    { x: 26, z: -16 },
    { x: -26, z: 16 },
    { x: 26, z: 16 },
  ],
  story: { x: -6, z: 22 },
  square: { x: 0, z: -80 },
  arena: { x: 30, z: -86.5, ry: 0, lot: { minX: 9, maxX: 51, minZ: -111, maxZ: -89 } },
  shop: { x: -30, z: -73.5, ry: Math.PI, lot: { minX: -51, maxX: -9, minZ: -71, maxZ: -49 } },
  crib: { x: 90, z: 46.5, ry: Math.PI, lot: { minX: 69, maxX: 111, minZ: 49, maxZ: 71 } },
  rec: { x: -90, z: 6.5, ry: Math.PI, lot: { minX: -111, maxX: -69, minZ: 9, maxZ: 31 } },
  fame: { x: 90, z: -6.5, ry: 0, lot: { minX: 69, maxX: 111, minZ: -31, maxZ: -9 } },
};

export interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CityWorld {
  colliders: Box2[];
  circles: { x: number; z: number; r: number }[];
  lots: (Box2 & { park?: boolean })[];
  sidewalkLoops: Box2[];
  update(t: number, dt: number, player: THREE.Vector3): void;
  sun: THREE.DirectionalLight;
  dispose(): void;
}

/* ---------------------------------------------------------------- utils */

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

type Facade = "brick" | "brick2" | "brown" | "glass" | "stone" | "deco";

/** Facade texture = one 12m x 24m tile (4 window columns, 8 floors) */
function facadeTex(kind: Facade) {
  const base = {
    brick: "#8a4a38",
    brick2: "#6e3b2e",
    brown: "#5a3a2c",
    glass: "#35607f",
    stone: "#b1a792",
    deco: "#c7bda6",
  }[kind];
  return tex(128, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 256);
    if (kind.startsWith("brick") || kind === "brown") {
      for (let y = 0; y < 256; y += 5)
        for (let x = (y / 5) % 2 ? 0 : 5; x < 128; x += 10) {
          g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.1})`;
          g.fillRect(x, y, 9, 4);
        }
    }
    if (kind === "glass") {
      for (let y = 0; y < 256; y += 32)
        for (let x = 0; x < 128; x += 32) {
          const lit = Math.random() < 0.18;
          const grd = g.createLinearGradient(x, y, x + 32, y + 32);
          grd.addColorStop(0, lit ? "#ffe2a8" : "#8ec3e6");
          grd.addColorStop(1, lit ? "#e0b060" : "#3d6f94");
          g.fillStyle = grd;
          g.fillRect(x + 1, y + 1, 30, 30);
        }
      return;
    }
    for (let y = 8; y < 256; y += 32)
      for (let x = 6; x < 128; x += 32) {
        const lit = Math.random() < 0.22;
        // Stone lintel + window
        g.fillStyle = kind === "deco" ? "#8f866f" : "rgba(220,210,190,0.55)";
        g.fillRect(x - 2, y - 3, 24, 4);
        g.fillStyle = lit ? "#ffd99a" : "#22303f";
        g.fillRect(x, y, 20, 22);
        g.fillStyle = "rgba(255,255,255,0.18)";
        g.fillRect(x, y, 20, 3);
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.fillRect(x + 9, y, 2, 22);
      }
    if (kind === "deco") {
      g.fillStyle = "rgba(0,0,0,0.12)";
      for (let x = 30; x < 128; x += 32) g.fillRect(x, 0, 2, 256);
    }
  });
}

/** Box with UVs scaled to world size so window tiles stay the same size */
function worldBox(w: number, h: number, d: number, x: number, y: number, z: number, tileW = 12, tileH = 24) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Faces: px, nx, py, ny, pz, nz — 4 verts each
  for (let f = 0; f < 6; f++) {
    const faceW = f < 2 ? d : w;
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      if (f === 2 || f === 3) uv.setXY(k, 0.01, 0.01);
      else uv.setXY(k, uv.getX(k) * (faceW / tileW), uv.getY(k) * (h / tileH));
    }
  }
  g.translate(x, y, z);
  return g;
}

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

function cylAt(rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 12) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return g;
}

class Batch {
  private geos = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(m: THREE.Material, g: THREE.BufferGeometry) {
    const list = this.geos.get(m) ?? [];
    // mergeGeometries needs matching attributes: strip to position/normal/uv
    const clean = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(clean.attributes))
      if (!["position", "normal", "uv"].includes(k)) clean.deleteAttribute(k);
    list.push(clean);
    this.geos.set(m, list);
  }
  flush(scene: THREE.Object3D, shadows = true) {
    for (const [m, list] of this.geos) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, m);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      scene.add(mesh);
      for (const g of list) g.dispose();
    }
    this.geos.clear();
  }
}

function signTex(lines: string[], bg: string, fg: string, accent?: string, w = 512, h = 256) {
  return tex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    if (accent) {
      g.fillStyle = accent;
      g.fillRect(0, h - 30, w, 30);
      g.fillRect(0, 0, w, 10);
    }
    g.textAlign = "center";
    g.textBaseline = "middle";
    lines.forEach((l, i) => {
      const size = i === 0 ? h * 0.42 : h * 0.16;
      g.font = `900 ${size}px 'Bebas Neue', Impact, sans-serif`;
      g.shadowColor = fg;
      g.shadowBlur = i === 0 ? 18 : 0;
      g.fillStyle = fg;
      g.fillText(l, w / 2, i === 0 ? h * 0.42 : h * 0.72 + (i - 1) * h * 0.16);
    });
  });
}

/* --------------------------------------------------------------- world */

export function buildNycWorld(scene: THREE.Scene, opts: { shadows: boolean; theme?: CityTheme }): CityWorld & { name?: string } {
  const theme = opts.theme ?? CITIES.nyc;
  const colliders: Box2[] = [];
  const circles: { x: number; z: number; r: number }[] = [];
  const lots: (Box2 & { park?: boolean })[] = [];
  const updaters: ((t: number, dt: number, player: THREE.Vector3) => void)[] = [];
  const disposables: { dispose(): void }[] = [];
  const batch = new Batch();

  // Materials
  const M = {
    brick: new THREE.MeshStandardMaterial({ map: facadeTex("brick"), roughness: 0.9 }),
    brick2: new THREE.MeshStandardMaterial({ map: facadeTex("brick2"), roughness: 0.9 }),
    brown: new THREE.MeshStandardMaterial({ map: facadeTex("brown"), roughness: 0.9 }),
    stone: new THREE.MeshStandardMaterial({ map: facadeTex("stone"), roughness: 0.85 }),
    deco: new THREE.MeshStandardMaterial({ map: facadeTex("deco"), roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ map: facadeTex("glass"), roughness: 0.15, metalness: 0.6 }),
    roof: new THREE.MeshStandardMaterial({ color: "#3a3b40", roughness: 0.95 }),
    iron: new THREE.MeshStandardMaterial({ color: "#1b1c20", roughness: 0.6, metalness: 0.6 }),
    wood: new THREE.MeshStandardMaterial({ color: "#6b4e36", roughness: 0.9 }),
    walk: new THREE.MeshStandardMaterial({ color: "#a39f97", roughness: 0.9 }),
    curb: new THREE.MeshStandardMaterial({ color: "#8a8680", roughness: 0.9 }),
    white: new THREE.MeshBasicMaterial({ color: "#e9e6de" }),
    yellow: new THREE.MeshBasicMaterial({ color: "#e8c547" }),
    grass: new THREE.MeshStandardMaterial({ color: "#4f7f3a", roughness: 1 }),
    path: new THREE.MeshStandardMaterial({ color: "#8f8676", roughness: 0.95 }),
    trunk: new THREE.MeshStandardMaterial({ color: "#5a4030", roughness: 0.9 }),
    leaves: new THREE.MeshStandardMaterial({ color: theme.leaves[0], roughness: 0.9, flatShading: true }),
    leaves2: new THREE.MeshStandardMaterial({ color: theme.leaves[1], roughness: 0.9, flatShading: true }),
    green: new THREE.MeshStandardMaterial({ color: "#1f5a3a", roughness: 0.5, metalness: 0.5 }),
    red: new THREE.MeshStandardMaterial({ color: "#b52a1e", roughness: 0.5 }),
    awningA: new THREE.MeshStandardMaterial({ color: "#1e5a3c", roughness: 0.8 }),
    awningB: new THREE.MeshStandardMaterial({ color: "#8a1c24", roughness: 0.8 }),
    awningC: new THREE.MeshStandardMaterial({ color: "#1d2f5a", roughness: 0.8 }),
    shopGlass: new THREE.MeshStandardMaterial({
      color: "#1a2430",
      roughness: 0.1,
      metalness: 0.5,
      emissive: "#ffd7a0",
      emissiveIntensity: 0.15,
    }),
  };
  disposables.push(...Object.values(M));

  /* ----- sky, light, fog */
  scene.fog = new THREE.Fog(theme.fog, theme.rain ? 70 : 120, theme.rain ? 300 : 420);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(theme.sky[0], theme.sky[1]), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], theme.rain ? 1.1 : 0.85));
  const sun = new THREE.DirectionalLight(theme.sun, theme.sunIntensity);
  sun.castShadow = opts.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -55;
  sc.right = sc.top = 55;
  sc.far = 400;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  /* ----- ground: asphalt everywhere, sidewalks raised around lots */
  const asphaltTex = tex(
    256,
    256,
    (g) => {
      g.fillStyle = "#3a3c41";
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 6000; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.06})`;
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
    },
    [120, 120],
  );
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const { avenues, streets, road, walk } = GRID;
  const half = road / 2;

  // Lots between avenues/streets
  for (let i = 0; i < avenues.length - 1; i++) {
    for (let j = 0; j < streets.length - 1; j++) {
      const lot = {
        minX: avenues[i] + half + walk,
        maxX: avenues[i + 1] - half - walk,
        minZ: streets[j] + half + walk,
        maxZ: streets[j + 1] - half - walk,
      };
      const cx = (lot.minX + lot.maxX) / 2;
      const cz = (lot.minZ + lot.maxZ) / 2;
      const inPark = cx > PARK.minX && cx < PARK.maxX && cz > PARK.minZ && cz < PARK.maxZ;
      lots.push({ ...lot, park: inPark });
    }
  }

  // Sidewalk slabs (one per lot, or one for the whole park)
  const sidewalkLoops: Box2[] = [];
  for (const l of lots) {
    if (l.park) continue;
    const w = l.maxX - l.minX + walk * 2;
    const d = l.maxZ - l.minZ + walk * 2;
    batch.add(M.walk, boxAt(w, 0.16, d, (l.minX + l.maxX) / 2, 0.08, (l.minZ + l.maxZ) / 2));
    sidewalkLoops.push({
      minX: l.minX - walk / 2,
      maxX: l.maxX + walk / 2,
      minZ: l.minZ - walk / 2,
      maxZ: l.maxZ + walk / 2,
    });
  }
  batch.add(M.walk, boxAt(PARK.maxX - PARK.minX + walk * 2, 0.16, PARK.maxZ - PARK.minZ + walk * 2, 0, 0.08, 0));
  sidewalkLoops.push({
    minX: PARK.minX - walk / 2,
    maxX: PARK.maxX + walk / 2,
    minZ: PARK.minZ - walk / 2,
    maxZ: PARK.maxZ + walk / 2,
  });

  // Lane markings + crosswalks
  for (const x of avenues) {
    for (let z = -GRID.bound; z < GRID.bound; z += 4) {
      if (streets.some((s) => Math.abs(z - s) < half + 1)) continue;
      if (x === 0 && z > PARK.minZ - walk && z < PARK.maxZ + walk) continue;
      batch.add(M.yellow, boxAt(0.12, 0.02, 2.4, x - 0.12, 0.011, z));
      batch.add(M.yellow, boxAt(0.12, 0.02, 2.4, x + 0.12, 0.011, z));
    }
  }
  for (const z of streets) {
    for (let x = -GRID.bound; x < GRID.bound; x += 4) {
      if (avenues.some((a) => Math.abs(x - a) < half + 1)) continue;
      if (z === 0 && x > PARK.minX - walk && x < PARK.maxX + walk) continue;
      batch.add(M.white, boxAt(2.2, 0.02, 0.14, x, 0.011, z));
    }
  }
  for (const x of avenues)
    for (const z of streets) {
      if (x === 0 && z === 0) continue;
      for (let k = -half + 1; k < half; k += 1.2) {
        batch.add(M.white, boxAt(0.6, 0.02, 2.6, x + k, 0.012, z - half - 1.4));
        batch.add(M.white, boxAt(0.6, 0.02, 2.6, x + k, 0.012, z + half + 1.4));
        batch.add(M.white, boxAt(2.6, 0.02, 0.6, x - half - 1.4, 0.012, z + k));
        batch.add(M.white, boxAt(2.6, 0.02, 0.6, x + half + 1.4, 0.012, z + k));
      }
    }

  /* ----- buildings */
  const special = [PLACES.arena.lot, PLACES.shop.lot, PLACES.crib.lot, PLACES.rec.lot, PLACES.fame.lot];
  const isSpecial = (l: Box2) => special.some((s) => Math.abs(s.minX - l.minX) < 1 && Math.abs(s.minZ - l.minZ) < 1);
  const waterTowers: THREE.BufferGeometry[] = [];

  const walkUp = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    h: number,
    mat: THREE.Material,
    frontZ: number,
    frontSign: number,
    alongX: boolean,
  ) => {
    const w = x1 - x0;
    const d = z1 - z0;
    batch.add(mat, worldBox(w, h, d, (x0 + x1) / 2, h / 2, (z0 + z1) / 2));
    // Cornice
    batch.add(M.roof, boxAt(w + 0.4, 0.5, d + 0.4, (x0 + x1) / 2, h + 0.25, (z0 + z1) / 2));
    // Fire escape on the street face
    if (h > 10 && Math.random() < 0.8) {
      const len = alongX ? w : d;
      const cx = alongX ? (x0 + x1) / 2 : frontZ;
      const cz = alongX ? frontZ : (z0 + z1) / 2;
      const fw = Math.min(5, len * 0.5);
      for (let y = 4; y < h - 2; y += 3.2) {
        const px = alongX ? cx : cx + frontSign * 0.6;
        const pz = alongX ? cz + frontSign * 0.6 : cz;
        batch.add(M.iron, boxAt(alongX ? fw : 1.2, 0.08, alongX ? 1.2 : fw, px, y, pz));
        batch.add(
          M.iron,
          boxAt(
            alongX ? fw : 0.05,
            0.9,
            alongX ? 0.05 : fw,
            alongX ? px : px + frontSign * 0.6,
            y + 0.45,
            alongX ? pz + frontSign * 0.6 : pz,
          ),
        );
        // Diagonal stair
        const st = new THREE.BoxGeometry(alongX ? 3.4 : 0.6, 0.06, alongX ? 0.6 : 3.4);
        if (alongX) st.rotateZ(0.85);
        else st.rotateX(-0.85);
        st.translate(px, y + 1.6, pz);
        batch.add(M.iron, st);
      }
    }
    // Rooftop water tower
    if (h < 40 && Math.random() < 0.55) {
      const tx = rand(x0 + 2, x1 - 2);
      const tz = rand(z0 + 2, z1 - 2);
      waterTowers.push(cylAt(1.4, 1.4, 3, tx, h + 3.2, tz, 12));
      const cone = new THREE.ConeGeometry(1.6, 1.4, 12);
      cone.translate(tx, h + 5.4, tz);
      waterTowers.push(cone);
      for (const [lx, lz] of [
        [-0.9, -0.9],
        [0.9, -0.9],
        [-0.9, 0.9],
        [0.9, 0.9],
      ])
        batch.add(M.iron, boxAt(0.12, 1.8, 0.12, tx + lx, h + 0.9, tz + lz));
    }
  };

  const tower = (x0: number, x1: number, z0: number, z1: number, h: number, mat: THREE.Material) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    batch.add(mat, worldBox(w, h, d, cx, h / 2, cz));
    // Setbacks
    if (h > 50) {
      const h2 = h * rand(0.2, 0.35);
      batch.add(mat, worldBox(w * 0.7, h2, d * 0.7, cx, h + h2 / 2, cz));
      batch.add(M.roof, boxAt(w * 0.72, 0.4, d * 0.72, cx, h + h2 + 0.2, cz));
    }
    batch.add(M.roof, boxAt(w + 0.2, 0.4, d + 0.2, cx, h + 0.2, cz));
  };

  // Storefront ground floors with awnings along the avenue faces
  const storefront = (x: number, z: number, alongX: boolean, sign: number, len: number) => {
    const aw = [M.awningA, M.awningB, M.awningC][Math.floor(Math.random() * 3)];
    const ox = alongX ? 0 : sign * 0.05;
    const oz = alongX ? sign * 0.05 : 0;
    batch.add(M.shopGlass, boxAt(alongX ? len * 0.8 : 0.1, 3, alongX ? 0.1 : len * 0.8, x + ox, 1.7, z + oz));
    const a = new THREE.BoxGeometry(alongX ? len * 0.85 : 1.4, 0.15, alongX ? 1.4 : len * 0.85);
    a.rotateX(alongX ? sign * 0.25 : 0);
    a.rotateZ(alongX ? 0 : -sign * 0.25);
    a.translate(x + (alongX ? 0 : sign * 0.7), 3.5, z + (alongX ? sign * 0.7 : 0));
    batch.add(aw, a);
  };

  for (const l of lots) {
    if (l.park) continue;
    colliders.push({ minX: l.minX, maxX: l.maxX, minZ: l.minZ, maxZ: l.maxZ });
    if (isSpecial(l)) continue;
    const north = (l.minZ + l.maxZ) / 2 < -40;
    const east = (l.minX + l.maxX) / 2 > 60;
    // Split the lot into buildings along x
    let x = l.minX;
    while (x < l.maxX - 1) {
      const bw = Math.min(l.maxX - x, rand(8, 15));
      const x1 = x + bw;
      if (north && Math.random() < 0.6) {
        tower(x, x1, l.minZ, l.maxZ, rand(45, 120), Math.random() < 0.6 ? M.glass : M.deco);
      } else {
        const mat = east && Math.random() < 0.5 ? M.brown : [M.brick, M.brick2, M.stone][Math.floor(Math.random() * 3)];
        const h = east ? rand(12, 18) : rand(14, 34);
        // Front faces both streets (split lot in two halves front/back)
        const mid = (l.minZ + l.maxZ) / 2;
        walkUp(x, x1, l.minZ, mid, h, mat, l.minZ, -1, true);
        walkUp(x, x1, mid, l.maxZ, h * rand(0.8, 1.2), mat, l.maxZ, 1, true);
        storefront((x + x1) / 2, l.minZ - 0.06, true, -1, bw);
        storefront((x + x1) / 2, l.maxZ + 0.06, true, 1, bw);
      }
      x = x1;
    }
  }
  const woodM = M.wood;
  const wt = mergeGeometries(
    waterTowers.map((g) => (g.index ? g.toNonIndexed() : g)),
    false,
  );
  if (wt) {
    const m = new THREE.Mesh(wt, woodM);
    m.castShadow = true;
    scene.add(m);
  }

  /* ----- landmarks */
  // Art-deco spire (Empire-style) in the north-east
  {
    const cx = 90;
    const cz = -100;
    let h = 0;
    const tiers: [number, number][] = [
      [34, 60],
      [26, 40],
      [18, 30],
      [12, 22],
      [7, 14],
    ];
    for (const [w, th] of tiers) {
      batch.add(M.deco, worldBox(w, th, w * 0.62, cx, h + th / 2, cz));
      h += th;
    }
    batch.add(M.iron, cylAt(0.4, 1.2, 30, cx, h + 15, cz, 8));
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 10, 8),
      new THREE.MeshBasicMaterial({ color: "#ff3030" }),
    );
    beacon.position.set(cx, h + 30.5, cz);
    scene.add(beacon);
    updaters.push((t) => (beacon.visible = Math.sin(t * 3) > 0));
  }
  // Meridian Tower (egg-shaped glass) in the north-west
  {
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      prof.push(new THREE.Vector2(16 * Math.sin(Math.PI * (0.12 + u * 0.78)) + 2, u * 130));
    }
    const m = new THREE.Mesh(
      new THREE.LatheGeometry(prof, 40),
      new THREE.MeshPhysicalMaterial({
        color: "#6fb8ff",
        roughness: 0.08,
        metalness: 0.6,
        emissive: "#1d4f8a",
        emissiveIntensity: 0.35,
        clearcoat: 1,
      }),
    );
    m.position.set(-90, 0, -100);
    m.castShadow = true;
    scene.add(m);
    for (let i = 0; i < 7; i++) {
      const y = 14 + i * 16;
      const r = 16 * Math.sin(Math.PI * (0.12 + (y / 130) * 0.78)) + 2.3;
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.35, 8, 48),
        new THREE.MeshBasicMaterial({ color: "#3ad7ff" }),
      );
      band.rotation.x = Math.PI / 2 + 0.2;
      band.position.set(-90, y, -100);
      scene.add(band);
    }
  }
  // Suspension bridge + river to the east
  {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 900),
      new THREE.MeshStandardMaterial({ color: "#3d6a8a", roughness: 0.1, metalness: 0.5 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(215, 0.02, 0);
    scene.add(water);
    const bridgeM = new THREE.MeshStandardMaterial({ color: "#6d6a64", roughness: 0.8 });
    const g: THREE.BufferGeometry[] = [];
    for (const z of [-60, 60]) {
      g.push(boxAt(4, 70, 6, 215, 35, z));
      g.push(boxAt(4, 4, 16, 215, 62, z));
    }
    g.push(boxAt(120, 1.5, 12, 215, 20, 0, Math.PI / 2));
    for (let i = 0; i <= 40; i++) {
      const z = -140 + i * 7;
      const sag = 62 - 42 * (1 - Math.pow(Math.min(Math.abs(z) - 60, 60) / 60, 2) * (Math.abs(z) < 60 ? 0 : 1));
      const y = Math.abs(z) < 60 ? 22 + (40 * (z * z)) / 3600 : Math.max(20, 62 - (Math.abs(z) - 60) * 0.5);
      g.push(boxAt(0.3, Math.max(0.3, y - 20), 0.3, 213, 20 + (y - 20) / 2, z));
      void sag;
    }
    const mm = mergeGeometries(
      g.map((x) => x.toNonIndexed()),
      false,
    );
    if (mm) scene.add(new THREE.Mesh(mm, bridgeM));
  }
  // Distant skyline ring
  {
    const win = windowTexture(0.15);
    const g: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const r = rand(260, 380);
      const h = rand(40, 170);
      const w = rand(14, 30);
      g.push(boxAt(w, h, w, Math.cos(a) * r, h / 2, Math.sin(a) * r));
    }
    const mm = mergeGeometries(
      g.map((x) => x.toNonIndexed()),
      false,
    );
    if (mm)
      scene.add(
        new THREE.Mesh(
          mm,
          new THREE.MeshStandardMaterial({
            color: "#8a97ad",
            roughness: 0.6,
            metalness: 0.3,
            emissiveMap: win,
            emissive: "#ffffff",
            emissiveIntensity: 0.04,
          }),
        ),
      );
  }

  /* ----- park: grass, paths, trees, benches, fence (courts are added by POIs) */
  {
    const w = PARK.maxX - PARK.minX;
    const d = PARK.maxZ - PARK.minZ;
    const grass = new THREE.Mesh(new THREE.BoxGeometry(w, 0.17, d), M.grass);
    grass.position.set(0, 0.085, 0);
    grass.receiveShadow = true;
    scene.add(grass);
    // Paths: cross + ring
    batch.add(M.path, boxAt(6, 0.18, d, 0, 0.09, 0));
    batch.add(M.path, boxAt(w, 0.18, 6, 0, 0.09, 0));
    batch.add(M.path, boxAt(w - 8, 0.18, 4, 0, 0.09, PARK.minZ + 4));
    batch.add(M.path, boxAt(w - 8, 0.18, 4, 0, 0.09, PARK.maxZ - 4));
    // Trees around the edge
    const trunks: THREE.BufferGeometry[] = [];
    const crownsA: THREE.BufferGeometry[] = [];
    const crownsB: THREE.BufferGeometry[] = [];
    const spots: [number, number][] = [];
    for (let x = PARK.minX + 3; x <= PARK.maxX - 3; x += 7) spots.push([x, PARK.minZ + 1.5], [x, PARK.maxZ - 1.5]);
    for (let z = PARK.minZ + 8; z <= PARK.maxZ - 8; z += 7) spots.push([PARK.minX + 1.5, z], [PARK.maxX - 1.5, z]);
    for (const [x, z] of [
      [-8, -8],
      [8, -8],
      [-8, 8],
      [8, 8],
      [-44, 0],
      [44, 0],
    ])
      spots.push([x, z]);
    for (const [x, z] of spots) {
      if (Math.abs(x) < 4 || Math.abs(z) < 4) continue;
      if (theme.palms) {
        const ph = rand(6, 8.5);
        trunks.push(cylAt(0.14, 0.24, ph, x, ph / 2, z, 7));
        for (const c of palmFronds(x, ph, z)) (Math.random() < 0.5 ? crownsA : crownsB).push(c);
      } else {
        trunks.push(cylAt(0.2, 0.3, 3.2, x, 1.8, z, 7));
        const c = new THREE.IcosahedronGeometry(rand(1.8, 2.6), 1);
        c.translate(x, 4.4 + rand(0, 0.8), z);
        (Math.random() < 0.5 ? crownsA : crownsB).push(c);
      }
      circles.push({ x, z, r: 0.4 });
    }
    // Street trees along avenues outside the park
    for (const x of avenues)
      for (let z = -GRID.bound + 6; z < GRID.bound; z += 12) {
        if (streets.some((s) => Math.abs(z - s) < half + 4)) continue;
        for (const sx of [-1, 1]) {
          const tx = x + sx * (half + 1.2);
          if (tx > PARK.minX - walk && tx < PARK.maxX + walk && z > PARK.minZ - walk && z < PARK.maxZ + walk) continue;
          if (Math.random() < 0.65) continue;
          if (theme.palms) {
            const ph = rand(7, 9.5);
            trunks.push(cylAt(0.12, 0.2, ph, tx, ph / 2, z, 6));
            for (const c of palmFronds(tx, ph, z)) (Math.random() < 0.5 ? crownsA : crownsB).push(c);
          } else {
            trunks.push(cylAt(0.15, 0.2, 4.6, tx, 2.4, z, 6));
            const c = new THREE.IcosahedronGeometry(1.5, 1);
            c.translate(tx, 5.6, z);
            (Math.random() < 0.5 ? crownsA : crownsB).push(c);
          }
          circles.push({ x: tx, z, r: 0.3 });
        }
      }
    for (const [list, mat] of [
      [trunks, M.trunk],
      [crownsA, M.leaves],
      [crownsB, M.leaves2],
    ] as const) {
      const mm = mergeGeometries(
        list.map((g) => (g.index ? g.toNonIndexed() : g)),
        false,
      );
      if (mm) {
        const mesh = new THREE.Mesh(mm, mat);
        mesh.castShadow = true;
        scene.add(mesh);
      }
    }
    // Low iron fence with gaps at the path entrances
    for (const [x0, x1, z0, z1] of [
      [PARK.minX, -4, PARK.minZ, PARK.minZ],
      [4, PARK.maxX, PARK.minZ, PARK.minZ],
      [PARK.minX, -4, PARK.maxZ, PARK.maxZ],
      [4, PARK.maxX, PARK.maxZ, PARK.maxZ],
      [PARK.minX, PARK.minX, PARK.minZ, -4],
      [PARK.minX, PARK.minX, 4, PARK.maxZ],
      [PARK.maxX, PARK.maxX, PARK.minZ, -4],
      [PARK.maxX, PARK.maxX, 4, PARK.maxZ],
    ]) {
      const w = Math.max(0.06, x1 - x0);
      const d = Math.max(0.06, z1 - z0);
      // Top + bottom rails and pickets
      batch.add(M.iron, boxAt(w, 0.06, d, (x0 + x1) / 2, 1.15, (z0 + z1) / 2));
      batch.add(M.iron, boxAt(w, 0.06, d, (x0 + x1) / 2, 0.35, (z0 + z1) / 2));
      const len = Math.max(w, d);
      for (let k = 0; k <= len; k += 0.45) {
        const px = w > d ? x0 + k : x0;
        const pz = w > d ? z0 : z0 + k;
        batch.add(M.iron, boxAt(0.04, 1.05, 0.04, px, 0.72, pz));
      }
      colliders.push({
        minX: Math.min(x0, x1) - 0.05,
        maxX: Math.max(x0, x1) + 0.05,
        minZ: Math.min(z0, z1) - 0.05,
        maxZ: Math.max(z0, z1) + 0.05,
      });
    }
    // Benches along the paths
    for (const [x, z, ry] of [
      [-14, 3.8, 0],
      [14, 3.8, 0],
      [-14, -3.8, 0],
      [14, -3.8, 0],
      [3.8, -24, Math.PI / 2],
      [-3.8, 24, Math.PI / 2],
    ] as const) {
      batch.add(M.wood, boxAt(2.4, 0.12, 0.6, x, 0.6, z, ry));
      batch.add(M.wood, boxAt(2.4, 0.6, 0.1, x, 0.95, z + (ry ? 0 : 0.3), ry));
    }
  }

  /* ----- street furniture: lamps, traffic lights, hydrants, subway, carts */
  const lampBulbs: THREE.Vector3[] = [];
  for (const x of avenues)
    for (let z = -GRID.bound + 10; z < GRID.bound; z += 24) {
      if (streets.some((s) => Math.abs(z - s) < half + 3)) continue;
      for (const sx of [-1, 1]) {
        const lx = x + sx * (half + 0.6);
        batch.add(M.iron, cylAt(0.08, 0.12, 6, lx, 3, z, 8));
        batch.add(M.iron, boxAt(1.4, 0.1, 0.1, lx - sx * 0.7, 6, z));
        lampBulbs.push(new THREE.Vector3(lx - sx * 1.3, 5.85, z));
      }
    }
  {
    const bulbs = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.5, 0.15, 0.3),
      new THREE.MeshBasicMaterial({ color: "#fff1d0" }),
      lampBulbs.length,
    );
    lampBulbs.forEach((p, i) => bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    scene.add(bulbs);
  }
  // Traffic lights at intersection corners
  const lightHeads: { g: THREE.Mesh[]; phase: number }[] = [];
  const redM = new THREE.MeshBasicMaterial({ color: "#ff3a2a" });
  const yelM = new THREE.MeshBasicMaterial({ color: "#ffc02a" });
  const grnM = new THREE.MeshBasicMaterial({ color: "#3aff7a" });
  const offM = new THREE.MeshBasicMaterial({ color: "#222" });
  for (const x of avenues)
    for (const z of streets) {
      if (x === 0 && z === 0) continue;
      const px = x + half + 0.8;
      const pz = z + half + 0.8;
      batch.add(M.iron, cylAt(0.1, 0.12, 5.5, px, 2.75, pz, 8));
      batch.add(M.iron, boxAt(0.1, 0.1, 4, px, 5.4, pz - 2));
      batch.add(M.iron, boxAt(0.45, 1.3, 0.4, px, 4.6, pz - 3.8));
      const heads: THREE.Mesh[] = [];
      [redM, yelM, grnM].forEach((_, i) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), offM);
        b.position.set(px, 5.05 - i * 0.4, pz - 3.58);
        scene.add(b);
        heads.push(b);
      });
      lightHeads.push({ g: heads, phase: (x + z) % 2 ? 0 : 6 });
    }
  updaters.push((t) => {
    for (const h of lightHeads) {
      const c = (t + h.phase) % 12;
      const state = c < 5 ? 2 : c < 6 ? 1 : 0;
      h.g[0].material = state === 0 ? redM : offM;
      h.g[1].material = state === 1 ? yelM : offM;
      h.g[2].material = state === 2 ? grnM : offM;
    }
  });
  // Hydrants, trash cans, newspaper boxes along sidewalks
  for (const l of lots) {
    if (l.park) continue;
    const places: [number, number][] = [
      [l.minX + 3, l.minZ - 2.2],
      [l.maxX - 3, l.maxZ + 2.2],
      [l.minX - 2.2, (l.minZ + l.maxZ) / 2],
    ];
    places.forEach(([x, z], i) => {
      if (i === 0) {
        batch.add(M.red, cylAt(0.18, 0.22, 0.7, x, 0.5, z, 8));
        batch.add(M.red, cylAt(0.22, 0.22, 0.1, x, 0.9, z, 8));
      } else if (i === 1) batch.add(M.green, cylAt(0.3, 0.26, 0.9, x, 0.6, z, 10));
      else batch.add(M.awningC, boxAt(0.5, 1, 0.45, x, 0.66, z));
      circles.push({ x, z, r: 0.35 });
    });
  }
  // Subway entrances (green globes, iron rails, stairs going down)
  for (const [x, z, ry] of [
    [8.6, 46.5, 0],
    [-51.4, -46.5, 0],
    [66.5, -86, Math.PI / 2],
    [-66.5, 60, Math.PI / 2],
  ] as const) {
    const g = new THREE.Group();
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1, 4), M.green);
    rail.position.set(-0.9, 0.66, 0);
    const rail2 = rail.clone();
    rail2.position.x = 0.9;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1, 0.08), M.green);
    back.position.set(0, 0.66, -2);
    g.add(rail, rail2, back);
    for (let i = 0; i < 6; i++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.1, 0.6),
        new THREE.MeshStandardMaterial({ color: "#2a2a2e" }),
      );
      step.position.set(0, 0.1 - i * 0.12, 1.6 - i * 0.6);
      g.add(step);
    }
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), M.green);
      post.position.set(sx * 0.9, 1.3, 2);
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 8),
        new THREE.MeshBasicMaterial({ color: "#6cff9a" }),
      );
      globe.position.set(sx * 0.9, 2.5, 2);
      g.add(post, globe);
    }
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.45),
      new THREE.MeshBasicMaterial({
        map: signTex(["SUBWAY"], "#0e0e10", "#ffffff", undefined, 512, 128),
        side: THREE.DoubleSide,
      }),
    );
    sign.position.set(0, 1.4, -2.05);
    g.add(sign);
    g.position.set(x, 0.16, z);
    g.rotation.y = ry;
    scene.add(g);
    circles.push({ x, z, r: 1.4 });
  }
  // Hot dog carts
  for (const [x, z] of [
    [-4, 38],
    [58, -38],
    [-58, 38],
  ]) {
    const cart = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.9, 0.9),
      new THREE.MeshStandardMaterial({ color: "#d9d9dc", metalness: 0.7, roughness: 0.3 }),
    );
    body.position.y = 0.9;
    const umb = new THREE.Mesh(
      new THREE.ConeGeometry(1.3, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: "#e8b820" }),
    );
    umb.position.y = 2.4;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), M.iron);
    pole.position.y = 1.8;
    cart.add(body, umb, pole);
    cart.position.set(x, 0.16, z);
    cart.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    scene.add(cart);
    circles.push({ x, z, r: 1.1 });
  }

  // Steam vents
  const steam: THREE.Mesh[] = [];
  const steamM = new THREE.MeshBasicMaterial({ color: "#f4f4f4", transparent: true, opacity: 0.25, depthWrite: false });
  for (const [x, z] of [
    [-3, -58],
    [-57, -20],
    [57, 62],
    [-30, -83],
  ])
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), steamM);
      puff.position.set(x, i * 0.9, z);
      puff.userData = { x, z, o: i };
      scene.add(puff);
      steam.push(puff);
    }
  updaters.push((t) => {
    for (const s of steam) {
      const k = ((t * 0.6 + s.userData.o / 6) % 1) * 6;
      s.position.set(s.userData.x + Math.sin(t + s.userData.o) * 0.3 * k * 0.3, k, s.userData.z);
      s.scale.setScalar(0.6 + k * 0.35);
    }
    steamM.opacity = 0.22;
  });

  /* ----- Crown Square (Times Square): huge billboards around the intersection */
  const boards: {
    art?: AssetId;
    lines: string[];
    bg: string;
    fg: string;
    x: number;
    y: number;
    z: number;
    ry: number;
    w: number;
    h: number;
  }[] = [
    {
      art: "key-art",
      lines: ["STATIC #00"],
      bg: "#0b1a33",
      fg: "#3ad7ff",
      x: -9.2,
      y: 18,
      z: -89.2,
      ry: Math.PI / 4,
      w: 16,
      h: 9,
    },
    {
      art: "city-aerial",
      lines: ["MERIDIAN"],
      bg: "#1a0f33",
      fg: "#ffc93a",
      x: 9.2,
      y: 22,
      z: -89.2,
      ry: -Math.PI / 4,
      w: 14,
      h: 8,
    },
    {
      lines: ["EBL", "TIP-OFF TONIGHT"],
      bg: "#3b1f7a",
      fg: "#ffffff",
      x: -9.2,
      y: 12,
      z: -70.8,
      ry: (3 * Math.PI) / 4,
      w: 14,
      h: 7,
    },
    {
      art: "architect-portrait",
      lines: ["KANE"],
      bg: "#1a1a1f",
      fg: "#ff3a6e",
      x: 9.2,
      y: 14,
      z: -70.8,
      ry: (-3 * Math.PI) / 4,
      w: 10,
      h: 12,
    },
    { lines: ["CONCRETE CROWN"], bg: "#101014", fg: "#ff8a3a", x: -9.2, y: 30, z: -89.2, ry: Math.PI / 4, w: 18, h: 6 },
    {
      art: "monarch-portrait",
      lines: ["MONARCH"],
      bg: "#0c0c0f",
      fg: "#e2b23a",
      x: 9.2,
      y: 34,
      z: -89.2,
      ry: -Math.PI / 4,
      w: 10,
      h: 12,
    },
    {
      lines: ["HARBOR KICKS", "VOLT 00"],
      bg: "#0e1a06",
      fg: "#d6ff3a",
      x: -9.2,
      y: 24,
      z: -70.8,
      ry: (3 * Math.PI) / 4,
      w: 12,
      h: 6,
    },
    {
      art: "queen-portrait",
      lines: ["QUEEN"],
      bg: "#07261a",
      fg: "#2bd67b",
      x: 9.2,
      y: 26,
      z: -70.8,
      ry: (-3 * Math.PI) / 4,
      w: 8,
      h: 10,
    },
  ];
  const screenLights: THREE.PointLight[] = [];
  for (const b of boards) {
    const mat = new THREE.MeshBasicMaterial({ map: signTex(b.lines, b.bg, b.fg, b.fg), toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), mat);
    m.position.set(b.x, b.y, b.z);
    m.rotation.y = b.ry;
    scene.add(m);
    if (b.art) loadArt(b.art, mat, b.w / b.h);
  }
  for (const [x, z, c] of [
    [0, -86, "#3ad7ff"],
    [0, -74, "#ff3a6e"],
  ] as const) {
    const l = new THREE.PointLight(c, 40, 40, 1.5);
    l.position.set(x, 10, z);
    scene.add(l);
    screenLights.push(l);
  }
  // Red steps (like the TKTS stairs) in the middle of the square
  for (let i = 0; i < 6; i++) batch.add(M.red, boxAt(8, 0.35, 1, 0, 0.18 + i * 0.35, -76 - i * 0.9));
  colliders.push({ minX: -4, maxX: 4, minZ: -82, maxZ: -75.5 });

  /* ----- traffic: cabs and cars on the avenues and streets */
  const cars: { g: THREE.Group; axis: "x" | "z"; lane: number; dir: number; speed: number; pos: number }[] = [];
  const carColors = ["#f2c230", "#f2c230", "#f2c230", "#e8e8ea", "#1b1b1f", "#2a5bd6", "#8a1c24"];
  const makeCar = (color: string) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.8, 4.4),
      new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 }),
    );
    body.position.y = 0.75;
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.7, 2.2),
      new THREE.MeshStandardMaterial({ color: "#1c2a38", metalness: 0.4, roughness: 0.1 }),
    );
    cab.position.set(0, 1.45, -0.2);
    g.add(body, cab);
    if (color === "#f2c230") {
      const light = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.2, 0.25),
        new THREE.MeshBasicMaterial({ color: "#fff4c0" }),
      );
      light.position.set(0, 1.9, -0.2);
      g.add(light);
    }
    for (const [wx, wz] of [
      [0.95, 1.4],
      [-0.95, 1.4],
      [0.95, -1.4],
      [-0.95, -1.4],
    ]) {
      const w = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.25, 12),
        new THREE.MeshStandardMaterial({ color: "#111" }),
      );
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.36, wz);
      g.add(w);
    }
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.15, 0.05),
      new THREE.MeshBasicMaterial({ color: "#fffbe0" }),
    );
    head.position.set(0, 0.8, 2.22);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.15, 0.05),
      new THREE.MeshBasicMaterial({ color: "#ff2a2a" }),
    );
    tail.position.set(0, 0.8, -2.22);
    g.add(head, tail);
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    return g;
  };
  for (let i = 0; i < 26; i++) {
    const onAvenue = i % 2 === 0;
    const dir = Math.random() < 0.5 ? 1 : -1;
    let lane: number;
    if (onAvenue) {
      const a = avenues[Math.floor(Math.random() * avenues.length)];
      if (a === 0) continue; // park interrupts the middle avenue
      lane = a + dir * 2.8;
    } else {
      const s = streets[Math.floor(Math.random() * streets.length)];
      if (s === 0) continue;
      lane = s - dir * 2.8;
    }
    const g = makeCar(carColors[i % carColors.length]);
    scene.add(g);
    cars.push({ g, axis: onAvenue ? "z" : "x", lane, dir, speed: rand(7, 11), pos: rand(-GRID.bound, GRID.bound) });
  }
  updaters.push((t, dt, player) => {
    for (const c of cars) {
      // Slow down for Kairo in the road ahead
      const px = c.axis === "z" ? c.lane : c.pos;
      const pz = c.axis === "z" ? c.pos : c.lane;
      const ahead = c.axis === "z" ? (player.z - pz) * c.dir : (player.x - px) * c.dir;
      const side = c.axis === "z" ? Math.abs(player.x - px) : Math.abs(player.z - pz);
      const blocked = ahead > 0 && ahead < 7 && side < 2;
      // Stop at red lights near intersections (simple: slow when within 8m of a cross line on red)
      const cross = c.axis === "z" ? streets : avenues;
      const nextCross = cross.find(
        (s) => (s - c.pos) * c.dir > GRID.road / 2 && (s - c.pos) * c.dir < GRID.road / 2 + 6,
      );
      const red = nextCross !== undefined && (t + (c.axis === "z" ? 0 : 6)) % 12 >= 5;
      const target = blocked || red ? 0 : c.speed;
      const v = (c.g.userData.v ?? c.speed) as number;
      const nv = v + (target - v) * Math.min(1, dt * 3);
      c.g.userData.v = nv;
      c.pos += c.dir * nv * dt;
      if (c.pos > GRID.bound + 10) c.pos = -GRID.bound - 10;
      if (c.pos < -GRID.bound - 10) c.pos = GRID.bound + 10;
      if (c.axis === "z") {
        c.g.position.set(c.lane, 0, c.pos);
        c.g.rotation.y = c.dir > 0 ? 0 : Math.PI;
      } else {
        c.g.position.set(c.pos, 0, c.lane);
        c.g.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
  });

  batch.flush(scene, true);
  buildLandmark(scene, theme, disposables);
  if (theme.rain) updaters.push(rainUpdater(scene, disposables));

  return {
    name: theme.city === "New York" ? undefined : theme.city,
    colliders,
    circles,
    lots,
    sidewalkLoops,
    sun,
    update(t, dt, player) {
      for (const u of updaters) u(t, dt, player);
      sun.position.set(player.x - 90, 110, player.z - 60);
      sun.target.position.set(player.x, 0, player.z);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Six drooping fronds for a palm tree top */
function palmFronds(x: number, h: number, z: number) {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.ConeGeometry(0.5, 3.4, 4, 1);
    g.scale(1, 1, 0.25);
    g.rotateZ(Math.PI / 2 + 0.45);
    g.translate(1.5, 0, 0);
    g.rotateY((i / 6) * Math.PI * 2 + rand(0, 0.4));
    g.translate(x, h - 0.3, z);
    out.push(g);
  }
  return out;
}

/** A recognizable silhouette beyond the grid, so every city reads as itself */
export function buildLandmark(scene: THREE.Object3D, theme: CityTheme, disposables: { dispose(): void }[]) {
  const mat = (c: string, e = 0) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.3, emissive: c, emissiveIntensity: e });
    disposables.push(m);
    return m;
  };
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  const far = -240;
  switch (theme.landmark) {
    case "needle": {
      const m = mat("#d9dde6");
      add(new THREE.CylinderGeometry(1.2, 3, 150, 12), m, 60, 75, far);
      add(new THREE.CylinderGeometry(20, 9, 8, 24), mat("#c9ced8"), 60, 152, far);
      add(new THREE.CylinderGeometry(1, 1, 30, 8), m, 60, 172, far);
      break;
    }
    case "mountains":
    case "hills": {
      const m = mat(theme.landmark === "hills" ? "#8a7a5a" : theme.rain ? "#5a6a72" : "#b0623a");
      for (let i = 0; i < 9; i++) {
        const h = rand(60, 140);
        const mt = add(new THREE.ConeGeometry(rand(60, 110), h, 7), m, -320 + i * 80, h / 2 - 5, far - rand(0, 60));
        mt.rotation.y = rand(0, Math.PI);
      }
      if (theme.rain) add(new THREE.ConeGeometry(90, 170, 9), mat("#e8eef4"), 140, 80, far - 120); // snowy peak
      break;
    }
    case "strip": {
      const cols = ["#ff3a6e", "#ffd24a", "#3ad7ff", "#b88cff", "#6dff9a"];
      for (let i = 0; i < 10; i++) {
        const h = rand(60, 150);
        add(new THREE.BoxGeometry(rand(14, 26), h, 18), mat(cols[i % cols.length], 0.9), -200 + i * 44, h / 2, far + rand(-20, 20));
      }
      add(new THREE.ConeGeometry(30, 70, 4), mat("#1a1a20", 0.1), 240, 35, far + 30); // glass pyramid
      break;
    }
    case "bridges": {
      const m = mat("#ffb81c", 0.15);
      for (let b = 0; b < 3; b++) {
        const z = far + b * 30;
        add(new THREE.BoxGeometry(260, 3, 10), m, b * 40 - 40, 18, z);
        for (let i = 0; i < 7; i++) {
          const arch = add(new THREE.TorusGeometry(18, 1, 6, 16, Math.PI), m, -150 + i * 40 + b * 40, 18, z);
          void arch;
        }
      }
      break;
    }
    case "harbor": {
      add(new THREE.BoxGeometry(900, 1, 160), mat("#2a7ab0", 0.1), 0, -0.3, far - 40);
      for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(30, 8, 8), mat("#f2f2f4"), -180 + i * 90, 4, far - rand(10, 70));
      break;
    }
    case "spire":
    case "skyline":
    default: {
      const m = mat(theme.accent === "#1f8fff" ? "#b9c4d4" : "#8a96a8", 0.05);
      for (let i = 0; i < 16; i++) {
        const h = rand(90, 210);
        add(new THREE.BoxGeometry(rand(16, 30), h, rand(16, 30)), m, -320 + i * 42, h / 2, far - rand(0, 80));
      }
    }
  }
}

/** Steady rain that follows the player around */
function rainUpdater(scene: THREE.Scene, disposables: { dispose(): void }[]) {
  const N = 2500;
  const pos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const x = rand(-40, 40);
    const y = rand(0, 30);
    const z = rand(-40, 40);
    pos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineBasicMaterial({ color: "#c8d6e6", transparent: true, opacity: 0.45 });
  disposables.push(geo, m);
  const rain = new THREE.LineSegments(geo, m);
  rain.frustumCulled = false;
  scene.add(rain);
  return (_t: number, dt: number, player: THREE.Vector3) => {
    rain.position.set(player.x, 0, player.z);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      let y = p.getY(i * 2) - dt * 22;
      if (y < 0) y += 30;
      p.setY(i * 2, y);
      p.setY(i * 2 + 1, y - 0.7);
    }
    p.needsUpdate = true;
  };
}

/** Swap a billboard to Higgsfield art if the image is reachable (needs CORS for WebGL) */
function loadArt(art: AssetId, mat: THREE.MeshBasicMaterial, panelAspect: number) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const srcs = assetSources(art);
  const tryLoad = (i: number) => {
    if (i >= srcs.length) return;
    loader.load(
      srcs[i],
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        const img = t.image as { width: number; height: number };
        const aspect = img.width / img.height;
        t.repeat.set(aspect > panelAspect ? panelAspect / aspect : 1, aspect > panelAspect ? 1 : aspect / panelAspect);
        t.offset.set((1 - t.repeat.x) / 2, (1 - t.repeat.y) / 2);
        mat.map = t;
        mat.needsUpdate = true;
      },
      undefined,
      () => tryLoad(i + 1),
    );
  };
  tryLoad(0);
}

/** Special-lot buildings (arena, shop, crib, rec center, hall of fame) */
export function buildSpecialLots(scene: THREE.Scene) {
  // EBL Arena: a big round arena filling its lot (MSG style)
  {
    const l = PLACES.arena.lot;
    const cx = (l.minX + l.maxX) / 2;
    const cz = (l.minZ + l.maxZ) / 2;
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 16, 48),
      new THREE.MeshStandardMaterial({ color: "#d9d6e8", roughness: 0.3, metalness: 0.6 }),
    );
    drum.scale.set(20.5, 1, 10.8);
    drum.position.set(cx, 8, cz);
    drum.castShadow = true;
    scene.add(drum);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(1.01, 1.01, 3, 48, 1, true),
      new THREE.MeshBasicMaterial({
        map: signTex(
          ["EBL ARENA  ·  ELITE BASKETBALL LEAGUE  ·  EBL ARENA"],
          "#3b1f7a",
          "#ffffff",
          "#e2b23a",
          2048,
          128,
        ),
        side: THREE.DoubleSide,
      }),
    );
    band.scale.set(20.6, 1, 10.9);
    band.position.set(cx, 12, cz);
    scene.add(band);
    const roof = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: "#e2b23a", metalness: 0.9, roughness: 0.3 }),
    );
    roof.scale.set(20.5, 4, 10.8);
    roof.position.set(cx, 16, cz);
    scene.add(roof);
  }
}

/** Surface height at (x, z): road 0, curbs & park 0.16, pickup courts 0.2 */
export function groundHeight(x: number, z: number) {
  const { avenues, streets, road } = GRID;
  const half = road / 2;
  const onRoad = avenues.some((a) => Math.abs(x - a) < half) || streets.some((s) => Math.abs(z - s) < half);
  const inPark =
    x > PARK.minX - GRID.walk && x < PARK.maxX + GRID.walk && z > PARK.minZ - GRID.walk && z < PARK.maxZ + GRID.walk;
  if (inPark) {
    for (const c of PLACES.courts) if (Math.abs(x - c.x) < 6.5 && Math.abs(z - c.z) < 7) return 0.22;
    return 0.17;
  }
  return onRoad ? 0 : 0.16;
}
