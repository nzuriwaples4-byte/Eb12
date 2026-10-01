import * as THREE from "three";
import { getBaller, type Baller, type Look } from "~/data/characters";
import { assetSources, type AssetId } from "~/data/higgsfield-assets";
import { makeBallMesh } from "./ball-mesh";
import { blobShadow, buildProceduralBody, loadHiggsfieldBody, type Body } from "./body";
import { buildCampusWorld } from "./campus-world";
import { buildNycWorld, buildSpecialLots, groundHeight, GRID, PARK, PLACES, type CityWorld } from "./city-world";
import { clamp, damp, dampAngle, pick, rand } from "./math";
import { Player } from "./player";
import { createRenderer, environmentFor, fitToParent, skyTexture } from "./stage";

/**
 * New York City: the walkable open-world hub. Third-person Kairo, pickup
 * courts with resident ballers, shops, the EBL Arena, pedestrians and a
 * minimap. Points of interest (POIs) are supplied by the route so the city
 * stays data-driven.
 */

export type PoiKind = "court" | "story" | "shop" | "crib" | "arena" | "online" | "roster" | "door";

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
  /** Stands and talks instead of dribbling */
  noBall?: boolean;
}

export interface CityOptions {
  look: Look | null;
  useHiggsfield: boolean;
  shadows: boolean;
  pois: Poi[];
  residents: Resident[];
  spawn?: { x: number; z: number; yaw: number };
  /** Which map to build: New York (default) or the Peachtree Heights campus */
  world?: "nyc" | "campus";
  /** Home-city look (your EBL team's city) */
  theme?: import("~/data/cities").CityTheme;
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
  loop: Box2;
  corner: number;
}

type Box2 = import("./city-world").Box2;

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
      let size = i === 0 ? 120 : 44;
      g.font = `900 ${size}px 'Bebas Neue', Impact, sans-serif`;
      // Shrink long names so they never run off the sign
      const w = g.measureText(l).width;
      if (w > 480) {
        size = Math.floor((size * 480) / w);
        g.font = `900 ${size}px 'Bebas Neue', Impact, sans-serif`;
      }
      g.fillText(l, 256, i === 0 ? 100 : 175 + (i - 1) * 46);
    });
  });
}

/* --------------------------------------------------------------- city */

export class City {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 600);
  private world!: CityWorld &
    Partial<{ ground(x: number, z: number): number; bound: number; greens: Box2[]; name: string }>;
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
    this.world =
      opts.world === "campus"
        ? buildCampusWorld(this.scene, { shadows: opts.shadows })
        : buildNycWorld(this.scene, { shadows: opts.shadows, theme: opts.theme });
    this.colliders = this.world.colliders;
    this.circles = this.world.circles;
    if (opts.world !== "campus") buildSpecialLots(this.scene);
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

  /* ----------------------------------------------------------- POIs */

  private buildPois() {
    for (const p of this.opts.pois) {
      if (p.kind === "court") this.buildMiniCourt(p);
      else if (p.kind === "story") this.buildKiosk(p);
      else if (p.kind !== "door") this.buildStorefront(p);
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
    slab.position.y = 0.16;
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
    g.rotation.y = p.x > 0 ? -Math.PI / 2 : Math.PI / 2;
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
    const place = {
      shop: PLACES.shop,
      crib: PLACES.crib,
      online: PLACES.rec,
      roster: PLACES.fame,
      arena: PLACES.arena,
    }[p.kind as "shop" | "crib" | "online" | "roster" | "arena"];
    if (!place) return;
    const l = place.lot;
    const cx = (l.minX + l.maxX) / 2;
    const cz = (l.minZ + l.maxZ) / 2;
    const w = l.maxX - l.minX;
    const d = l.maxZ - l.minZ;
    // Front face is the lot edge closest to the POI
    const frontZ = Math.abs(p.z - l.minZ) < Math.abs(p.z - l.maxZ) ? l.minZ : l.maxZ;
    const out = frontZ === l.minZ ? -1 : 1;
    if (p.kind !== "arena") {
      // The VYRO flagship is black glass; everything else is masonry
      const kind = p.kind === "shop" ? "glass" : p.kind === "roster" ? "concrete" : "brick";
      const h = p.kind === "crib" ? 16 : p.kind === "roster" ? 14 : 12;
      const tex = facadeTexture(kind);
      tex.repeat.set(Math.round(w / 12), Math.max(1, Math.round(h / 24)));
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial(
          p.kind === "shop"
            ? { map: tex, color: "#3a2f55", roughness: 0.15, metalness: 0.7 }
            : { map: tex, roughness: 0.85 },
        ),
      );
      body.position.set(cx, h / 2, cz);
      body.castShadow = body.receiveShadow = true;
      this.scene.add(body);
      const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6),
        new THREE.MeshStandardMaterial({ color: "#2e2f35" }),
      );
      cornice.position.set(cx, h + 0.3, cz);
      this.scene.add(cornice);
    }
    const g = new THREE.Group();
    g.position.set(p.x, 0, frontZ);
    g.rotation.y = out < 0 ? Math.PI : 0;
    // Sign, door, awning, lights
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.4),
      new THREE.MeshBasicMaterial({
        map:
          p.kind === "shop"
            ? signTexture(["VYRO", "ATHLETICS  ·  BUILT FOR MORE"], "#07050c", "#e9e2ff", "#8b5cf6")
            : signTexture([p.label.toUpperCase()], "#0b0d12", p.color, p.color),
        toneMapped: false,
      }),
    );
    sign.position.set(0, p.kind === "arena" ? 7 : 6.4, p.kind === "arena" ? 0.3 : 0.05);
    g.add(sign);
    if (p.kind !== "arena") {
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 3.4),
        new THREE.MeshStandardMaterial({ color: "#10141c", emissive: p.color, emissiveIntensity: 0.4 }),
      );
      door.position.set(0, 1.85, 0.04);
      g.add(door);
      const awn = new THREE.Mesh(
        new THREE.BoxGeometry(9, 0.2, 2),
        new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.6 }),
      );
      awn.position.set(0, 4, 1);
      awn.rotation.x = 0.2;
      awn.castShadow = true;
      g.add(awn);
    }
    if (p.kind === "crib") {
      // Brownstone stoop
      for (let i = 0; i < 5; i++) {
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(3, 0.2, 0.5),
          new THREE.MeshStandardMaterial({ color: "#6a4a3a" }),
        );
        step.position.set(0, 0.1 + i * 0.2, 2.6 - i * 0.5);
        g.add(step);
      }
    }
    if (p.kind === "shop") {
      // Waples colorways in the window
      const cols = ["#2f6bff", "#8b5cf6", "#e2b23a", "#f2f3f7", "#c21d2a", "#7c3aed"];
      cols.forEach((c, i) => {
        const shoe = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.25, 0.9),
          new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }),
        );
        shoe.position.set(-4.5 + i * 1.8 + (i > 2 ? 0.9 : 0) - (i < 3 ? 0.9 : 0), 1.3, 0.5);
        shoe.rotation.y = 0.6;
        g.add(shoe);
        const ped = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 1.1, 16),
          new THREE.MeshStandardMaterial({ color: "#14101f", emissive: "#6d28d9", emissiveIntensity: 0.6 }),
        );
        ped.position.set(shoe.position.x, 0.55, 0.5);
        g.add(ped);
      });
    }
    if (p.kind === "roster") {
      for (const sx of [-3.5, -1.5, 1.5, 3.5]) {
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.4, 5, 16),
          new THREE.MeshStandardMaterial({ color: "#e8e2d4" }),
        );
        col.position.set(sx, 2.5, 0.7);
        col.castShadow = true;
        g.add(col);
      }
    }
    this.scene.add(g);
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

  /** Sidewalk loops around the park and nearby blocks */
  private nearLoops() {
    return this.world.sidewalkLoops.filter(
      (l) => Math.abs((l.minX + l.maxX) / 2) < 100 && Math.abs((l.minZ + l.maxZ) / 2) < 100,
    );
  }

  private spawnPeople() {
    const N = 18;
    for (let i = 0; i < N; i++) {
      const b = this.npcBaller(i);
      const body = buildProceduralBody(b);
      body.root.traverse((o) => ((o as THREE.Mesh).castShadow = false));
      this.scene.add(body.root);
      const p = new Player(1, b, body);
      const loops = this.nearLoops();
      const loop = loops[i % loops.length];
      p.pos.set(loop.minX, 0, rand(loop.minZ, loop.maxZ));
      this.walkers.push({
        player: p,
        target: new THREE.Vector2(loop.minX, loop.minZ),
        speed: rand(1.1, 1.7),
        wait: 0,
        loop,
        corner: 0,
      });
    }
    for (const r of this.opts.residents) {
      const b = getBaller(r.ballerId);
      const body = buildProceduralBody(b);
      this.scene.add(body.root);
      const p = new Player(1, b, body);
      p.pos.set(r.x, 0, r.z);
      p.yaw = r.yaw;
      if (!r.noBall) {
        p.hasBall = true;
        const ball = makeBallMesh();
        ball.name = "resident-ball";
        this.scene.add(ball);
        (p as Player & { ballMesh?: THREE.Mesh }).ballMesh = ball;
      }
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
    const sp = this.opts.spawn ?? { x: PLACES.spawn.x, z: PLACES.spawn.z, yaw: Math.PI };
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
    me.groundY = damp(me.groundY, this.ground(me.pos.x, me.pos.z), 20, dt);
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
          // Walk the block: next corner of the sidewalk loop
          w.corner = (w.corner + 1) % 4;
          const L = w.loop;
          const corners = [
            [L.minX, L.minZ],
            [L.maxX, L.minZ],
            [L.maxX, L.maxZ],
            [L.minX, L.maxZ],
          ];
          w.target.set(corners[w.corner][0], corners[w.corner][1]);
          w.wait = Math.random() < 0.2 ? rand(0.5, 2) : 0;
        } else p.approach((dx / d) * w.speed, (dz / d) * w.speed, dt, 5);
      }
      p.pos.x += p.vel.x * dt;
      p.pos.z += p.vel.z * dt;
      if (Math.hypot(p.vel.x, p.vel.z) > 0.2) p.yaw = dampAngle(p.yaw, Math.atan2(p.vel.x, p.vel.z), 6, dt);
      p.groundY = this.ground(p.pos.x, p.pos.z);
      p.animate(dt, this.t, false);
    }
    // Residents idle-dribble and turn to face Kairo when he walks up
    for (const r of this.residents) {
      const d = Math.hypot(r.pos.x - me.pos.x, r.pos.z - me.pos.z);
      if (d < 7) r.faceTowards(me.pos.x, me.pos.z, dt, 4);
      r.groundY = this.ground(r.pos.x, r.pos.z);
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
    const zone = best
      ? best.label
      : this.world.name
        ? this.world.name
        : Math.hypot(me.pos.x, me.pos.z) < 8
          ? "Crown Plaza"
          : "New York City";
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

    this.world.update(this.t, dt, me.pos);

    // Camera: orbit behind Kairo
    const cx = me.pos.x + Math.sin(this.camYaw) * this.camDist * Math.cos(this.camPitch);
    const cz = me.pos.z + Math.cos(this.camYaw) * this.camDist * Math.cos(this.camPitch);
    const cy = 1.4 + this.camDist * Math.sin(this.camPitch) + 0.6;
    this.camPos.set(
      damp(this.camPos.x || cx, cx, 8, dt),
      damp(this.camPos.y || cy, cy, 8, dt),
      damp(this.camPos.z || cz, cz, 8, dt),
    );
    // Keep the camera out of buildings: pull it in along the view ray
    const head = new THREE.Vector3(me.pos.x, 1.6, me.pos.z);
    const dir = this.camPos.clone().sub(head);
    const full = dir.length();
    dir.normalize();
    let dist = full;
    for (let s2 = 0.5; s2 < full; s2 += 0.25) {
      const px = head.x + dir.x * s2;
      const pz = head.z + dir.z * s2;
      const py = head.y + dir.y * s2;
      if (
        py < 30 &&
        this.colliders.some((b) => px > b.minX && px < b.maxX && pz > b.minZ && pz < b.maxZ && b.maxX - b.minX > 1)
      ) {
        dist = Math.max(1.2, s2 - 0.3);
        break;
      }
    }
    this.camera.position.copy(head).addScaledVector(dir, dist);
    this.camera.lookAt(me.pos.x, 1.5, me.pos.z);

    this.drawMinimap();
  }

  private ground(x: number, z: number) {
    return this.world.ground ? this.world.ground(x, z) : groundHeight(x, z);
  }

  private collide(p: THREE.Vector3) {
    const R = 0.4;
    const bound = this.world.bound ?? GRID.bound;
    p.x = clamp(p.x, -bound, bound);
    p.z = clamp(p.z, -bound, bound);
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
    const me = this.me;
    const view = 90; // meters shown across the map
    const scale = S / view;
    const mx = (x: number) => S / 2 + (x - me.pos.x) * scale;
    const mz = (z: number) => S / 2 + (z - me.pos.z) * scale;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "#2b2d33";
    g.fillRect(0, 0, S, S);
    for (const l of this.world.lots) {
      g.fillStyle = l.park ? "#3f6b36" : "#5d5a55";
      g.fillRect(mx(l.minX), mz(l.minZ), (l.maxX - l.minX) * scale, (l.maxZ - l.minZ) * scale);
    }
    g.fillStyle = "#3f6b36";
    for (const gr of this.world.greens ?? [PARK])
      g.fillRect(mx(gr.minX), mz(gr.minZ), (gr.maxX - gr.minX) * scale, (gr.maxZ - gr.minZ) * scale);
    for (const p of this.opts.pois) {
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(mx(p.x), mz(p.z), 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#000";
      g.lineWidth = 1.5;
      g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,0.7)";
    for (const w of this.walkers) g.fillRect(mx(w.player.pos.x) - 1, mz(w.player.pos.z) - 1, 2, 2);
    g.translate(S / 2, S / 2);
    g.rotate(-me.yaw + Math.PI);
    g.fillStyle = "#3ad7ff";
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(6, 6);
    g.lineTo(-6, 6);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(255,255,255,0.4)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#fff";
    g.font = "bold 12px sans-serif";
    g.textAlign = "center";
    g.fillText("N", S / 2, 14);
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
    this.world?.dispose();
    this.renderer.dispose();
  }
}

export { blobShadow };
