import * as THREE from "three";
import type { CityTheme } from "~/data/cities";
import { buildLandmark } from "./city-world";
import { clamp } from "./math";
import { createRenderer, environmentFor, fitToParent, skyTexture } from "./stage";

/**
 * Draft-day flight: a chartered jet in your new team's colors takes off from
 * the old city, cruises over a sea of clouds and lands in your new home city.
 * Every pose is a pure function of time so `seek()` gives repeatable frames.
 */

export type FlightPhase = "depart" | "cruise" | "arrive";

export interface FlightOptions {
  from: CityTheme;
  to: CityTheme;
  /** Team colors for the livery */
  livery: [string, string];
  /** Painted on the fuselage, e.g. "SEATTLE STORM" */
  label: string;
  shadows: boolean;
}

export const FLIGHT_LENGTH = 16;
const T1 = 5; // wheels up → cruise
const T2 = 10; // cruise → descent
const GY = 3.7; // jet height with wheels on the runway

const smooth = (x: number) => x * x * (3 - 2 * x);

function facadeTexture(tint: string) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = tint;
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 8) {
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(0, y, 64, 3);
    g.fillStyle = "rgba(0,0,0,0.16)";
    g.fillRect(0, y + 6, 64, 2);
  }
  for (let x = 0; x < 64; x += 16) {
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.fillRect(x, 0, 2, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function runwayTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3a3d44";
  g.fillRect(0, 0, 128, 512);
  g.fillStyle = "#f2f2f2";
  g.fillRect(6, 0, 4, 512);
  g.fillRect(118, 0, 4, 512);
  for (let y = 0; y < 512; y += 64) g.fillRect(62, y, 4, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 6);
  return t;
}

function decalTexture(label: string, primary: string, secondary: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 1024, 128);
  g.fillStyle = primary;
  g.font = "900 italic 76px system-ui, sans-serif";
  g.textBaseline = "middle";
  g.fillText("EBL", 24, 66);
  g.fillStyle = secondary;
  g.font = "800 54px system-ui, sans-serif";
  g.fillText(label.toUpperCase(), 210, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A twin-engine charter jet, nose pointing to -z */
function buildJet(primary: string, secondary: string, label: string, track: (d: { dispose(): void }) => void) {
  const jet = new THREE.Group();
  const m = (color: string, rough = 0.35, metal = 0.25) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    track(mat);
    return mat;
  };
  const white = m("#f3f5f9");
  const team = m(primary, 0.4, 0.2);
  const trim = m(secondary, 0.4, 0.2);
  const dark = m("#15181f", 0.2, 0.6);
  const gray = m("#a9afb9", 0.5, 0.6);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = jet) => {
    track(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const R = 2.1;
  // Fuselage, nose and tail cone
  add(new THREE.CylinderGeometry(R, R, 26, 28).rotateX(Math.PI / 2), white);
  const nose = add(new THREE.SphereGeometry(R, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2), white, 0, 0, -13);
  nose.scale.set(1, 1, 2.1);
  add(new THREE.CylinderGeometry(R, 0.55, 9, 28).rotateX(-Math.PI / 2), white, 0, 0.55, 17.4).scale.set(1, 0.92, 1);
  // Team belly and cheat line
  add(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 26, 28, 1, true, Math.PI * 0.62, Math.PI * 0.76).rotateX(Math.PI / 2), team);
  add(new THREE.BoxGeometry(R * 2 + 0.08, 0.22, 26), trim, 0, -0.35, 0);
  // Windows and cockpit
  const win = new THREE.BoxGeometry(0.1, 0.42, 0.34);
  track(win);
  const rows = new THREE.InstancedMesh(win, dark, 64);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 32; i++)
    for (const s of [-1, 1]) {
      dummy.position.set(s * (R - 0.02), 0.55, -10.5 + i * 0.72);
      dummy.updateMatrix();
      rows.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), dummy.matrix);
    }
  jet.add(rows);
  const cockpit = add(new THREE.BoxGeometry(2.6, 0.5, 1.2), dark, 0, 0.95, -15.6);
  cockpit.rotation.x = -0.35;
  // Fuselage lettering
  const decal = decalTexture(label, primary, secondary);
  track(decal);
  const decalMat = new THREE.MeshBasicMaterial({ map: decal, transparent: true, depthWrite: false });
  track(decalMat);
  for (const s of [-1, 1]) {
    const p = add(new THREE.PlaneGeometry(13, 1.6), decalMat, s * (R + 0.04), 1.25, -2);
    p.rotation.y = s * (Math.PI / 2); // readable from either side
    p.castShadow = false;
  }

  // Swept wings
  const wing = new THREE.Shape();
  wing.moveTo(1.6, -3.5);
  wing.lineTo(17.5, 3.6);
  wing.lineTo(17.5, 5.4);
  wing.lineTo(1.6, 3.4);
  const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.36, bevelEnabled: false }).rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    const w = add(wingGeo, white, 0, -0.9, 0);
    w.scale.x = s;
    w.rotation.z = s * 0.06;
    // Winglet in team color
    const tip = add(new THREE.BoxGeometry(0.25, 2.2, 1.6), team, s * 17.4, 0.06 * 17.4 - 0.9 + 1.1, 4.6);
    tip.rotation.x = -0.25;
    // Engine
    add(new THREE.CylinderGeometry(1.05, 0.9, 4.2, 20).rotateX(Math.PI / 2), trim, s * 6.6, -1.9, -1.5);
    add(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 20).rotateX(Math.PI / 2), dark, s * 6.6, -1.9, -3.62);
    add(new THREE.BoxGeometry(0.3, 1, 2.4), gray, s * 6.6, -1.2, -0.8);
  }
  // Tailplane
  const tail = new THREE.Shape();
  tail.moveTo(0.8, -1.4);
  tail.lineTo(6.6, 1.8);
  tail.lineTo(6.6, 3.2);
  tail.lineTo(0.8, 2.2);
  const tailGeo = new THREE.ExtrudeGeometry(tail, { depth: 0.25, bevelEnabled: false }).rotateX(Math.PI / 2);
  for (const s of [-1, 1]) add(tailGeo, white, 0, 0.9, 17.2).scale.x = s;
  // Fin in team colors with a stripe
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(6.4, 0);
  fin.lineTo(8.6, 7.4);
  fin.lineTo(6.2, 7.4);
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.4, bevelEnabled: false }).rotateY(-Math.PI / 2);
  add(finGeo, team, 0.2, 1.4, 13.2);
  const stripe = new THREE.Shape();
  stripe.moveTo(2.6, 2.4);
  stripe.lineTo(4.2, 2.4);
  stripe.lineTo(6.4, 6.6);
  stripe.lineTo(4.8, 6.6);
  const stripeGeo = new THREE.ExtrudeGeometry(stripe, { depth: 0.48, bevelEnabled: false }).rotateY(-Math.PI / 2);
  add(stripeGeo, trim, 0.24, 1.4, 13.2);

  // Landing gear (hidden in flight)
  const gear = new THREE.Group();
  jet.add(gear);
  const tire = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 14).rotateZ(Math.PI / 2);
  for (const [x, z] of [
    [0, -11],
    [-2.6, 1.4],
    [2.6, 1.4],
  ]) {
    add(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6), gray, x, -2.4, z, gear);
    add(tire, dark, x, -3.1, z, gear);
  }

  // Contrails for the cruise shot
  const trailMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.32, depthWrite: false });
  track(trailMat);
  const trails = new THREE.Group();
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(0.35, 1.6, 90, 10, 1, true).rotateX(Math.PI / 2);
    track(g);
    const t = new THREE.Mesh(g, trailMat);
    t.position.set(s * 6.6, -1.9, 49);
    trails.add(t);
  }
  jet.add(trails);
  return { jet, gear, trails };
}

/** Ground, runway, terminal and the city (skyline + landmark) for one airport */
function buildAirport(theme: CityTheme, track: (d: { dispose(): void }) => void) {
  const g = new THREE.Group();
  const mat = (color: string, rough = 0.9) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough });
    track(m);
    return m;
  };
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    track(geo);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const desert = theme.landmark === "mountains" && !theme.rain;
  const groundColor = desert ? "#c39a64" : theme.palms ? "#7f9150" : theme.leaves[0];
  add(new THREE.BoxGeometry(1800, 1, 1800), mat(groundColor), 0, -0.5, 0);
  const rw = runwayTexture();
  track(rw);
  const runway = new THREE.MeshStandardMaterial({ map: rw, roughness: 0.85 });
  track(runway);
  add(new THREE.BoxGeometry(34, 0.12, 360), runway, 0, 0.06, -10);
  // Edge lights
  const lightMat = new THREE.MeshStandardMaterial({ color: "#ffe9a8", emissive: "#ffcf5a", emissiveIntensity: 1.4 });
  track(lightMat);
  const light = new THREE.BoxGeometry(0.4, 0.3, 0.4);
  track(light);
  for (let z = -180; z <= 160; z += 14)
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(light, lightMat);
      l.position.set(s * 18.5, 0.2, z);
      g.add(l);
    }
  // Terminal and control tower
  const glass = mat("#9ec9e6", 0.15);
  add(new THREE.BoxGeometry(24, 12, 140), mat("#dfe3ea", 0.6), -78, 6, 10);
  add(new THREE.BoxGeometry(1, 8, 132), glass, -65.6, 6.5, 10);
  const roof = add(new THREE.CylinderGeometry(14, 14, 142, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2), mat(theme.accent, 0.5), -78, 12, 10);
  roof.scale.set(1, 0.25, 1);
  roof.rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(2.2, 3, 36, 12), mat("#e8ebf0", 0.6), -58, 18, 110);
  add(new THREE.CylinderGeometry(6, 4.2, 6, 12), glass, -58, 38, 110);
  add(new THREE.CylinderGeometry(6.4, 6.4, 1, 12), mat("#2a2f3a"), -58, 41.5, 110);
  // Parked jets' tails as a hint of a busy airport
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.4, 6, 4), mat(["#d23a3a", "#2a6fd0", "#2fb36a", "#f2b632"][i]), -60, 6, -30 + i * 26);

  // Downtown beyond the runway
  const fac = facadeTexture(theme.rain ? "#7d8c99" : theme.palms ? "#a8c9dc" : "#8fa6bf");
  track(fac);
  const city = new THREE.Group();
  city.position.z = 40;
  const towers = new THREE.MeshStandardMaterial({ map: fac, roughness: 0.4, metalness: 0.3 });
  track(towers);
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const x = -300 + r() * 600;
    if (Math.abs(x) < 40) continue;
    const h = (theme.landmark === "skyline" || theme.landmark === "spire" ? 40 : 20) + r() * 80;
    const w = 12 + r() * 16;
    const geo = new THREE.BoxGeometry(w, h, w);
    track(geo);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 12), uv.getY(k) * (h / 16));
    const b = new THREE.Mesh(geo, towers);
    b.position.set(x, h / 2, -200 - r() * 50);
    city.add(b);
  }
  if (theme.city === "New York") {
    // The tall spire
    const geo = new THREE.BoxGeometry(22, 230, 22);
    track(geo);
    const t = new THREE.Mesh(geo, towers);
    t.position.set(70, 115, -230);
    city.add(t);
    const sp = new THREE.CylinderGeometry(0.4, 2, 60, 8);
    track(sp);
    const s = new THREE.Mesh(sp, mat("#cfd6e0", 0.3));
    s.position.set(70, 260, -230);
    city.add(s);
  }
  const landmark: { dispose(): void }[] = [];
  buildLandmark(city, theme, landmark);
  landmark.forEach(track);
  g.add(city);
  return g;
}

/** The cloud sea for the cruise */
function buildClouds(track: (d: { dispose(): void }) => void) {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#b8c8dc", emissiveIntensity: 0.25 });
  track(geo);
  track(mat);
  const N = 520;
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const base = Array.from({ length: N }, (_, i) => {
    const high = i > N - 40; // a few puffs at flight level whip past
    return {
      x: high ? (r() < 0.5 ? -1 : 1) * (60 + r() * 100) : -420 + r() * 840,
      y: high ? -10 + r() * 14 : -34 + r() * 10,
      z: r() * 900,
      s: high ? 3 + r() * 5 : 10 + r() * 18,
    };
  });
  const dummy = new THREE.Object3D();
  return {
    mesh,
    update(t: number) {
      for (let i = 0; i < N; i++) {
        const b = base[i];
        const z = ((b.z + t * 160) % 900) - 600;
        dummy.position.set(b.x, b.y, z);
        dummy.scale.set(b.s * 1.6, b.s * 0.55, b.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

export class FlightScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 2400);
  private disposables: { dispose(): void }[] = [];
  private jet: THREE.Group;
  private gear: THREE.Group;
  private trails: THREE.Group;
  private depart: THREE.Group;
  private arrive: THREE.Group;
  private clouds: ReturnType<typeof buildClouds>;
  private smoke: THREE.Mesh[] = [];
  private skies: Record<FlightPhase, THREE.Texture>;
  private fogs: Record<FlightPhase, THREE.Fog>;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private raf = 0;
  private last = 0;
  private phase: FlightPhase | null = null;
  private finished = false;
  t = 0;
  paused = false;

  constructor(
    canvas: HTMLCanvasElement,
    private opts: FlightOptions,
    private cb: { phase(p: FlightPhase): void; done(): void },
  ) {
    const track = (d: { dispose(): void }) => this.disposables.push(d);
    this.renderer = createRenderer(canvas, { shadows: opts.shadows, pixelRatio: 2 });
    this.scene.environment = environmentFor(this.renderer);
    track(this.scene.environment);

    const { from, to } = opts;
    this.skies = {
      depart: skyTexture(from.sky[0], from.sky[1]),
      cruise: skyTexture("#1d5fc4", "#d6ecff"),
      arrive: skyTexture(to.sky[0], to.sky[1]),
    };
    Object.values(this.skies).forEach(track);
    this.fogs = {
      depart: new THREE.Fog(from.fog, 160, 1100),
      cruise: new THREE.Fog("#cfe3fb", 120, 700),
      arrive: new THREE.Fog(to.fog, 160, 1100),
    };

    this.hemi = new THREE.HemisphereLight("#ffffff", "#666666", 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#ffffff", 3);
    this.sun.castShadow = opts.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -40;
    sc.right = sc.top = 40;
    sc.far = 300;
    this.scene.add(this.sun, this.sun.target);

    const jet = buildJet(opts.livery[0], opts.livery[1], opts.label, track);
    this.jet = jet.jet;
    this.gear = jet.gear;
    this.trails = jet.trails;
    this.scene.add(this.jet);

    this.depart = buildAirport(from, track);
    // The old city sits behind the takeoff run (the camera looks back at it)
    this.depart.rotation.y = Math.PI;
    this.depart.position.z = 60;
    this.arrive = buildAirport(to, track);
    this.clouds = buildClouds(track);
    this.scene.add(this.depart, this.arrive, this.clouds.mesh);

    const puff = new THREE.SphereGeometry(1, 10, 8);
    const puffMat = new THREE.MeshStandardMaterial({ color: "#e6e6e6", roughness: 1, transparent: true, opacity: 0.7 });
    track(puff);
    track(puffMat);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(puff, puffMat);
      this.smoke.push(p);
      this.scene.add(p);
    }

    this.pose(0);
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
      this.last = now;
      if (!this.paused) this.t = Math.min(FLIGHT_LENGTH, this.t + dt);
      this.pose(this.t);
      fitToParent(this.renderer, this.camera);
      this.renderer.render(this.scene, this.camera);
      if (this.t >= FLIGHT_LENGTH && !this.finished) {
        this.finished = true;
        this.cb.done();
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Jump to a moment (for skip-ahead and screenshots) */
  seek(t: number) {
    this.t = clamp(t, 0, FLIGHT_LENGTH);
    this.pose(this.t);
    fitToParent(this.renderer, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  private setPhase(p: FlightPhase) {
    if (p === this.phase) return;
    this.phase = p;
    const theme = p === "depart" ? this.opts.from : p === "arrive" ? this.opts.to : null;
    this.scene.background = this.skies[p];
    this.scene.fog = this.fogs[p];
    this.depart.visible = p === "depart";
    this.arrive.visible = p === "arrive";
    this.clouds.mesh.visible = p === "cruise";
    this.trails.visible = p === "cruise";
    this.hemi.color.set(theme ? theme.hemi[0] : "#dcecff");
    this.hemi.groundColor.set(theme ? theme.hemi[1] : "#9aa8ba");
    this.sun.color.set(theme ? theme.sun : "#fff6e8");
    this.sun.intensity = theme ? theme.sunIntensity : 3.4;
    this.cb.phase(p);
  }

  private pose(t: number) {
    const jet = this.jet;
    const cam = this.camera;
    const look = new THREE.Vector3();
    jet.rotation.set(0, 0, 0);
    this.smoke.forEach((s) => (s.visible = false));

    if (t < T1) {
      // Takeoff roll, rotate, climb out past a low runway-side camera
      this.setPhase("depart");
      const z = -9 * t * t;
      const y = GY + (t > 3 ? 3.6 * (t - 3) ** 2 : 0);
      jet.position.set(0, y, z);
      jet.rotation.x = clamp((t - 2.7) * 0.32, 0, 0.2);
      this.gear.visible = y < GY + 6;
      cam.position.set(46, 3.2, -150);
      look.set(0, y * 0.7 + 2, z + 8);
      cam.fov = 38;
    } else if (t < T2) {
      // Cruise: slow orbit over the cloud sea
      this.setPhase("cruise");
      const s = (t - T1) / (T2 - T1);
      jet.position.set(0, 0, 0);
      jet.rotation.z = Math.sin(t * 0.7) * 0.06;
      jet.rotation.x = Math.sin(t * 0.5) * 0.015;
      this.gear.visible = false;
      this.clouds.update(t);
      const a = -2.5 + smooth(s) * 1.9;
      const r = 46 - s * 8;
      cam.position.set(Math.sin(a) * r, 9 - s * 4, Math.cos(a) * r);
      look.set(0, 0, -4);
      cam.fov = 40;
    } else {
      // Final approach toward the new skyline, flare, touchdown, rollout
      this.setPhase("arrive");
      const u = t - T2;
      let z: number;
      let y: number;
      if (u < 4) {
        z = 300 - 75 * u;
        y = GY + 30 * (1 - u / 4) ** 1.6;
        jet.rotation.x = u > 3 ? 0.07 * (u - 3) : -0.04;
      } else {
        const k = u - 4;
        z = -75 * k + 12 * k * k;
        y = GY;
        jet.rotation.x = Math.max(0, 0.07 - k * 0.12);
        // Tire smoke at touchdown
        if (k < 1.4)
          this.smoke.forEach((p, i) => {
            p.visible = true;
            const age = k + i * 0.04;
            p.position.set(i < 3 ? -2.6 : 2.6, 0.5 + age * 0.8, 1.4 + (i % 3) * 3);
            p.scale.setScalar(0.8 + age * 3);
            (p.material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - k / 1.4);
          });
      }
      jet.position.set(0, y, z);
      this.gear.visible = true;
      if (u < 3.2) {
        cam.position.set(-7, y + 7, z + 36);
        look.set(0, y - 4, z - 120);
        cam.fov = 46;
      } else {
        cam.position.set(-30, 3, -36);
        look.set(0, 6, z - 10);
        cam.fov = 40;
      }
    }
    cam.updateProjectionMatrix();
    cam.lookAt(look);
    this.sun.position.set(jet.position.x - 60, jet.position.y + 120, jet.position.z - 40);
    this.sun.target.position.copy(jet.position);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}
