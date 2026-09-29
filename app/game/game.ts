import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { getBaller, type Baller } from "~/data/characters";
import { assetSources, HIGGSFIELD_ASSETS } from "~/data/higgsfield-assets";
import { getVenue } from "~/data/venues";
import { getAudio, type Sfx } from "./audio";
import { makeBallMesh } from "./ball-mesh";
import { buildProceduralBody, loadGlbScene, loadHiggsfieldBody, type Body } from "./body";
import { COURT, RIM_CENTER } from "./constants";
import { buildCourt, type CourtScene } from "./court";
import { Input } from "./input";
import { clamp, damp, rand } from "./math";
import { Match } from "./match";
import { Player } from "./player";
import { createRenderer, environmentFor, fitToParent } from "./stage";
import type { Callout, HudState, MatchConfig, MatchResult } from "./types";

export interface GameCallbacks {
  hud(h: HudState): void;
  callout(c: Callout): void;
  over(r: MatchResult): void;
  pause(): void;
}

export interface Overlay {
  meter: HTMLElement | null;
}

/**
 * Owns the renderer, scene, camera and loop for one match.
 */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 400);
  private court!: CourtScene;
  private match!: Match;
  private input = new Input();
  private ballMesh = makeBallMesh();
  private raf = 0;
  private last = 0;
  private disposed = false;
  paused = false;
  private timeScale = 1;
  private slowT = 0;
  private shakeAmt = 0;
  private camPos = new THREE.Vector3(0, 6, 18);
  private camLook = new THREE.Vector3(0, 1.5, 6);
  private calloutId = 0;
  private hudT = 0;
  private rimWob = 0;
  private special: { p: Player; t: number } | null = null;
  private fx = new THREE.Group();
  private bolts: { line: THREE.Line; life: number }[] = [];
  private sparks!: THREE.Points;
  private sparkVel: THREE.Vector3[] = [];
  private sparkLife: number[] = [];
  private trail: THREE.Mesh[] = [];
  private audio = getAudio();
  private baller: [Baller, Baller];
  private modelKinds: [string, string] = ["procedural", "procedural"];
  private loadingText = "Loading court…";
  private guards: THREE.Object3D[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private config: MatchConfig,
    private cb: GameCallbacks,
    private overlay: Overlay,
  ) {
    this.renderer = createRenderer(canvas, { shadows: config.shadows, pixelRatio: 1.75 });
    this.scene.environment = environmentFor(this.renderer);
    this.scene.environmentIntensity = 0.25;
    const venue = getVenue(config.venueId);
    this.scene.fog = new THREE.FogExp2(venue.fog, venue.fogDensity);
    this.baller = [getBaller(config.playerId), getBaller(config.opponentId)];

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.court = buildCourt(venue, { shadows: config.shadows });
    this.scene.add(this.court.group);
    this.scene.add(this.ballMesh);
    this.scene.add(this.fx);
    this.initSparks();
    void this.init();
  }

  private async init() {
    const bodies: Body[] = [];
    if (this.config.playerLook) this.baller[0] = { ...this.baller[0], look: this.config.playerLook };
    for (const [i, b] of this.baller.entries()) {
      let body: Body | null = null;
      if (this.config.useHiggsfield && b.model && !(i === 0 && this.config.playerLook)) {
        this.loadingText = `Loading ${b.nickname} (Higgsfield 3D model)…`;
        this.pushHud();
        body = await Promise.race([
          loadHiggsfieldBody(b, assetSources(b.model)),
          new Promise<null>((r) => setTimeout(() => r(null), 12000)),
        ]);
      }
      if (body) this.modelKinds[i] = "higgsfield";
      bodies.push(body ?? buildProceduralBody(b));
    }
    if (this.disposed) return;
    for (const b of bodies) this.scene.add(b.root);
    const players: [Player, Player] = [
      new Player(0, this.baller[0], bodies[0]),
      new Player(1, this.baller[1], bodies[1]),
    ];
    this.match = new Match(this.config, players, {
      callout: (c) => this.cb.callout({ ...c, id: ++this.calloutId }),
      sfx: (n, s) => this.audio.play(n as Sfx, s),
      shake: (a) => (this.shakeAmt = Math.max(this.shakeAmt, this.config.cameraShake ? a : a * 0.2)),
      flash: (a) => this.court.flash(a),
      slowmo: (s, sec) => {
        this.timeScale = s;
        this.slowT = sec;
      },
      specialStart: (p) => this.startSpecialFx(p),
      specialEnd: () => this.endSpecialFx(),
      over: (r) => setTimeout(() => this.cb.over(r), 2200),
      rimWobble: (a) => (this.rimWob = Math.max(this.rimWob, a)),
    });
    if (this.config.useHiggsfield) void this.addBodyguards();
    this.audio.startCrowd();
    const v = getVenue(this.config.venueId);
    this.audio.startMusic(v.music.bpm, v.music.root, v.music.mood);
    this.last = performance.now();
    if (import.meta.env.DEV) (window as unknown as { __cc: Game }).__cc = this;
    this.loop();
  }

  /** Dev/testing: run the simulation without rendering */
  debugAdvance(seconds: number, step = 1 / 60) {
    for (let t = 0; t < seconds; t += step) this.step(step);
  }

  debugState() {
    const m = this.match;
    return {
      phase: m.phase,
      time: m.time.toFixed(1),
      score: m.score,
      handler: m.handler?.baller.id ?? null,
      ball: m.ball.pos.toArray().map((v) => +v.toFixed(2)),
      actions: m.players.map((p) => p.action?.type ?? "-"),
      stats: m.players.map((p) => p.stats),
    };
  }

  /** Higgsfield-generated bodyguards (Kairo's security detail) standing courtside */
  private async addBodyguards() {
    if (this.config.playerId !== "kairo") return;
    const scene = await Promise.race([
      loadGlbScene(assetSources("bodyguard-mesh")),
      new Promise<null>((r) => setTimeout(() => r(null), 10000)),
    ]);
    if (!scene || this.disposed) return;
    for (const x of [-1, 1]) {
      const g = scene.clone(true);
      const box = new THREE.Box3().setFromObject(g);
      const size = box.getSize(new THREE.Vector3());
      const s = 2.03 / Math.max(size.y, 1e-3);
      g.scale.setScalar(s);
      const holder = new THREE.Group();
      holder.add(g);
      const box2 = new THREE.Box3().setFromObject(g);
      g.position.y -= box2.min.y;
      holder.position.set(x * (COURT.halfWidth + 1.4), 0, COURT.length - 1.5);
      holder.rotation.y = x > 0 ? -Math.PI * 0.8 : Math.PI * 0.8;
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      this.scene.add(holder);
      this.guards.push(holder);
    }
  }

  get ready() {
    return !!this.match;
  }

  private initSparks() {
    const N = 160;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.sparks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.09,
        color: "#ffffff",
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.sparks.frustumCulled = false;
    for (let i = 0; i < N; i++) {
      this.sparkVel.push(new THREE.Vector3());
      this.sparkLife.push(0);
    }
    this.fx.add(this.sparks);
  }

  private burst(at: THREE.Vector3, color: string, n = 60, speed = 6) {
    (this.sparks.material as THREE.PointsMaterial).color.set(color);
    const pos = this.sparks.geometry.attributes.position as THREE.BufferAttribute;
    let made = 0;
    for (let i = 0; i < this.sparkLife.length && made < n; i++) {
      if (this.sparkLife[i] > 0) continue;
      pos.setXYZ(i, at.x, at.y, at.z);
      this.sparkVel[i]
        .set(rand(-1, 1), rand(0, 1.4), rand(-1, 1))
        .normalize()
        .multiplyScalar(rand(0.3, 1) * speed);
      this.sparkLife[i] = rand(0.4, 1);
      made++;
    }
  }

  private bolt(from: THREE.Vector3, to: THREE.Vector3, color: string) {
    const pts: THREE.Vector3[] = [];
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const p = from.clone().lerp(to, i / segs);
      if (i > 0 && i < segs) p.add(new THREE.Vector3(rand(-0.4, 0.4), rand(-0.2, 0.2), rand(-0.4, 0.4)));
      pts.push(p);
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, toneMapped: false }),
    );
    this.fx.add(line);
    this.bolts.push({ line, life: 0.25 });
  }

  private startSpecialFx(p: Player) {
    this.special = { p, t: 0 };
    this.audio.play("whoosh");
  }

  private endSpecialFx() {
    this.special = null;
    for (const t of this.trail) this.fx.remove(t);
    this.trail = [];
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    fitToParent(this.renderer, this.camera);
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer.setSize(size.x, size.y);

    this.input.poll();
    if (this.input.wasPressed("pause")) this.cb.pause();
    if (this.paused) {
      this.input.endFrame();
      this.render();
      return;
    }
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.timeScale = 1;
    }
    dt *= this.timeScale;
    this.step(dt);
    this.input.endFrame();
    this.render();
  };

  private step(dt: number) {
    const m = this.match;
    const inp = this.input;
    m.update(dt, {
      moveX: inp.moveX,
      moveZ: inp.moveZ,
      turbo: inp.isHeld("turbo"),
      shootPress: inp.wasPressed("shoot"),
      shootHeld: inp.isHeld("shoot"),
      shootRelease: inp.wasReleased("shoot"),
      juke: inp.wasPressed("juke"),
      trick: inp.wasPressed("trick"),
      lob: inp.wasPressed("lob"),
      special: inp.wasPressed("special"),
    });

    const t = m.time;
    const defendingOf = (i: number) => !m.players[i].hasBall && m.players[1 - i].hasBall && m.phase === "live";
    for (const p of m.players) p.animate(dt, t, defendingOf(p.id));
    // Ball mesh follows the simulation
    if (m.handler) m.handler.ballWorld(this.ballMesh.position);
    else this.ballMesh.position.copy(m.ball.pos);
    this.ballMesh.rotation.x += (m.handler ? 0 : m.ball.spin.x) * dt;
    this.ballMesh.visible = m.phase !== "over" || !!m.ball.shot;

    // Rim & net wobble
    this.rimWob = Math.max(0, this.rimWob - dt * 2.5);
    this.court.rim.rotation.x = Math.sin(t * 40) * 0.05 * this.rimWob;
    this.court.net.scale.y = 1 + Math.sin(t * 30) * 0.15 * this.rimWob;

    const hype = Math.max(m.players[0].hype, m.players[1].hype) / 100;
    const excitement = clamp(hype * 0.5 + (m.phase === "special" ? 1 : 0) + (m.phase === "dead" ? 0.6 : 0), 0, 1);
    this.court.update(t, dt, excitement);
    this.audio.setCrowd(excitement);

    this.updateFx(dt);
    this.updateCamera(dt);
    this.updateMeter();

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.08;
      this.pushHud();
    }
  }

  private updateFx(dt: number) {
    // Sparks
    const pos = this.sparks.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.sparkLife.length; i++) {
      if (this.sparkLife[i] <= 0) {
        pos.setXYZ(i, 0, -50, 0);
        continue;
      }
      this.sparkLife[i] -= dt;
      const v = this.sparkVel[i];
      v.y -= 9 * dt;
      pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt);
    }
    pos.needsUpdate = true;
    // Bolts
    for (const b of this.bolts) {
      b.life -= dt;
      (b.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, b.life * 4);
    }
    for (const b of this.bolts.filter((x) => x.life <= 0)) {
      this.fx.remove(b.line);
      b.line.geometry.dispose();
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);

    // Special move: dim the world, charge, trails, lightning
    const dimTarget = this.special ? 0.12 : 1;
    for (const d of this.court.dimmables) d.light.intensity = damp(d.light.intensity, d.base * dimTarget, 6, dt);
    this.bloom.strength = damp(this.bloom.strength, this.special ? 1.4 : 0.55, 6, dt);
    if (this.special) {
      const s = this.special;
      s.t += dt;
      const p = s.p;
      const color = p.baller.special.color;
      const chest = new THREE.Vector3(p.pos.x, p.y + p.height * 0.6, p.pos.z);
      if (Math.random() < dt * 30) this.burst(chest, color, 6, 3);
      const style = p.baller.special.style;
      if ((style === "lightning" || style === "reign") && Math.random() < dt * 10) {
        this.bolt(chest.clone().add(new THREE.Vector3(rand(-3, 3), 9, rand(-3, 3))), chest, color);
      }
      if (style === "viral" && Math.random() < dt * 14) this.court.flash(0.35);
      // Afterimage trail while dashing
      if (s.t > 0.7 && s.t < 2 && Math.random() < dt * 22) {
        const ghost = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.16, p.height * 0.55, 4, 8),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.16,
            toneMapped: false,
            depthWrite: false,
          }),
        );
        ghost.position.set(p.pos.x, p.y + p.height * 0.5, p.pos.z);
        this.fx.add(ghost);
        this.trail.push(ghost);
      }
      if (s.t > 1.95 && s.t < 2.0) {
        this.burst(new THREE.Vector3(RIM_CENTER.x, RIM_CENTER.y, RIM_CENTER.z), color, 120, 9);
        if (style === "lightning" || style === "reign")
          for (let i = 0; i < 4; i++)
            this.bolt(
              new THREE.Vector3(rand(-6, 6), 30, rand(-10, 0)),
              new THREE.Vector3(0, RIM_CENTER.y, RIM_CENTER.z),
              color,
            );
      }
    }
    for (const g of this.trail) {
      const mm = g.material as THREE.MeshBasicMaterial;
      mm.opacity = Math.max(0, mm.opacity - dt * 0.5);
    }
  }

  private updateCamera(dt: number) {
    const m = this.match;
    const [p0, p1] = m.players;
    const t = m.time;
    let pos: THREE.Vector3;
    let look: THREE.Vector3;
    if (m.phase === "intro") {
      // Orbit the two ballers
      const a = -0.9 + (m.phaseT / 3.2) * 1.8;
      const c = new THREE.Vector3((p0.pos.x + p1.pos.x) / 2, 1.3, (p0.pos.z + p1.pos.z) / 2);
      pos = new THREE.Vector3(c.x + Math.sin(a) * 4.2, 1.6 + m.phaseT * 0.3, c.z + Math.cos(a) * 4.2);
      look = c;
    } else if (this.special) {
      const p = this.special.p;
      const st = this.special.t;
      const c = new THREE.Vector3(p.pos.x, p.y + 1.3, p.pos.z);
      if (st < 0.7) {
        const a = st * 1.6;
        pos = new THREE.Vector3(c.x + Math.sin(a) * 3.2, 1.2, c.z + 3.2 * Math.cos(a));
        look = c;
      } else {
        pos = new THREE.Vector3(c.x * 0.4 + 4.5, 1.0, RIM_CENTER.z + 5.5);
        look = new THREE.Vector3(RIM_CENTER.x, 2.6, RIM_CENTER.z);
      }
    } else if (m.phase === "over") {
      const w = m.players.find((p) => p.action?.type === "celebrate") ?? p0;
      const a = t * 0.3;
      pos = new THREE.Vector3(w.pos.x + Math.sin(a) * 3.6, 1.7, w.pos.z + Math.cos(a) * 3.6);
      look = new THREE.Vector3(w.pos.x, 1.2, w.pos.z);
    } else {
      // Gameplay: behind the play looking at the hoop
      const b = m.ball.pos;
      const fx = (p0.pos.x + p1.pos.x + b.x) / 3;
      const fz = clamp((p0.pos.z + p1.pos.z + b.z * 2) / 4, 2.5, 11.5);
      pos = new THREE.Vector3(fx * 0.5, 4.3 + fz * 0.06, fz + 7.4);
      look = new THREE.Vector3(fx * 0.75, 1.5, fz - 3.2);
    }
    const lambda = m.phase === "intro" || this.special ? 6 : 3.5;
    this.camPos.x = damp(this.camPos.x, pos.x, lambda, dt);
    this.camPos.y = damp(this.camPos.y, pos.y, lambda, dt);
    this.camPos.z = damp(this.camPos.z, pos.z, lambda, dt);
    this.camLook.x = damp(this.camLook.x, look.x, lambda + 1, dt);
    this.camLook.y = damp(this.camLook.y, look.y, lambda + 1, dt);
    this.camLook.z = damp(this.camLook.z, look.z, lambda + 1, dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
    const sh = this.shakeAmt * this.shakeAmt;
    this.camera.position.set(this.camPos.x + rand(-sh, sh), this.camPos.y + rand(-sh, sh), this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.camera.fov = damp(this.camera.fov, this.special ? 38 : 46, 4, dt);
    this.camera.updateProjectionMatrix();
  }

  /** Shot meter: positioned over the human player's head, updated per frame */
  private updateMeter() {
    const el = this.overlay.meter;
    if (!el) return;
    const human = this.match.players[0];
    const st = this.match.meterFor(human);
    if (!st.active || this.config.cpuVsCpu) {
      el.style.opacity = "0";
      return;
    }
    const head = new THREE.Vector3(human.pos.x, human.y + human.height + 0.45, human.pos.z).project(this.camera);
    const size = this.renderer.getSize(new THREE.Vector2());
    const x = (head.x * 0.5 + 0.5) * size.x;
    const y = (-head.y * 0.5 + 0.5) * size.y;
    el.style.opacity = "1";
    el.style.transform = `translate(${x + 44}px, ${y}px)`;
    el.style.setProperty("--fill", String(st.fill));
    el.dataset.result = st.result === null ? "" : st.result >= 0.999 ? "perfect" : st.result > 0.6 ? "good" : "bad";
  }

  private pushHud() {
    const m = this.match;
    if (!m) {
      this.cb.hud({
        phase: "loading",
        score: [0, 0],
        target: this.config.target,
        shotClock: 14,
        hype: [0, 0],
        turbo: [1, 1],
        possession: 0,
        needClear: false,
        countdown: 0,
        loadingText: this.loadingText,
        modelKinds: this.modelKinds,
      });
      return;
    }
    this.cb.hud({
      phase: m.phase,
      score: [...m.score] as [number, number],
      target: this.config.target,
      shotClock: m.shotClock,
      hype: [m.players[0].hype, m.players[1].hype],
      turbo: [m.players[0].turbo, m.players[1].turbo],
      possession: m.possession,
      needClear: m.needClear,
      countdown: m.phase === "intro" ? 3.2 - m.phaseT : 0,
      loadingText: "",
      modelKinds: this.modelKinds,
    });
  }

  private render() {
    this.composer.render();
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.audio.stopMusic();
    else {
      const v = getVenue(this.config.venueId);
      this.audio.startMusic(v.music.bpm, v.music.root, v.music.mood);
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.audio.stopMusic();
    this.audio.setCrowd(0);
    this.input.dispose();
    this.match?.players.forEach((p) => p.body.dispose());
    this.composer.dispose();
    this.renderer.dispose();
  }
}

export { HIGGSFIELD_ASSETS };
