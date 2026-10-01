import * as THREE from "three";
import { getBaller } from "~/data/characters";
import { cityFor } from "~/data/cities";
import { getVenue } from "~/data/venues";
import "~/data/cast";
import { idle } from "./animator";
import { buildProceduralBody, type Body } from "./body";
import { buildCourt, type CourtScene } from "./court";
import { damp, dampAngle } from "./math";
import { createPose } from "./rig";
import { createRenderer, environmentFor, fitToParent } from "./stage";

export type CutsceneSet = "court" | "draft" | "faceoff" | "home";

interface Actor {
  id: string;
  body: Body;
  home: THREE.Vector3;
  yaw: number;
  pose: ReturnType<typeof createPose>;
  talk: number;
}

/**
 * Stages dialogue scenes in 3D: the cast stands on a set (any venue, or the
 * draft theater), the camera cuts between speakers, and the speaker talks
 * with their hands.
 */
export class CutsceneStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 500);
  private actors: Actor[] = [];
  private speaker: Actor | null = null;
  private camPos = new THREE.Vector3(0, 2, 8);
  private camLook = new THREE.Vector3(0, 1.4, 0);
  private raf = 0;
  private clock = new THREE.Clock();
  private court: CourtScene | null = null;
  private disposed = false;
  private t = 0;
  private faceoff = false;
  /** Snap the camera to its target on the next frame */
  private cut = true;

  constructor(canvas: HTMLCanvasElement, opts: { set: CutsceneSet; venueId?: string; actors: string[] }) {
    this.renderer = createRenderer(canvas, { shadows: true, pixelRatio: 1.5 });
    this.scene.environment = environmentFor(this.renderer);
    this.scene.environmentIntensity = 0.3;
    const faceoff = opts.set === "faceoff";
    this.faceoff = faceoff;
    if (opts.set === "draft") this.buildDraftStage();
    else if (opts.set === "home") this.buildHomeStage(opts.venueId ?? "atl:3");
    else {
      // (court and faceoff both stand on a venue)
      const v = getVenue(opts.venueId ?? "pier-9");
      this.court = buildCourt(v, { shadows: true });
      this.scene.add(this.court.group);
      this.scene.fog = new THREE.FogExp2(v.fog, v.fogDensity * 0.7);
    }
    // Stand the cast in a loose arc near center court
    const n = opts.actors.length;
    opts.actors.forEach((id, i) => {
      const b = getBaller(id);
      const body = buildProceduralBody(b);
      const spread = Math.min(opts.set === "draft" ? 1.5 : 1.8, 5 / Math.max(1, n));
      const x = (i - (n - 1) / 2) * spread;
      // Curve the line away from the camera so side actors never block the speaker
      const z = (opts.set === "draft" ? 0 : 7.5) - Math.abs(x) * 0.35;
      const home = new THREE.Vector3(x, opts.set === "draft" ? 1.2 : 0, z);
      // Face the center of the group, slightly toward camera
      let yaw = Math.atan2(-x * 0.6, 2.5);
      if (faceoff) {
        // First two actors square up nose to nose at center court; the rest watch from behind
        if (i < 2) {
          home.set(i === 0 ? -0.62 : 0.62, 0, 12.2);
          yaw = i === 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          home.set((i - 2 - (n - 3) / 2) * 1.6, 0, 10.2);
          yaw = 0.2 * Math.sign(-home.x);
        }
      }
      body.root.position.copy(home);
      body.root.rotation.y = yaw;
      this.scene.add(body.root);
      this.actors.push({ id, body, home, yaw, pose: createPose(), talk: 0 });
    });
    this.loop();
  }

  private buildDraftStage() {
    const s = this.scene;
    s.background = new THREE.Color("#05060c");
    s.fog = new THREE.Fog("#05060c", 14, 40);
    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(16, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: "#12131a", roughness: 0.3, metalness: 0.4 }),
    );
    stage.position.set(0, 0.6, 0);
    stage.receiveShadow = true;
    s.add(stage);
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(16.2, 0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: "#6a3fc8" }),
    );
    edge.position.set(0, 1.2, 4);
    s.add(edge);
    // Giant screen
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const g = c.getContext("2d")!;
    const grd = g.createLinearGradient(0, 0, 1024, 512);
    grd.addColorStop(0, "#3b1f7a");
    grd.addColorStop(1, "#0b1a33");
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.font = "900 190px 'Bebas Neue', Impact, sans-serif";
    g.fillText("EBL DRAFT", 512, 260);
    g.font = "900 60px 'Bebas Neue', Impact, sans-serif";
    g.fillStyle = "#e2b23a";
    g.fillText("ELITE BASKETBALL LEAGUE", 512, 360);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 7),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    screen.position.set(0, 5.5, -3.8);
    s.add(screen);
    // Podium
    const pod = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.2, 0.6),
      new THREE.MeshStandardMaterial({ color: "#1b1c24", metalness: 0.6 }),
    );
    pod.position.set(2.8, 1.8, 0.4);
    pod.castShadow = true;
    s.add(pod);
    // Spotlights + haze beams
    s.add(new THREE.HemisphereLight("#8fa8ff", "#100808", 0.5));
    for (const [x, col] of [
      [-4, "#ffffff"],
      [0, "#b88cff"],
      [4, "#ffffff"],
    ] as const) {
      const l = new THREE.SpotLight(col, 400, 30, 0.35, 0.5, 1.4);
      l.position.set(x, 12, 6);
      l.target.position.set(x * 0.3, 1, 0);
      l.castShadow = true;
      s.add(l, l.target);
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 12, 24, 1, true),
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.05,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.set(x * 0.65, 6.2, 3);
      beam.rotation.x = -0.45;
      s.add(beam);
    }
    // Audience silhouettes
    const geo = new THREE.CapsuleGeometry(0.25, 0.6, 4, 8);
    const crowd = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: "#1c2030" }), 120);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 120; i++) {
      const row = Math.floor(i / 20);
      m.makeTranslation(-9.5 + (i % 20) + (row % 2) * 0.5, 0.2 + row * 0.35, 6.5 + row * 1.1);
      crowd.setMatrixAt(i, m);
    }
    s.add(crowd);
    // Confetti
    const N = 400;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const conf = new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.08, color: "#ffd24a" }));
    conf.name = "confetti";
    s.add(conf);
  }

  /** Your living room: "<teamId>:<tier>" picks the city view and how fancy it is */
  private buildHomeStage(id: string) {
    const [teamId, tierStr, newborn] = id.split(":");
    const tier = Number(tierStr) || 3;
    const city = cityFor(teamId);
    const s = this.scene;
    s.background = new THREE.Color("#0c0a09");
    const mat = (color: string, rough = 0.8, metal = 0, emissive?: string, ei = 1) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emissive ?? "#000", emissiveIntensity: ei });
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      b.castShadow = b.receiveShadow = true;
      s.add(b);
      return b;
    };
    const canvas = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      draw(c.getContext("2d")!);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const Z = 7.5;
    // Hardwood floor
    const planks = canvas(256, 256, (g) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = ["#8a5a36", "#7d5131", "#94633d", "#80542f"][i % 4];
        g.fillRect(0, i * 32, 256, 32);
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.fillRect(0, i * 32 + 31, 256, 1);
        g.fillRect(((i * 97) % 200) + 20, i * 32, 1, 32);
      }
    });
    planks.wrapS = planks.wrapT = THREE.RepeatWrapping;
    planks.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), new THREE.MeshStandardMaterial({ map: planks, roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, Z);
    floor.receiveShadow = true;
    s.add(floor);
    // Walls
    const wallColor = tier >= 4 ? "#ece6dc" : tier >= 2 ? "#d9d2c6" : "#c9ccd2";
    const wall = mat(wallColor, 0.95);
    const backZ = Z - 4.2;
    box(18, 5, 0.3, wall, 0, 2.5, backZ - 0.15);
    box(0.3, 5, 14, wall, -7.5, 2.5, Z);
    box(0.3, 5, 14, wall, 7.5, 2.5, Z);
    // Big window onto the city
    const view = canvas(1024, 384, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 384);
      grd.addColorStop(0, city.sky[0]);
      grd.addColorStop(1, city.sky[1]);
      g.fillStyle = grd;
      g.fillRect(0, 0, 1024, 384);
      let seed = 3;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      if (tier >= 4) {
        // Hills and trees from the big house
        g.fillStyle = "#5f7d4a";
        g.beginPath();
        g.moveTo(0, 300);
        for (let x = 0; x <= 1024; x += 64) g.lineTo(x, 270 + Math.sin(x * 0.01) * 26);
        g.lineTo(1024, 384);
        g.lineTo(0, 384);
        g.fill();
      }
      g.fillStyle = "rgba(40,48,66,0.85)";
      for (let x = 0; x < 1024; x += 30 + r() * 30) {
        const h = 80 + r() * (tier >= 4 ? 90 : 220);
        g.fillRect(x, 384 - h - (tier >= 4 ? 70 : 0), 26 + r() * 30, h);
      }
      g.fillStyle = "rgba(255,220,150,0.55)";
      for (let i = 0; i < 260; i++) g.fillRect(r() * 1024, 160 + r() * 200, 3, 4);
    });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshBasicMaterial({ map: view, toneMapped: false }));
    win.position.set(0, 2.3, backZ + 0.02);
    s.add(win);
    const frameM = mat("#2a2622", 0.4, 0.3);
    for (const x of [-4.5, -1.5, 1.5, 4.5]) box(0.12, 3.5, 0.12, frameM, x, 2.3, backZ + 0.06);
    box(9.1, 0.14, 0.14, frameM, 0, 4.05, backZ + 0.06);
    box(9.1, 0.14, 0.14, frameM, 0, 0.55, backZ + 0.06);
    // Sectional couch
    const fabric = mat(tier >= 4 ? "#efe8dc" : tier >= 2 ? "#4a5a6e" : "#6b6f78", 0.9);
    box(6.4, 0.5, 1.2, fabric, 0, 0.45, Z - 2.4);
    box(6.4, 0.9, 0.35, fabric, 0, 0.9, Z - 3.0);
    box(1.2, 0.5, 2.6, fabric, -3.4, 0.45, Z - 1.6);
    for (const x of [-2.2, 0, 2.2]) box(1.9, 0.18, 1.05, mat(tier >= 4 ? "#f7f2e9" : "#56677c", 0.95), x, 0.79, Z - 2.35);
    // Rug and coffee table
    const rug = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), mat(tier >= 4 ? "#b9a27c" : "#7d4e5b", 1));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.3, 0.01, Z - 0.6);
    rug.receiveShadow = true;
    s.add(rug);
    box(2.2, 0.08, 1.0, mat("#1c1a18", 0.3, 0.2), 0.4, 0.42, Z - 1.1).castShadow = false;
    for (const [x, z] of [[-0.6, -1.5], [1.4, -1.5], [-0.6, -0.7], [1.4, -0.7]]) box(0.07, 0.4, 0.07, mat("#1c1a18"), x, 0.2, Z + z);
    // TV wall on the right
    box(0.12, 1.5, 2.6, mat("#0a0a0c", 0.2, 0.6, "#2a5bd7", 0.35), 7.3, 2.1, Z - 0.5);
    box(0.4, 0.5, 3.4, mat("#2b2724", 0.6), 7.1, 0.25, Z - 0.5);
    // Lamp + plants
    box(0.08, 2.2, 0.08, mat("#222"), -5.6, 1.1, Z - 3.1);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.5, 20, 1, true), mat("#f3e6c8", 0.9, 0, "#ffd9a0", 0.8));
    shade.position.set(-5.6, 2.35, Z - 3.1);
    s.add(shade);
    for (const [x, z] of [[5.4, -3.2], [-6.6, 1.5]]) {
      box(0.6, 0.6, 0.6, mat("#e9e4da", 0.6), x, 0.3, Z + z);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), mat("#3f7a3a", 0.8));
      leaves.position.set(x, 1.15, Z + z);
      leaves.castShadow = true;
      s.add(leaves);
    }
    // Family photos (and trophies once you can afford a trophy room)
    const photo = (x: number, c: string) => {
      const t = canvas(64, 80, (g) => {
        g.fillStyle = "#f4efe6";
        g.fillRect(0, 0, 64, 80);
        g.fillStyle = c;
        g.fillRect(6, 6, 52, 68);
        g.fillStyle = "rgba(255,255,255,0.5)";
        g.beginPath();
        g.arc(24, 36, 9, 0, Math.PI * 2);
        g.arc(42, 40, 7, 0, Math.PI * 2);
        g.fill();
      });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.88), new THREE.MeshStandardMaterial({ map: t }));
      p.position.set(x, 2.6, backZ + 0.03);
      s.add(p);
    };
    photo(-6, "#c98a5a");
    photo(-5.1, city.accent);
    photo(5.4, "#5a7ac9");
    if (tier >= 4)
      for (let i = 0; i < 3; i++) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.5, 16), mat("#e2b23a", 0.25, 0.9));
        cup.position.set(5.0 + i * 0.5, 1.45, backZ + 0.35);
        cup.castShadow = true;
        s.add(cup);
      }
    if (tier >= 4) box(1.8, 0.08, 0.5, mat("#3a2f26", 0.5), 5.5, 1.16, backZ + 0.3);
    // A newborn sleeps in the bassinet by the couch
    if (newborn === "g" || newborn === "b") {
      const wood = mat("#e9dfcf", 0.7);
      box(1.0, 0.5, 0.6, wood, 3.3, 0.75, Z - 0.9);
      for (const [x, z] of [[-0.42, -0.24], [0.42, -0.24], [-0.42, 0.24], [0.42, 0.24]])
        box(0.05, 0.5, 0.05, wood, 3.3 + x, 0.25, Z - 0.9 + z);
      box(0.9, 0.06, 0.5, mat("#ffffff", 0.9), 3.3, 1.0, Z - 0.9);
      const swaddle = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 6, 12), mat(newborn === "g" ? "#f5a3c7" : "#7bc4f2", 0.9));
      swaddle.rotation.z = Math.PI / 2;
      swaddle.position.set(3.25, 1.12, Z - 0.9);
      s.add(swaddle);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat("#734732", 0.7));
      head.position.set(3.53, 1.14, Z - 0.9);
      s.add(head);
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 6, 12), mat(newborn === "g" ? "#e0567f" : "#2f6bff"));
      bow.position.set(3.56, 1.25, Z - 0.9);
      s.add(bow);
    }
    // Light: warm room plus daylight through the window
    s.add(new THREE.HemisphereLight("#fff1dc", "#5a4030", 0.9));
    const sun = new THREE.DirectionalLight(city.sun, 2.2);
    sun.position.set(-3, 7, backZ - 6);
    sun.target.position.set(0, 0, Z);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    s.add(sun, sun.target);
    const lamp = new THREE.PointLight("#ffd9a0", 6, 9, 1.6);
    lamp.position.set(-5.6, 2.3, Z - 2.6);
    s.add(lamp);
    const fill = new THREE.PointLight("#fff3e0", 10, 16, 1.4);
    fill.position.set(0, 4, Z + 3);
    s.add(fill);
  }

  /** Cut the camera to this actor (null = wide shot) */
  setSpeaker(id: string | null) {
    const next = id ? (this.actors.find((a) => a.id === id) ?? null) : null;
    // Film-style hard cut on a new speaker, instead of dollying through the cast
    if (next !== this.speaker) this.cut = true;
    this.speaker = next;
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.step(dt);
    this.renderer.render(this.scene, this.camera);
  };

  step(dt: number) {
    this.t += dt;
    fitToParent(this.renderer, this.camera);
    this.court?.update(this.t, dt, 0.3);
    const conf = this.scene.getObjectByName("confetti") as THREE.Points | undefined;
    if (conf) {
      const p = conf.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * 1.2;
        if (y < 1.2) y = 10;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }
    for (const a of this.actors) {
      const speaking = a === this.speaker;
      a.talk = damp(a.talk, speaking ? 1 : 0, 6, dt);
      // Speaker turns toward the camera a little
      const want = speaking && !this.faceoff ? 0 : a.yaw;
      a.body.root.rotation.y = dampAngle(a.body.root.rotation.y, want, 4, dt);
      a.body.root.position.copy(a.home);
      a.body.root.updateMatrixWorld(true);
      const p = a.body.poser.proportions;
      idle(p, this.t + a.home.x, a.pose);
      if (a.talk > 0.01) {
        const g = Math.sin(this.t * 5 + a.home.x) * 0.5 + 0.5;
        a.pose.handR.set(-0.15, p.hipY + 0.2 + g * 0.25 * a.talk, 0.25 + 0.15 * a.talk);
        a.pose.handL.x += 0.05 * a.talk;
        a.pose.headRot.y = Math.sin(this.t * 1.7) * 0.12 * a.talk;
        a.pose.headRot.x = -0.05 + Math.sin(this.t * 7) * 0.03 * a.talk;
        a.pose.elbowPoleR.set(-1, -0.3, -0.2);
      }
      a.body.poser.apply(a.pose);
    }
    // Camera: close-up on the speaker, otherwise a wide two-shot
    let pos: THREE.Vector3;
    let look: THREE.Vector3;
    const sp = this.speaker;
    const [f0, f1] = this.actors;
    if (this.faceoff && f0 && f1 && (!sp || sp === f0 || sp === f1)) {
      if (sp) {
        // Over the other player's shoulder, looking at the speaker
        const other = sp === f0 ? f1 : f0;
        const h = getBaller(sp.id).height;
        const head = sp.home.clone().setY(h * 0.9);
        const dir = other.home.clone().sub(sp.home).setY(0).normalize();
        pos = other.home
          .clone()
          .setY(getBaller(other.id).height * 0.95)
          .addScaledVector(dir, 1.9)
          .add(new THREE.Vector3(0, 0.12, 1.05));
        look = head.add(new THREE.Vector3(0, -0.12, 0));
      } else {
        // Side-on two-shot: both players in profile, crowd behind
        const hy = (getBaller(f0.id).height + getBaller(f1.id).height) * 0.42;
        pos = new THREE.Vector3(Math.sin(this.t * 0.15) * 0.4, hy + 0.1, 15.6);
        look = new THREE.Vector3(0, hy - 0.05, 12.2);
      }
    } else if (sp) {
      const h = getBaller(sp.id).height;
      const head = sp.home.clone().setY(sp.home.y + h * 0.88);
      // Shoot from the audience side (+z) so the rest of the cast stays beside
      // or behind the speaker, never between them and the lens. Offset
      // toward the group's center so a neighbor is visible over the shoulder.
      const side = sp.home.x > 0.1 ? -1 : 1;
      pos = head.clone().add(new THREE.Vector3(side * 1.1, 0.1, 3.4));
      look = head.clone().add(new THREE.Vector3(side * 0.35, -0.2, 0));
    } else {
      const c = this.actors
        .reduce((acc, a) => acc.add(a.home), new THREE.Vector3())
        .divideScalar(Math.max(1, this.actors.length));
      pos = c.clone().add(new THREE.Vector3(Math.sin(this.t * 0.1) * 1.5, 1.9, 6.5));
      look = c.clone().add(new THREE.Vector3(0, 1.2, 0));
    }
    if (this.cut) {
      this.cut = false;
      this.camPos.copy(pos);
      this.camLook.copy(look);
    }
    const k = 3;
    this.camPos.set(
      damp(this.camPos.x, pos.x, k, dt),
      damp(this.camPos.y, pos.y, k, dt),
      damp(this.camPos.z, pos.z, k, dt),
    );
    this.camLook.set(
      damp(this.camLook.x, look.x, k + 1, dt),
      damp(this.camLook.y, look.y, k + 1, dt),
      damp(this.camLook.z, look.z, k + 1, dt),
    );
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  /** Snap the camera to its target immediately (for screenshots) */
  settle() {
    for (let i = 0; i < 240; i++) this.step(1 / 60);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const a of this.actors) a.body.dispose();
    this.renderer.dispose();
  }
}
