import * as THREE from "three";
import { getBaller } from "~/data/characters";
import { getVenue } from "~/data/venues";
import "~/data/cast";
import { idle } from "./animator";
import { buildProceduralBody, type Body } from "./body";
import { buildCourt, type CourtScene } from "./court";
import { damp, dampAngle } from "./math";
import { createPose } from "./rig";
import { createRenderer, environmentFor, fitToParent } from "./stage";

export type CutsceneSet = "court" | "draft" | "faceoff";

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
