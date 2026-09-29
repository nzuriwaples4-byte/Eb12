import * as THREE from "three";
import { getBaller, type Baller, type Look } from "~/data/characters";
import { assetSources, type AssetId } from "~/data/higgsfield-assets";
import { makeBallMesh } from "./ball-mesh";
import { blobShadow, buildProceduralBody, loadHiggsfieldBody, type Body } from "./body";
import { windowTexture } from "./court";
import { clamp, damp, dampAngle, pick, rand } from "./math";
import { Player } from "./player";
import { createRenderer, environmentFor, fitToParent, skyTexture } from "./stage";

/**
 * Meridian City: the walkable open-world hub. Third-person Kairo, pickup
 * courts with resident ballers, shops, the EBL Arena, pedestrians and a
 * minimap. Points of interest (POIs) are supplied by the route so the city
 * stays data-driven.
 */

export type PoiKind = "court" | "story" | "shop" | "crib" | "arena" | "online" | "roster";

export interface Poi {
  id: string;
  kind: PoiKind;
  /** Big label, e.g. "The Cage Court" */
  label: string;
  /** Prompt verb, e.g. "Challenge Brick" */
  action: string;
  x: number;
  z: number;
  r: number;
  color: string;
}

export interface Resident {
  ballerId: string;
  x: number;
  z: number;
  /** Facing (radians) */
  yaw: number;
}

export interface CityOptions {
  look: Look | null;
  useHiggsfield: boolean;
  shadows: boolean;
  pois: Poi[];
  residents: Resident[];
  spawn?: { x: number; z: number; yaw: number };
}

export interface CityCallbacks {
  prompt(p: Poi | null): void;
  interact(p: Poi): void;
  zone(name: string): void;
}

interface Walker {
  player: Player;
  target: THREE.Vector2;
  speed: number;
  wait: number;
}

interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const PLAZA = 50;

/* ---------------------------------------------------------- textures */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function plazaTexture() {
  return canvasTex(
    256,
    256,
    (g) => {
      g.fillStyle = "#9d978c";
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4000; i++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
      g.strokeStyle = "rgba(70,60,50,0.35)";
      g.lineWidth = 2;
      for (let i = 0; i <= 256; i += 64) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, 256);
        g.moveTo(0, i);
        g.lineTo(256, i);
        g.stroke();
      }
    },
    [50, 50],
  );
}

function facadeTexture(kind: "brick" | "glass" | "concrete") {
  return canvasTex(
    128,
    256,
    (g) => {
      const base = kind === "brick" ? "#8a4a38" : kind === "glass" ? "#3f6f9a" : "#a9a49a";
      g.fillStyle = base;
      g.fillRect(0, 0, 128, 256);
      if (kind === "brick") {
        for (let y = 0; y < 256; y += 6)
          for (let x = (y / 6) % 2 ? 0 : 6; x < 128; x += 12) {
            g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.1})`;
            g.fillRect(x, y, 11, 5);
          }
      }
      for (let y = 10; y < 256; y += 32)
        for (let x = 8; x < 128; x += 30) {
          const lit = Math.random() < 0.25;
          g.fillStyle = kind === "glass" ? (lit ? "#ffe6b0" : "#8fc4ea") : lit ? "#ffd99a" : "#27384c";
          g.fillRect(x, y, kind === "glass" ? 26 : 16, kind === "glass" ? 28 : 20);
          if (kind !== "glass") {
            g.fillStyle = "rgba(255,255,255,0.25)";
            g.fillRect(x, y, 16, 3);
          }
        }
    },
    [1, 1],
  );
}

function signTexture(lines: string[], bg: string, fg: string, accent?: string) {
  return canvasTex(512, 256, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 256);
    if (accent) {
      g.fillStyle = accent;
      g.fillRect(0, 220, 512, 36);
    }
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = fg;
    lines.forEach((l, i) => {
      const size = i === 0 ? 120 : 44;
      g.font = `900 ${size}px 'Bebas Neue', Impact, sans-serif`;
      g.fillText(l, 256, i === 0 ? 100 : 175 + (i - 1) * 46);
    });
  });
}

/* --------------------------------------------------------------- city */

export class City {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 600);
  private sun!: THREE.DirectionalLight;
  private me!: Player;
  private ball = makeBallMesh();
  private walkers: Walker[] = [];
  private residents: Player[] = [];
  private colliders: Box2[] = [];
  private circles: { x: number; z: number; r: number }[] = [];
  private keys = new Set<string>();
  private camYaw = Math.PI;
  private camPitch = 0.32;
  private camDist = 6.5;
  private camPos = new THREE.Vector3();
  private dragging = false;
  private lastX = 0;
  private raf = 0;
  private last = 0;
  private t = 0;
  private disposed = false;
  paused = false;
  private near: Poi | null = null;
  private padPrevA = false;
  private zoneName = "";
  private poiMarkers: THREE.Object3D[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private opts: CityOptions,
    private cb: CityCallbacks,
    private minimap: HTMLCanvasElement | null,
  ) {
    this.renderer = createRenderer(canvas, { shadows: opts.shadows, pixelRatio: 1.5 });
    this.renderer.toneMappingExposure = 0.9;
    this.scene.environment = environmentFor(this.renderer);
    this.scene.environmentIntensity = 0.5;
    this.scene.fog = new THREE.Fog("#f2c9a0", 90, 320);
    this.buildWorld();
    this.buildPois();
    this.spawnPeople();
    void this.spawnMe(opts.look);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: true });
  }

  /* ---------------------------------------------------------- world */

  private buildWorld() {
    const s = this.scene;
    // Golden-hour sky
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(450, 32, 16),
      new THREE.MeshBasicMaterial({ map: skyTexture("#5f95d6", "#ffd2a0"), side: THREE.BackSide, fog: false }),
    );
    s.add(sky);
    s.add(new THREE.HemisphereLight("#cfe2ff", "#6a5040", 0.8));
    this.sun = new THREE.DirectionalLight("#ffd9b0", 3.2);
    this.sun.position.set(-60, 70, -40);
    this.sun.castShadow = this.opts.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.far = 260;
    this.sun.shadow.bias = -0.0005;
    s.add(this.sun, this.sun.target);

    // Ground: asphalt city, plaza tiles in the middle
    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ color: "#3b3d42", roughness: 0.95 }),
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.receiveShadow = true;
    s.add(asphalt);
    const plaza = new THREE.Mesh(
      new THREE.PlaneGeometry(PLAZA * 2, PLAZA * 2),
      new THREE.MeshStandardMaterial({ map: plazaTexture(), roughness: 0.85 }),
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.01;
    plaza.receiveShadow = true;
    s.add(plaza);
    // Road lane markings around the plaza
    const dash = new THREE.MeshBasicMaterial({ color: "#e8d27a" });
    for (let i = -60; i <= 60; i += 6) {
      for (const [x, z, ry] of [
        [i, PLAZA + 7, 0],
        [i, -PLAZA - 7, 0],
        [PLAZA + 7, i, Math.PI / 2],
        [-PLAZA - 7, i, Math.PI / 2],
      ] as const) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.2), dash);
        d.rotation.x = -Math.PI / 2;
        d.rotation.z = ry;
        d.position.set(x, 0.02, z);
        s.add(d);
      }
    }
    // Purple accent strips like a pro-league plaza
    const strip = new THREE.MeshStandardMaterial({ color: "#6a3fc8", roughness: 0.7 });
    for (const [x, z, w, d] of [
      [0, 0, 6, 80],
      [0, 0, 80, 6],
    ] as const) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), strip);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.015, z);
      m.receiveShadow = true;
      s.add(m);
    }

    this.buildSkyline();
    this.buildLandmarks();
    this.buildStreetFurniture();
  }

  private addBox(
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    collide = true,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    if (collide) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  }

  private buildSkyline() {
    const kinds = ["brick", "glass", "concrete"] as const;
    const facades = kinds.map((k) => facadeTexture(k));
    const roofM = new THREE.MeshStandardMaterial({ color: "#2a2c33", roughness: 0.9 });
    const ring: [number, number][] = [];
    // Blocks around the plaza, leaving gaps for landmarks
    for (let i = -80; i <= 80; i += 16) {
      ring.push([i, -PLAZA - 26], [i, PLAZA + 26], [-PLAZA - 26, i], [PLAZA + 26, i]);
    }
    for (const [x, z] of ring) {
      if (Math.abs(x) < 20 && z < 0) continue; // arena + tower
      const k = Math.floor(Math.random() * 3);
      const w = rand(10, 14);
      const d = rand(10, 14);
      const h = k === 1 ? rand(35, 90) : rand(14, 40);
      const tex = facades[k].clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 12)));
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: k === 1 ? 0.2 : 0.8,
        metalness: k === 1 ? 0.5 : 0,
        emissive: k === 1 ? "#ffffff" : "#000000",
        emissiveMap: k === 1 ? tex : null,
        emissiveIntensity: k === 1 ? 0.12 : 0,
      });
      const b = this.addBox(w, h, d, mat, x, h / 2, z);
      b.castShadow = h < 60;
      this.addBox(w * 0.9, 0.6, d * 0.9, roofM, x, h + 0.3, z, false);
    }
    // Far distant skyline
    const win = windowTexture(0.2);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r = rand(150, 230);
      const h = rand(40, 140);
      const w = rand(12, 26);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w),
        new THREE.MeshStandardMaterial({
          color: "#7f8fa8",
          roughness: 0.6,
          metalness: 0.3,
          emissiveMap: win,
          emissive: "#ffffff",
          emissiveIntensity: 0.05,
        }),
      );
      m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      this.scene.add(m);
    }
    // Hills on the horizon
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(120, 24, 12),
      new THREE.MeshStandardMaterial({ color: "#6f8a4c", roughness: 1 }),
    );
    hill.scale.set(1.6, 0.35, 1);
    hill.position.set(260, -10, -120);
    this.scene.add(hill);
  }

  private buildLandmarks() {
    const s = this.scene;
    // Meridian Tower: egg-shaped glass skyscraper with glowing stripes
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      prof.push(new THREE.Vector2(14 * Math.sin(Math.PI * (0.12 + u * 0.78)) + 2, u * 95));
    }
    const towerM = new THREE.MeshPhysicalMaterial({
      color: "#6fb8ff",
      roughness: 0.08,
      metalness: 0.6,
      emissive: "#1d4f8a",
      emissiveIntensity: 0.4,
      clearcoat: 1,
    });
    const tower = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), towerM);
    tower.position.set(-30, 0, -PLAZA - 45);
    tower.castShadow = true;
    s.add(tower);
    for (let i = 0; i < 6; i++) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.35, 8, 48),
        new THREE.MeshStandardMaterial({ color: "#123", emissive: "#3ad7ff", emissiveIntensity: 2 }),
      );
      const y = 12 + i * 13;
      const r = 14 * Math.sin(Math.PI * (0.12 + (y / 95) * 0.78)) + 2.2;
      band.scale.set(r, r, 1);
      band.rotation.x = Math.PI / 2 + 0.25;
      band.position.set(-30, y, -PLAZA - 45);
      s.add(band);
    }
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.5, 20, 8),
      new THREE.MeshStandardMaterial({ color: "#ccc", metalness: 0.9 }),
    );
    antenna.position.set(-30, 105, -PLAZA - 45);
    s.add(antenna);
    this.circles.push({ x: -30, z: -PLAZA - 45, r: 16 });

    // EBL Arena: a big dome north of the plaza
    const arenaM = new THREE.MeshStandardMaterial({ color: "#d9d6e8", roughness: 0.35, metalness: 0.6 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(24, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), arenaM);
    dome.scale.set(1.3, 0.55, 1);
    dome.position.set(18, 10, -PLAZA - 30);
    dome.castShadow = true;
    s.add(dome);
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(31, 31, 10, 48, 1, true),
      new THREE.MeshStandardMaterial({
        color: "#3b1f7a",
        roughness: 0.5,
        emissive: "#6a3fc8",
        emissiveIntensity: 0.25,
      }),
    );
    ring.scale.set(1, 1, 0.78);
    ring.position.set(18, 5, -PLAZA - 30);
    s.add(ring);
    const gold = new THREE.Mesh(
      new THREE.TorusGeometry(31, 0.5, 8, 64),
      new THREE.MeshStandardMaterial({ color: "#e2b23a", metalness: 1, roughness: 0.3 }),
    );
    gold.rotation.x = Math.PI / 2;
    gold.scale.set(1, 0.78, 1);
    gold.position.set(18, 10, -PLAZA - 30);
    s.add(gold);
    this.circles.push({ x: 18, z: -PLAZA - 30, r: 27 });
    this.billboard(
      ["EBL ARENA", "ELITE BASKETBALL LEAGUE"],
      "#3b1f7a",
      "#ffffff",
      18,
      13,
      -PLAZA - 5.5,
      0,
      18,
      "#e2b23a",
    );

    // Crown statue in the plaza center
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3.4, 1.2, 32),
      new THREE.MeshStandardMaterial({ color: "#8f8a80", roughness: 0.7 }),
    );
    base.position.y = 0.6;
    base.castShadow = base.receiveShadow = true;
    s.add(base);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(2.7, 32),
      new THREE.MeshStandardMaterial({ color: "#4fa8d8", roughness: 0.05, metalness: 0.3 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 1.21;
    s.add(water);
    const crownM = new THREE.MeshStandardMaterial({ color: "#e2b23a", metalness: 1, roughness: 0.25 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1, 24, 1, true), crownM);
    band.position.y = 3.2;
    band.castShadow = true;
    s.add(band);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 8), crownM);
      const a = (i / 5) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 1.25, 4.2, Math.sin(a) * 1.25);
      sp.castShadow = true;
      s.add(sp);
    }
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 12), crownM);
    pillar.position.y = 2.2;
    s.add(pillar);
    this.circles.push({ x: 0, z: 0, r: 3.6 });

    // Billboards on buildings around the plaza (Higgsfield art when it loads)
    this.billboard(
      ["STATIC #00", "PORT MERIDIAN'S OWN"],
      "#0b1a33",
      "#3ad7ff",
      PLAZA + 19.5,
      22,
      -8,
      -Math.PI / 2,
      16,
      "#1f8fff",
      "key-art",
    );
    this.billboard(
      ["CONCRETE CROWN", "THE CITY IS YOURS"],
      "#101014",
      "#ffc93a",
      -PLAZA - 19.5,
      20,
      16,
      Math.PI / 2,
      16,
      "#ff8a3a",
      "city-aerial",
    );
    this.billboard(
      ["KANE", "PERFORMANCE"],
      "#1a1a1f",
      "#ff3a6e",
      -8,
      24,
      PLAZA + 19.5,
      Math.PI,
      14,
      "#ff3a6e",
      "architect-portrait",
    );
    this.billboard(
      ["MONARCH", "HEAVY IS THE HEAD"],
      "#0c0c0f",
      "#e2b23a",
      26,
      20,
      PLAZA + 19.5,
      Math.PI,
      12,
      "#e2b23a",
      "monarch-portrait",
    );
  }

  private billboard(
    lines: string[],
    bg: string,
    fg: string,
    x: number,
    y: number,
    z: number,
    ry: number,
    w: number,
    accent?: string,
    art?: AssetId,
  ) {
    const mat = new THREE.MeshBasicMaterial({ map: signTexture(lines, bg, fg, accent), toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.scene.add(m);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, w / 2 + 0.6, 0.3),
      new THREE.MeshStandardMaterial({ color: "#1b1c22", metalness: 0.6 }),
    );
    frame.position.copy(m.position);
    frame.rotation.y = ry;
    frame.translateZ(-0.2);
    this.scene.add(frame);
    if (art) {
      // Swap in the Higgsfield image if it's reachable (needs CORS for WebGL)
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      const srcs = assetSources(art);
      const tryLoad = (i: number) => {
        if (i >= srcs.length || this.disposed) return;
        loader.load(
          srcs[i],
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            const img = tex.image as { width: number; height: number };
            const aspect = img.width / img.height;
            const panelAspect = 2;
            tex.repeat.set(
              aspect > panelAspect ? panelAspect / aspect : 1,
              aspect > panelAspect ? 1 : aspect / panelAspect,
            );
            tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
            mat.map = tex;
            mat.needsUpdate = true;
          },
          undefined,
          () => tryLoad(i + 1),
        );
      };
      tryLoad(0);
    }
    return m;
  }

  private buildStreetFurniture() {
    const s = this.scene;
    const trunk = new THREE.MeshStandardMaterial({ color: "#6a4a32", roughness: 0.9 });
    const leaf = [
      new THREE.MeshStandardMaterial({ color: "#3f7d3a", roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: "#4f9442", roughness: 0.9 }),
    ];
    const treeSpots: [number, number][] = [];
    for (let i = -44; i <= 44; i += 11) treeSpots.push([i, 44], [-44, i], [44, i]);
    for (const [x, z] of treeSpots) {
      if (Math.abs(x) < 8 || Math.abs(z) < 8) continue;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 3, 8), trunk);
      t.position.set(x, 1.5, z);
      t.castShadow = true;
      s.add(t);
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.2, 10), leaf[(x + z) & 1 ? 1 : 0]);
      c.position.set(x, 4.6, z);
      c.castShadow = true;
      s.add(c);
      this.circles.push({ x, z, r: 0.5 });
    }
    // Lamp posts
    const pm = new THREE.MeshStandardMaterial({ color: "#23252c", metalness: 0.7, roughness: 0.4 });
    const bulb = new THREE.MeshStandardMaterial({ color: "#fff", emissive: "#ffe0a0", emissiveIntensity: 2 });
    for (const [x, z] of [
      [-30, -6],
      [30, -6],
      [-30, 6],
      [30, 6],
      [-6, 30],
      [6, 30],
      [-6, -30],
      [6, -30],
    ]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 8), pm);
      p.position.set(x, 2.5, z);
      s.add(p);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), bulb);
      b.position.set(x, 5.1, z);
      s.add(b);
    }
    // Parked cars on the ring road
    const carCols = ["#c23b3b", "#e8e8ea", "#2a5bd6", "#1b1b1f", "#f2c230"];
    for (let i = 0; i < 14; i++) {
      const side = i % 4;
      const u = -40 + ((i * 23) % 80);
      const x = side === 0 ? u : side === 1 ? u : side === 2 ? PLAZA + 4 : -PLAZA - 4;
      const z = side === 0 ? PLAZA + 4 : side === 1 ? -PLAZA - 4 : u;
      const ry = side < 2 ? 0 : Math.PI / 2;
      const car = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 0.9, 1.8),
        new THREE.MeshStandardMaterial({ color: carCols[i % 5], metalness: 0.6, roughness: 0.3 }),
      );
      body.position.y = 0.75;
      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.7, 1.6),
        new THREE.MeshStandardMaterial({ color: "#1c2a38", metalness: 0.4, roughness: 0.1 }),
      );
      cab.position.set(-0.2, 1.5, 0);
      car.add(body, cab);
      for (const [wx, wz] of [
        [1.3, 0.9],
        [-1.3, 0.9],
        [1.3, -0.9],
        [-1.3, -0.9],
      ]) {
        const w = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14),
          new THREE.MeshStandardMaterial({ color: "#111" }),
        );
        w.rotation.x = Math.PI / 2;
        w.position.set(wx, 0.38, wz);
        car.add(w);
      }
      car.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      car.position.set(x, 0, z);
      car.rotation.y = ry;
      s.add(car);
    }
    // Benches
    const benchM = new THREE.MeshStandardMaterial({ color: "#7a5236", roughness: 0.8 });
    for (const [x, z, ry] of [
      [-10, 6, 0],
      [10, 6, 0],
      [-10, -6, 0],
      [10, -6, 0],
    ]) {
      const b = this.addBox(2.4, 0.15, 0.6, benchM, x, 0.5, z, false);
      b.rotation.y = ry;
    }
  }

  /* ----------------------------------------------------------- POIs */

  private buildPois() {
    for (const p of this.opts.pois) {
      if (p.kind === "court") this.buildMiniCourt(p);
      else if (p.kind === "story") this.buildKiosk(p);
      else this.buildStorefront(p);
      // Floating marker ring + beacon
      const g = new THREE.Group();
      const ringM = new THREE.MeshBasicMaterial({
        color: p.color,
        transparent: true,
        opacity: 0.55,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(p.r * 0.35 - 0.12, p.r * 0.35, 40), ringM);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring);
      const beacon = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 0.7, 4),
        new THREE.MeshBasicMaterial({ color: p.color, toneMapped: false }),
      );
      beacon.rotation.x = Math.PI;
      beacon.position.y = 3.4;
      beacon.name = "beacon";
      g.add(beacon);
      g.position.set(p.x, 0, p.z);
      this.scene.add(g);
      this.poiMarkers.push(g);
    }
  }

  private buildMiniCourt(p: Poi) {
    // Half court facing away from the plaza center
    const g = new THREE.Group();
    const W = 13;
    const D = 12;
    const floor = canvasTex(512, 480, (c) => {
      c.fillStyle = "#26314a";
      c.fillRect(0, 0, 512, 480);
      c.fillStyle = p.color;
      c.globalAlpha = 0.85;
      c.fillRect(20, 20, 472, 440);
      c.globalAlpha = 1;
      c.fillStyle = "rgba(0,0,0,0.25)";
      c.fillRect(176, 20, 160, 190);
      c.strokeStyle = "#ffffff";
      c.lineWidth = 6;
      c.strokeRect(20, 20, 472, 440);
      c.strokeRect(176, 20, 160, 190);
      c.beginPath();
      c.arc(256, 70, 230, 0, Math.PI);
      c.stroke();
      c.beginPath();
      c.arc(256, 210, 60, 0, Math.PI * 2);
      c.stroke();
      c.font = "900 44px 'Bebas Neue', Impact, sans-serif";
      c.textAlign = "center";
      c.fillStyle = "rgba(255,255,255,0.8)";
      c.fillText(p.label.toUpperCase(), 256, 420);
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), [
      new THREE.MeshStandardMaterial({ color: "#1b2233" }),
      new THREE.MeshStandardMaterial({ color: "#1b2233" }),
      new THREE.MeshStandardMaterial({ map: floor, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: "#1b2233" }),
      new THREE.MeshStandardMaterial({ color: "#1b2233" }),
      new THREE.MeshStandardMaterial({ color: "#1b2233" }),
    ]);
    slab.position.y = 0.06;
    slab.receiveShadow = true;
    g.add(slab);
    // Hoop at the "top" (−z local)
    const metal = new THREE.MeshStandardMaterial({ color: "#2b3140", metalness: 0.7, roughness: 0.4 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 12), metal);
    pole.position.set(0, 1.8, -D / 2 - 0.4);
    pole.castShadow = true;
    g.add(pole);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.05, 0.05),
      new THREE.MeshStandardMaterial({ color: "#e8eef6", transparent: true, opacity: 0.7 }),
    );
    board.position.set(0, 3.45, -D / 2 + 0.6);
    g.add(board);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.1), metal);
    arm.position.set(0, 3.4, -D / 2 + 0.05);
    g.add(arm);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.015, 8, 24),
      new THREE.MeshStandardMaterial({ color: "#ff5a1f", metalness: 0.6 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 3.05, -D / 2 + 0.98);
    g.add(rim);
    // Fence along the back
    const fenceTex = canvasTex(
      64,
      64,
      (c) => {
        c.strokeStyle = "#aab0b8";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(64, 64);
        c.moveTo(64, 0);
        c.lineTo(0, 64);
        c.stroke();
      },
      [26, 6],
    );
    const fence = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 3),
      new THREE.MeshStandardMaterial({
        map: fenceTex,
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        metalness: 0.6,
      }),
    );
    fence.position.set(0, 1.5, -D / 2 - 0.8);
    g.add(fence);
    // Orient so the hoop points away from the plaza center
    g.position.set(p.x, 0, p.z);
    g.rotation.y = Math.atan2(p.x, p.z) + Math.PI;
    this.scene.add(g);
    // Pole collider
    const pw = new THREE.Vector3(0, 0, -D / 2 - 0.4)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y)
      .add(g.position);
    this.circles.push({ x: pw.x, z: pw.z, r: 0.4 });
  }

  /** Holographic story board on a pillar */
  private buildKiosk(p: Poi) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 2.2, 12),
      new THREE.MeshStandardMaterial({ color: "#2b2f3a", metalness: 0.7 }),
    );
    post.position.y = 1.1;
    g.add(post);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.3),
      new THREE.MeshBasicMaterial({
        map: signTexture(["STORY", p.action.toUpperCase()], "#140f02", p.color, p.color),
        toneMapped: false,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      }),
    );
    screen.position.y = 2.7;
    g.add(screen);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = Math.atan2(-p.x, -p.z) + Math.PI;
    this.scene.add(g);
    this.circles.push({ x: p.x, z: p.z, r: 0.35 });
  }

  private buildStorefront(p: Poi) {
    // A building face with a glowing sign, set back behind the POI
    const dir = new THREE.Vector2(p.x, p.z).normalize();
    const back = 5.5;
    const bx = p.x + dir.x * back;
    const bz = p.z + dir.y * back;
    const ry = Math.atan2(-dir.x, -dir.y);
    const color = p.color;
    const g = new THREE.Group();
    const w = p.kind === "arena" ? 0 : 12;
    if (w) {
      const tex = facadeTexture(p.kind === "shop" ? "concrete" : "brick");
      tex.repeat.set(2, 1);
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(w, 9, 6),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
      );
      wall.position.y = 4.5;
      wall.castShadow = wall.receiveShadow = true;
      g.add(wall);
      // Door
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 3.2),
        new THREE.MeshStandardMaterial({ color: "#10141c", emissive: color, emissiveIntensity: 0.35 }),
      );
      door.position.set(0, 1.6, 3.01);
      g.add(door);
      // Awning
      const awn = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.8, 0.2, 1.6),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
      );
      awn.position.set(0, 3.8, 3.7);
      awn.castShadow = true;
      g.add(awn);
    }
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({
        map: signTexture([p.label.toUpperCase()], "#0b0d12", color, color),
        toneMapped: false,
      }),
    );
    sign.position.set(0, w ? 6.2 : 4.5, w ? 3.02 : 0);
    g.add(sign);
    // Shop window displays: shoes on pedestals
    if (p.kind === "shop") {
      const cols = ["#d6ff3a", "#ff4fd8", "#e2b23a", "#f4f7fb", "#b3122a"];
      cols.forEach((c, i) => {
        const shoe = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.25, 0.9),
          new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }),
        );
        shoe.position.set(-4 + i * 2, 1.2 + Math.sin(i) * 0.05, 3.3);
        shoe.rotation.y = 0.6;
        g.add(shoe);
        const ped = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.4, 1, 16),
          new THREE.MeshStandardMaterial({ color: "#f2f2f2" }),
        );
        ped.position.set(-4 + i * 2, 0.5, 3.3);
        g.add(ped);
      });
    }
    g.position.set(bx, 0, bz);
    g.rotation.y = ry;
    this.scene.add(g);
    if (w) {
      // Collider (approximate: axis aligned around the building)
      const hw = (Math.abs(Math.cos(ry)) * w) / 2 + Math.abs(Math.sin(ry)) * 3;
      const hd = (Math.abs(Math.sin(ry)) * w) / 2 + Math.abs(Math.cos(ry)) * 3;
      this.colliders.push({ minX: bx - hw, maxX: bx + hw, minZ: bz - hd, maxZ: bz + hd });
    }
  }

  /* --------------------------------------------------------- people */

  private npcBaller(i: number): Baller {
    const skins = ["#6b4430", "#a86f4c", "#e2b894", "#4a2d20", "#c68c63", "#8f5d3e", "#f0cfb0"];
    const shirts = ["#e84a5f", "#2a9df4", "#f6c343", "#ffffff", "#1b1b22", "#3ddc97", "#9b5de5", "#ff8c42", "#8d99ae"];
    const hairs = ["fade", "twists", "cap", "shaved", "afro-puff", "braids", "silver-part"] as const;
    const base = getBaller("deuce");
    const jersey = pick(shirts);
    const look: Look = {
      ...base.look,
      skin: skins[i % skins.length],
      hair: pick(hairs),
      hairColor: pick(["#140f0c", "#3a2a1c", "#1a1410", "#d9dde6"]),
      jersey,
      jerseyTrim: pick(shirts),
      number: String(Math.floor(rand(0, 99))),
      shorts: pick(["#1b1b22", "#2b3a55", "#e8e8ea", "#5a3a2a"]),
      shortsStripe: jersey,
      shoes: pick(["#f5f5f5", "#111", "#c23b3b", "#2a5bd6"]),
      soles: pick(["#ffffff", "#e2b23a", "#d6ff3a"]),
      chain: Math.random() < 0.2,
      earrings: Math.random() < 0.2,
      beard: Math.random() < 0.2 ? "#1a1410" : undefined,
      headband: undefined,
      sleeveLeft: undefined,
      kneeBraceRight: undefined,
      mask: undefined,
      build: rand(0.85, 1.2),
    };
    return { ...base, id: `npc-${i}`, height: rand(1.65, 1.98), look };
  }

  private spawnPeople() {
    const N = 10;
    for (let i = 0; i < N; i++) {
      const b = this.npcBaller(i);
      const body = buildProceduralBody(b);
      body.root.traverse((o) => ((o as THREE.Mesh).castShadow = false));
      this.scene.add(body.root);
      const p = new Player(1, b, body);
      p.pos.set(rand(-40, 40), 0, rand(-40, 40));
      this.walkers.push({
        player: p,
        target: new THREE.Vector2(rand(-42, 42), rand(-42, 42)),
        speed: rand(1.1, 1.7),
        wait: 0,
      });
    }
    for (const r of this.opts.residents) {
      const b = getBaller(r.ballerId);
      const body = buildProceduralBody(b);
      this.scene.add(body.root);
      const p = new Player(1, b, body);
      p.pos.set(r.x, 0, r.z);
      p.yaw = r.yaw;
      p.hasBall = true;
      const ball = makeBallMesh();
      ball.name = "resident-ball";
      this.scene.add(ball);
      (p as Player & { ballMesh?: THREE.Mesh }).ballMesh = ball;
      this.residents.push(p);
    }
  }

  private async spawnMe(look: Look | null) {
    const base = getBaller("kairo");
    const baller = look ? { ...base, look } : base;
    let body: Body | null = null;
    if (!look && this.opts.useHiggsfield && base.model) {
      body = await Promise.race([
        loadHiggsfieldBody(base, assetSources(base.model)),
        new Promise<null>((r) => setTimeout(() => r(null), 10000)),
      ]);
    }
    if (this.disposed) return;
    body ??= buildProceduralBody(baller);
    const prev = this.me;
    if (prev) {
      this.scene.remove(prev.body.root);
      prev.body.dispose();
    }
    this.scene.add(body.root);
    this.me = new Player(0, baller, body);
    this.me.hasBall = true;
    const sp = this.opts.spawn ?? { x: 0, z: 24, yaw: Math.PI };
    if (prev) {
      this.me.pos.copy(prev.pos);
      this.me.yaw = prev.yaw;
    } else {
      this.me.pos.set(sp.x, 0, sp.z);
      this.me.yaw = sp.yaw;
      this.camYaw = sp.yaw + Math.PI;
    }
    if (!this.ball.parent) this.scene.add(this.ball);
    if (!this.raf) {
      this.last = performance.now();
      this.loop();
    }
  }

  /** Re-dress Kairo after buying/equipping gear */
  setLook(look: Look | null) {
    void this.spawnMe(look);
  }

  get position() {
    return this.me?.pos;
  }

  /* ---------------------------------------------------------- input */

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.paused) return;
    this.keys.add(e.code);
    if ((e.code === "KeyE" || e.code === "Enter" || e.code === "KeyJ") && this.near) this.cb.interact(this.near);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.lastX = e.clientX;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.camYaw -= (e.clientX - this.lastX) * 0.006;
    this.lastX = e.clientX;
  };
  private onPointerUp = () => (this.dragging = false);
  private onWheel = (e: WheelEvent) => {
    this.camDist = clamp(this.camDist + e.deltaY * 0.005, 3.5, 12);
  };

  /* ----------------------------------------------------------- loop */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    fitToParent(this.renderer, this.camera);
    if (!this.paused) this.step(dt);
    this.renderer.render(this.scene, this.camera);
  };

  step(dt: number) {
    if (!this.me) return;
    this.t += dt;
    const k = this.keys;
    let mx = 0;
    let mz = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) mz -= 1;
    if (k.has("KeyS") || k.has("ArrowDown")) mz += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) mx -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) mx += 1;
    if (k.has("KeyQ")) this.camYaw += dt * 2;
    if (k.has("KeyR")) this.camYaw -= dt * 2;
    let sprint = k.has("ShiftLeft") || k.has("ShiftRight");
    const pad = navigator.getGamepads?.().find(Boolean);
    if (pad) {
      if (Math.hypot(pad.axes[0], pad.axes[1]) > 0.2) {
        mx = pad.axes[0];
        mz = pad.axes[1];
      }
      if (Math.abs(pad.axes[2] ?? 0) > 0.2) this.camYaw -= (pad.axes[2] ?? 0) * dt * 2.5;
      sprint ||= !!pad.buttons[7]?.pressed || !!pad.buttons[10]?.pressed;
      const a = !!pad.buttons[0]?.pressed;
      if (a && !this.padPrevA && this.near) this.cb.interact(this.near);
      this.padPrevA = a;
    }
    // Camera-relative movement (camera looks along -forward)
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const fwdX = -Math.sin(this.camYaw);
    const fwdZ = -Math.cos(this.camYaw);
    const rightX = -fwdZ;
    const rightZ = fwdX;
    const speed = sprint ? 6.2 : 3.4;
    const vx = (rightX * mx - fwdX * mz) * speed;
    const vz = (rightZ * mx - fwdZ * mz) * speed;
    const me = this.me;
    me.approach(vx, vz, dt, 10);
    me.pos.x += me.vel.x * dt;
    me.pos.z += me.vel.z * dt;
    this.collide(me.pos);
    if (Math.hypot(me.vel.x, me.vel.z) > 0.3) me.yaw = dampAngle(me.yaw, Math.atan2(me.vel.x, me.vel.z), 10, dt);
    me.animate(dt, this.t, false);
    me.ballWorld(this.ball.position);

    // Pedestrians
    for (const w of this.walkers) {
      const p = w.player;
      if (w.wait > 0) {
        w.wait -= dt;
        p.approach(0, 0, dt, 6);
      } else {
        const dx = w.target.x - p.pos.x;
        const dz = w.target.y - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8) {
          w.target.set(rand(-42, 42), rand(-42, 42));
          w.wait = rand(0, 3);
        } else p.approach((dx / d) * w.speed, (dz / d) * w.speed, dt, 5);
      }
      p.pos.x += p.vel.x * dt;
      p.pos.z += p.vel.z * dt;
      this.collide(p.pos);
      if (Math.hypot(p.vel.x, p.vel.z) > 0.2) p.yaw = dampAngle(p.yaw, Math.atan2(p.vel.x, p.vel.z), 6, dt);
      p.animate(dt, this.t, false);
    }
    // Residents idle-dribble and turn to face Kairo when he walks up
    for (const r of this.residents) {
      const d = Math.hypot(r.pos.x - me.pos.x, r.pos.z - me.pos.z);
      if (d < 7) r.faceTowards(me.pos.x, me.pos.z, dt, 4);
      r.animate(dt, this.t, false);
      const bm = (r as Player & { ballMesh?: THREE.Mesh }).ballMesh;
      if (bm) r.ballWorld(bm.position);
    }

    // POI proximity
    let best: Poi | null = null;
    let bestD = Infinity;
    for (const p of this.opts.pois) {
      const d = Math.hypot(p.x - me.pos.x, p.z - me.pos.z);
      if (d < p.r && d < bestD) {
        best = p;
        bestD = d;
      }
    }
    if (best !== this.near) {
      this.near = best;
      this.cb.prompt(best);
    }
    const zone = best ? best.label : Math.hypot(me.pos.x, me.pos.z) < 8 ? "Crown Plaza" : "Meridian City";
    if (zone !== this.zoneName) {
      this.zoneName = zone;
      this.cb.zone(zone);
    }
    this.poiMarkers.forEach((m, i) => {
      const b = m.getObjectByName("beacon");
      if (b) {
        b.position.y = 3.4 + Math.sin(this.t * 2 + i) * 0.25;
        b.rotation.y += dt * 1.5;
      }
    });

    // Sun shadow follows the player
    this.sun.position.set(me.pos.x - 60, 70, me.pos.z - 40);
    this.sun.target.position.set(me.pos.x, 0, me.pos.z);

    // Camera: orbit behind Kairo
    const cx = me.pos.x + Math.sin(this.camYaw) * this.camDist * Math.cos(this.camPitch);
    const cz = me.pos.z + Math.cos(this.camYaw) * this.camDist * Math.cos(this.camPitch);
    const cy = 1.4 + this.camDist * Math.sin(this.camPitch) + 0.6;
    this.camPos.set(
      damp(this.camPos.x || cx, cx, 8, dt),
      damp(this.camPos.y || cy, cy, 8, dt),
      damp(this.camPos.z || cz, cz, 8, dt),
    );
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(me.pos.x, 1.5, me.pos.z);

    this.drawMinimap();
  }

  private collide(p: THREE.Vector3) {
    const R = 0.4;
    p.x = clamp(p.x, -PLAZA + 1, PLAZA - 1);
    p.z = clamp(p.z, -PLAZA + 1, PLAZA - 1);
    for (const b of this.colliders) {
      if (p.x > b.minX - R && p.x < b.maxX + R && p.z > b.minZ - R && p.z < b.maxZ + R) {
        const dl = p.x - (b.minX - R);
        const dr = b.maxX + R - p.x;
        const dn = p.z - (b.minZ - R);
        const df = b.maxZ + R - p.z;
        const m = Math.min(dl, dr, dn, df);
        if (m === dl) p.x = b.minX - R;
        else if (m === dr) p.x = b.maxX + R;
        else if (m === dn) p.z = b.minZ - R;
        else p.z = b.maxZ + R;
      }
    }
    for (const c of this.circles) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < c.r + R && d > 1e-4) {
        p.x = c.x + (dx / d) * (c.r + R);
        p.z = c.z + (dz / d) * (c.r + R);
      }
    }
  }

  private drawMinimap() {
    const c = this.minimap;
    if (!c || !this.me) return;
    const g = c.getContext("2d")!;
    const S = c.width;
    const scale = S / (PLAZA * 2 + 20);
    const mx = (x: number) => S / 2 + x * scale;
    const mz = (z: number) => S / 2 + z * scale;
    g.clearRect(0, 0, S, S);
    g.fillStyle = "rgba(10,12,18,0.8)";
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "rgba(185,180,171,0.35)";
    g.fillRect(mx(-PLAZA), mz(-PLAZA), PLAZA * 2 * scale, PLAZA * 2 * scale);
    g.fillStyle = "rgba(106,63,200,0.5)";
    g.fillRect(mx(-3), mz(-40), 6 * scale, 80 * scale);
    g.fillRect(mx(-40), mz(-3), 80 * scale, 6 * scale);
    for (const b of this.colliders) {
      g.fillStyle = "rgba(60,64,78,0.9)";
      g.fillRect(mx(b.minX), mz(b.minZ), (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    for (const p of this.opts.pois) {
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(mx(p.x), mz(p.z), 5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "rgba(255,255,255,0.5)";
    for (const w of this.walkers) g.fillRect(mx(w.player.pos.x) - 1, mz(w.player.pos.z) - 1, 2, 2);
    // Player arrow
    const me = this.me;
    g.translate(mx(me.pos.x), mz(me.pos.z));
    g.rotate(-me.yaw + Math.PI);
    g.fillStyle = "#3ad7ff";
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 5);
    g.lineTo(-5, 5);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    g.stroke();
  }

  /** Teleport (e.g. fast travel from the map) */
  warp(x: number, z: number) {
    if (!this.me) return;
    this.me.pos.set(x, 0, z);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.me?.body.dispose();
    for (const w of this.walkers) w.player.body.dispose();
    for (const r of this.residents) r.body.dispose();
    this.renderer.dispose();
  }
}

export { blobShadow };
