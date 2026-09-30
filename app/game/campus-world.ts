import * as THREE from "three";
import type { Box2, CityWorld } from "./city-world";
import { rand } from "./math";
import { skyTexture } from "./stage";

/**
 * Harbor Heights High: a walkable campus for the high-school chapter of
 * MyCareer. Main building, the Mariners gym, outdoor courts, the football
 * field and track, the student lot and a quad full of students.
 */

export const CAMPUS = {
  bound: 105,
  spawn: { x: -20, z: 26, yaw: Math.PI * 0.85 },
  school: { minX: -40, maxX: 40, minZ: -57, maxZ: -33 },
  gym: { minX: 41, maxX: 75, minZ: -22, maxZ: 10 },
  courts: { x: -55, z: -2 },
  field: { x: 0, z: 70 },
  lot: { minX: 36, maxX: 78, minZ: 30, maxZ: 60 },
  /** Interaction spots (door fronts) */
  doors: {
    classes: { x: 0, z: -28 },
    coach: { x: -30, z: -30 },
    gym: { x: 37, z: -8 },
    weights: { x: 37, z: 4 },
    courts: { x: -38, z: -2 },
    lot: { x: 44, z: 34 },
    bus: { x: -22, z: 34 },
  },
  colors: { primary: "#8ec3ee", navy: "#12203a", brick: "#8a4a38" },
};

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

/** Red brick with rows of white-framed school windows */
function schoolFacade(floors: number) {
  return canvasTex(512, 128 * floors, (g) => {
    g.fillStyle = "#8a4a38";
    g.fillRect(0, 0, 512, 128 * floors);
    for (let y = 0; y < 128 * floors; y += 8)
      for (let x = (y / 8) % 2 ? -8 : 0; x < 512; x += 20) {
        g.fillStyle = `rgb(${130 + Math.random() * 30},${62 + Math.random() * 16},${46 + Math.random() * 12})`;
        g.fillRect(x + 1, y + 1, 18, 6);
      }
    for (let f = 0; f < floors; f++) {
      // Limestone band between floors
      g.fillStyle = "#d8cfbf";
      g.fillRect(0, 128 * f + 118, 512, 10);
      for (let i = 0; i < 6; i++) {
        const x = 18 + i * 84;
        const y = 128 * f + 26;
        g.fillStyle = "#f1ede4";
        g.fillRect(x - 4, y - 4, 64, 80);
        g.fillStyle = "#223246";
        g.fillRect(x, y, 56, 72);
        g.fillStyle = "rgba(160,200,235,0.35)";
        g.fillRect(x + 2, y + 2, 24, 68);
        g.fillStyle = "#f1ede4";
        g.fillRect(x + 27, y, 3, 72);
        g.fillRect(x, y + 34, 56, 3);
      }
    }
  });
}

function signTex(lines: string[], bg: string, fg: string, w = 1024, h = 256) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.textAlign = "center";
    g.textBaseline = "middle";
    lines.forEach((l, i) => {
      let size = i === 0 ? h * 0.46 : h * 0.2;
      g.font = `900 ${size}px 'Bebas Neue', Impact, sans-serif`;
      const mw = g.measureText(l).width;
      if (mw > w * 0.94) {
        size = (size * w * 0.94) / mw;
        g.font = `900 ${size}px 'Bebas Neue', Impact, sans-serif`;
      }
      g.fillText(l, w / 2, i === 0 ? h * 0.4 : h * 0.78);
    });
  });
}

export function buildCampusWorld(
  scene: THREE.Scene,
  opts: { shadows: boolean },
): CityWorld & {
  ground(x: number, z: number): number;
  bound: number;
  greens: Box2[];
  name: string;
} {
  const colliders: Box2[] = [];
  const circles: { x: number; z: number; r: number }[] = [];
  const lots: (Box2 & { park?: boolean })[] = [];
  const greens: Box2[] = [];
  const disposables: { dispose(): void }[] = [];
  const updaters: ((t: number, dt: number) => void)[] = [];
  const std = (color: string, roughness = 0.85, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    disposables.push(m);
    return m;
  };
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, solid = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  };
  const plane = (w: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  /* ----- sky, light */
  scene.fog = new THREE.Fog("#cfe3f5", 110, 380);
  const sky = new THREE.Mesh(
    // Must stay inside the camera's far plane (600) from anywhere on campus
    new THREE.SphereGeometry(420, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture("#5c9ad6", "#e6f1fb"), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  scene.add(new THREE.HemisphereLight("#dbe9ff", "#5a6a3a", 0.95));
  const sun = new THREE.DirectionalLight("#fff1d6", 3.1);
  sun.castShadow = opts.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -60;
  sc.right = sc.top = 60;
  sc.far = 400;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  /* ----- ground: grass with concrete walks */
  const grassTex = canvasTex(
    256,
    256,
    (g) => {
      g.fillStyle = "#5a8f3e";
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "30,70,20" : "140,190,90"},${Math.random() * 0.18})`;
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 3);
      }
    },
    [60, 60],
  );
  const grass = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
  disposables.push(grass);
  plane(600, 600, grass, 0, 0, 0);
  const walk = std("#bdb8ae", 0.9);
  const asphalt = std("#3c3e44", 0.95);
  // Walkways: front walk, cross walk, to the gym, to the courts, to the lot and field
  plane(8, 60, walk, 0, 0.02, -2);
  plane(110, 6, walk, -8, 0.02, -18);
  plane(6, 40, walk, 34, 0.02, 12);
  plane(40, 6, walk, 20, 0.02, 32);
  plane(6, 20, walk, 0, 0.02, 37);
  // Circle drive + street in front
  plane(240, 12, asphalt, 0, 0.015, 94 + 20);

  /* ----- main school building */
  {
    const s = CAMPUS.school;
    const w = s.maxX - s.minX;
    const d = s.maxZ - s.minZ;
    const h = 14;
    const facade = schoolFacade(3);
    facade.wrapS = THREE.RepeatWrapping;
    facade.repeat.set(w / 20, 1);
    const fm = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.9 });
    disposables.push(fm);
    const body = box(w, h, d, fm, (s.minX + s.maxX) / 2, h / 2, (s.minZ + s.maxZ) / 2, true);
    void body;
    lots.push({ ...s });
    box(w + 1.2, 0.8, d + 1.2, std("#d8cfbf"), 0, h + 0.4, (s.minZ + s.maxZ) / 2);
    // Portico: columns, pediment, steps
    const stone = std("#e7e0d2", 0.7);
    for (const x of [-7.5, -2.5, 2.5, 7.5]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 8, 16), stone);
      col.position.set(x, 4.6, s.maxZ + 3.2);
      col.castShadow = true;
      scene.add(col);
      circles.push({ x, z: s.maxZ + 3.2, r: 0.6 });
    }
    box(19, 1.2, 5, stone, 0, 9.2, s.maxZ + 2.6);
    for (let i = 0; i < 3; i++) box(18 - i * 1.5, 0.22, 1.2, stone, 0, 0.11 + i * 0.22, s.maxZ + 5.8 - i * 1.1);
    // Name over the entrance
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 2.4),
      new THREE.MeshBasicMaterial({
        map: signTex(["HARBOR HEIGHTS HIGH SCHOOL", "EST. 1962 · HOME OF THE MARINERS"], "#12203a", "#f4efe6"),
        toneMapped: false,
      }),
    );
    sign.position.set(0, 11.6, s.maxZ + 0.06);
    scene.add(sign);
    // Clock tower
    box(8, 7, 8, fm, 0, h + 3.5, (s.minZ + s.maxZ) / 2 + 4);
    const clock = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 40),
      new THREE.MeshBasicMaterial({
        map: canvasTex(256, 256, (g) => {
          g.fillStyle = "#f6f1e4";
          g.beginPath();
          g.arc(128, 128, 120, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "#12203a";
          g.lineWidth = 10;
          g.stroke();
          g.lineCap = "round";
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            g.beginPath();
            g.moveTo(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
            g.lineTo(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108);
            g.stroke();
          }
          g.lineWidth = 8;
          g.beginPath();
          g.moveTo(128, 128);
          g.lineTo(128 + 50, 128 - 20);
          g.moveTo(128, 128);
          g.lineTo(128 - 10, 128 - 80);
          g.stroke();
        }),
      }),
    );
    clock.position.set(0, h + 4, (s.minZ + s.maxZ) / 2 + 8.05);
    scene.add(clock);
    box(9, 0.6, 9, std("#3a4658"), 0, h + 7.3, (s.minZ + s.maxZ) / 2 + 4);
    // Side door (coach's office) with a small awning
    box(3, 3.4, 0.2, std("#12203a"), CAMPUS.doors.coach.x, 1.7, s.maxZ + 0.1);
    box(4, 0.2, 1.6, std("#8ec3ee"), CAMPUS.doors.coach.x, 3.7, s.maxZ + 0.8);
    // Flagpole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 14, 10), std("#c9ccd2", 0.3, 0.8));
    pole.position.set(-14, 7, -18);
    scene.add(pole);
    circles.push({ x: -14, z: -18, r: 0.3 });
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 2, 12, 1),
      new THREE.MeshStandardMaterial({
        map: canvasTex(128, 76, (g) => {
          g.fillStyle = "#12203a";
          g.fillRect(0, 0, 128, 76);
          g.fillStyle = "#8ec3ee";
          g.font = "900 44px Impact, sans-serif";
          g.textAlign = "center";
          g.fillText("HH", 64, 54);
        }),
        side: THREE.DoubleSide,
      }),
    );
    flag.position.set(-12.2, 12.8, -18);
    scene.add(flag);
    const fpos = flag.geometry.attributes.position as THREE.BufferAttribute;
    const base = Float32Array.from(fpos.array as Float32Array);
    updaters.push((t) => {
      for (let i = 0; i < fpos.count; i++) {
        const x = base[i * 3];
        fpos.setZ(i, Math.sin(t * 4 + x * 2) * 0.18 * (x + 1.7) * 0.5);
      }
      fpos.needsUpdate = true;
    });
  }

  /* ----- gym */
  {
    const gy = CAMPUS.gym;
    const w = gy.maxX - gy.minX;
    const d = gy.maxZ - gy.minZ;
    const cx = (gy.minX + gy.maxX) / 2;
    const cz = (gy.minZ + gy.maxZ) / 2;
    const wall = std("#d9d2c4", 0.85);
    box(w, 11, d, wall, cx, 5.5, cz, true);
    lots.push({ ...gy });
    // Barrel roof: a half cylinder running east-west, flattened
    const roofM = new THREE.MeshStandardMaterial({
      color: "#8ec3ee",
      roughness: 0.5,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });
    disposables.push(roofM);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, w, 32, 1, true, 0, Math.PI), roofM);
    roof.scale.set(0.28, 1, 1); // local x becomes height after the turn below
    roof.rotation.z = Math.PI / 2;
    roof.position.set(cx, 11, cz);
    roof.castShadow = true;
    scene.add(roof);
    // Navy band + mural sign on the quad side (west face)
    box(0.2, 1.4, d, std("#12203a"), gy.minX - 0.05, 9.6, cz);
    const mural = new THREE.Mesh(
      new THREE.PlaneGeometry(d * 0.8, 4.2),
      new THREE.MeshBasicMaterial({
        map: signTex(["MARINERS", "HARBOR HEIGHTS GYMNASIUM"], "#12203a", "#8ec3ee"),
        toneMapped: false,
      }),
    );
    mural.rotation.y = -Math.PI / 2;
    mural.position.set(gy.minX - 0.12, 6.4, cz);
    scene.add(mural);
    // Doors: main gym + weight room
    for (const [z, label] of [
      [CAMPUS.doors.gym.z, "GYM"],
      [CAMPUS.doors.weights.z, "WEIGHT ROOM"],
    ] as const) {
      box(0.2, 3.4, 4, std("#12203a"), gy.minX - 0.1, 1.7, z);
      const s = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 0.8),
        new THREE.MeshBasicMaterial({ map: signTex([label], "#8ec3ee", "#12203a", 512, 128), toneMapped: false }),
      );
      s.rotation.y = -Math.PI / 2;
      s.position.set(gy.minX - 0.15, 3.9, z);
      scene.add(s);
    }
  }

  /* ----- outdoor courts (two, fenced) */
  {
    const { x, z } = CAMPUS.courts;
    const courtTex = canvasTex(512, 960, (g) => {
      g.fillStyle = "#2f5f8a";
      g.fillRect(0, 0, 512, 960);
      g.fillStyle = "#c2452d";
      g.fillRect(186, 0, 140, 190);
      g.fillRect(186, 770, 140, 190);
      g.strokeStyle = "#f4efe6";
      g.lineWidth = 6;
      g.strokeRect(6, 6, 500, 948);
      g.beginPath();
      g.moveTo(6, 480);
      g.lineTo(506, 480);
      g.stroke();
      for (const y of [480]) {
        g.beginPath();
        g.arc(256, y, 60, 0, Math.PI * 2);
        g.stroke();
      }
      g.beginPath();
      g.arc(256, 40, 220, 0, Math.PI);
      g.stroke();
      g.beginPath();
      g.arc(256, 920, 220, Math.PI, Math.PI * 2);
      g.stroke();
    });
    const cm = new THREE.MeshStandardMaterial({ map: courtTex, roughness: 0.8 });
    disposables.push(cm);
    for (const dx of [-8.5, 8.5]) {
      plane(15, 28, cm, x + dx, 0.03, z);
      for (const end of [-1, 1]) {
        const hz = z + end * 13;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 8), std("#2a2c31", 0.4, 0.7));
        post.position.set(x + dx, 1.7, hz + end * 0.8);
        scene.add(post);
        circles.push({ x: x + dx, z: hz + end * 0.8, r: 0.2 });
        box(1.8, 1.1, 0.06, std("#f4f4f4", 0.3), x + dx, 3.3, hz);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 6, 20), std("#e8541e", 0.4));
        rim.rotation.x = Math.PI / 2;
        rim.position.set(x + dx, 3.05, hz - end * 0.3);
        scene.add(rim);
      }
    }
    // Chain-link fence (low collider walls, open on the quad side)
    const fence = new THREE.MeshStandardMaterial({
      map: canvasTex(
        64,
        64,
        (g) => {
          g.strokeStyle = "#b8bcc4";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(64, 64);
          g.moveTo(64, 0);
          g.lineTo(0, 64);
          g.stroke();
        },
        [20, 2],
      ),
      transparent: true,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
    });
    disposables.push(fence);
    const fw = 36;
    const fd = 32;
    for (const [w, d, fx, fz] of [
      [fw, 0.1, x, z - fd / 2],
      [fw, 0.1, x, z + fd / 2],
      [0.1, fd, x - fw / 2, z],
    ] as const) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), fence);
      f.position.set(fx, 1.6, fz);
      scene.add(f);
      colliders.push({
        minX: fx - w / 2 - 0.05,
        maxX: fx + w / 2 + 0.05,
        minZ: fz - d / 2 - 0.05,
        maxZ: fz + d / 2 + 0.05,
      });
    }
  }

  /* ----- football field + track + bleachers */
  {
    const { x, z } = CAMPUS.field;
    const track = new THREE.Mesh(new THREE.RingGeometry(26, 33, 64), std("#b0402c", 0.9));
    track.rotation.x = -Math.PI / 2;
    track.scale.set(1.55, 1, 1);
    track.position.set(x, 0.025, z);
    scene.add(track);
    const fieldTex = canvasTex(1024, 512, (g) => {
      for (let i = 0; i < 12; i++) {
        g.fillStyle = i % 2 ? "#3f8a36" : "#469640";
        g.fillRect((i * 1024) / 12, 0, 1024 / 12, 512);
      }
      g.strokeStyle = "#ffffff";
      g.lineWidth = 5;
      g.strokeRect(20, 20, 984, 472);
      for (let i = 1; i < 12; i++) {
        g.beginPath();
        g.moveTo((i * 1024) / 12, 20);
        g.lineTo((i * 1024) / 12, 492);
        g.stroke();
      }
      g.fillStyle = "#12203a";
      g.fillRect(0, 20, 60, 472);
      g.fillRect(964, 20, 60, 472);
      g.fillStyle = "#8ec3ee";
      g.font = "900 70px Impact, sans-serif";
      g.textAlign = "center";
      g.fillText("MARINERS", 512, 280);
    });
    const fm = new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 1 });
    disposables.push(fm);
    plane(76, 38, fm, x, 0.03, z);
    greens.push({ minX: x - 38, maxX: x + 38, minZ: z - 19, maxZ: z + 19 });
    for (const end of [-1, 1]) {
      const gp = std("#f2d24a", 0.4, 0.4);
      const px = x + end * 38;
      box(0.2, 3, 0.2, gp, px, 1.5, z);
      box(0.2, 0.2, 6, gp, px, 3, z);
      box(0.2, 4, 0.2, gp, px, 5, z - 3);
      box(0.2, 4, 0.2, gp, px, 5, z + 3);
    }
    // Home bleachers on the north side
    const seat = std("#b9bec6", 0.5, 0.5);
    for (let r = 0; r < 6; r++) box(56, 0.4, 1.2, seat, x, 0.5 + r * 0.55, z - 37 - r * 1.1, true);
    box(10, 3.5, 0.4, std("#12203a"), x, 6.5, z + 38);
    const sb = new THREE.Mesh(
      new THREE.PlaneGeometry(9.6, 3.1),
      new THREE.MeshBasicMaterial({
        map: signTex(["HOME 21  ·  GUEST 14", "MARINERS"], "#0b0f18", "#ffb347", 512, 170),
        toneMapped: false,
      }),
    );
    sb.position.set(x, 6.5, z + 37.78);
    sb.rotation.y = Math.PI;
    scene.add(sb);
    box(0.4, 5, 0.4, std("#2a2c31"), x, 2.5, z + 38.2);
  }

  /* ----- student parking lot */
  {
    const l = CAMPUS.lot;
    const w = l.maxX - l.minX;
    const d = l.maxZ - l.minZ;
    plane(w, d, asphalt, (l.minX + l.maxX) / 2, 0.02, (l.minZ + l.maxZ) / 2);
    const white = new THREE.MeshBasicMaterial({ color: "#e9e6de" });
    disposables.push(white);
    for (let i = 0; i < 12; i++) plane(0.15, 5, white, l.minX + 3 + i * 3.4, 0.03, l.minZ + 4);
    for (let i = 0; i < 12; i++) plane(0.15, 5, white, l.minX + 3 + i * 3.4, 0.03, l.maxZ - 4);
    const carColors = ["#e8742a", "#c21d2a", "#1d2f5a", "#e9e6de", "#2a2c31", "#3f7a4a", "#8ec3ee", "#b9bec6"];
    carColors.forEach((c, i) => {
      const cx = l.minX + 4.7 + i * 4.8;
      const cz = i % 2 ? l.maxZ - 4 : l.minZ + 4;
      const g = new THREE.Group();
      const bodyM = std(c, 0.35, 0.5);
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 4.2), bodyM);
      b.position.y = 0.7;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.2), std("#1a2330", 0.1, 0.6));
      cab.position.set(0, 1.4, -0.2);
      g.add(b, cab);
      for (const [wx, wz] of [
        [-0.9, 1.3],
        [0.9, 1.3],
        [-0.9, -1.3],
        [0.9, -1.3],
      ]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), std("#111", 0.8));
        wh.rotation.z = Math.PI / 2;
        wh.position.set(wx, 0.38, wz);
        g.add(wh);
      }
      g.position.set(cx, 0, cz);
      g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      scene.add(g);
      colliders.push({ minX: cx - 1, maxX: cx + 1, minZ: cz - 2.2, maxZ: cz + 2.2 });
    });
  }

  /* ----- bus stop */
  {
    const { x, z } = CAMPUS.doors.bus;
    box(5, 0.15, 2, std("#8ec3ee", 0.4), x, 3, z + 1.5);
    box(0.12, 3, 0.12, std("#2a2c31"), x - 2.4, 1.5, z + 2.4, true);
    box(0.12, 3, 0.12, std("#2a2c31"), x + 2.4, 1.5, z + 2.4, true);
    box(4.6, 0.5, 0.6, std("#6b4e36"), x, 0.5, z + 2.2);
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.2),
      new THREE.MeshBasicMaterial({ map: signTex(["BUS"], "#12203a", "#ffd24a", 128, 128), toneMapped: false }),
    );
    s.position.set(x + 3.4, 2.6, z + 1);
    scene.add(s);
    box(0.08, 2.6, 0.08, std("#2a2c31"), x + 3.4, 1.3, z + 1);
  }

  /* ----- quad: mascot statue, benches, trees */
  {
    const stone = std("#c9c2b4", 0.8);
    box(3, 1.2, 3, stone, 0, 0.6, 8, true);
    const bronze = std("#6d8fa8", 0.35, 0.8);
    const anchor = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3, 10), bronze);
    shaft.position.y = 1.5;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.8, 10), bronze);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 2.6;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 20), bronze);
    ring.position.y = 3.2;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(1, 0.13, 8, 24, Math.PI), bronze);
    hook.rotation.z = Math.PI;
    hook.position.y = 0.9;
    anchor.add(shaft, bar, ring, hook);
    anchor.position.set(0, 1.2, 8);
    anchor.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    scene.add(anchor);
    const wood = std("#6b4e36");
    for (const [bx, bz] of [
      [-8, 2],
      [8, 2],
      [-8, 14],
      [8, 14],
    ])
      box(2.6, 0.5, 0.7, wood, bx, 0.5, bz, true);
    const trunk = std("#5a4030", 0.9);
    const leaves = [std("#3e7a36", 0.9), std("#5c9443", 0.9)];
    const tree = (tx: number, tz: number) => {
      const s = rand(0.85, 1.25);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 3 * s, 8), trunk);
      t.position.set(tx, 1.5 * s, tz);
      t.castShadow = true;
      scene.add(t);
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 * s, 1), leaves[Math.floor(Math.random() * 2)]);
      (l.material as THREE.MeshStandardMaterial).flatShading = true;
      l.position.set(tx, 4.2 * s, tz);
      l.castShadow = true;
      scene.add(l);
      circles.push({ x: tx, z: tz, r: 0.4 });
    };
    for (let i = 0; i < 6; i++) {
      tree(-14, -8 + i * 6.5);
      tree(14, -8 + i * 6.5);
    }
    for (let i = 0; i < 10; i++) tree(-90 + i * 20, 96);
    for (let i = 0; i < 8; i++) tree(-95, -60 + i * 16);
    for (let i = 0; i < 8; i++) tree(95, -60 + i * 16);
    greens.push({ minX: -18, maxX: 18, minZ: -12, maxZ: 26 });
  }

  // Walking loops for students
  const sidewalkLoops: Box2[] = [
    { minX: -11, maxX: 11, minZ: -16, maxZ: 22 },
    { minX: -40, maxX: 30, minZ: -20, maxZ: -16 },
    { minX: -30, maxX: 34, minZ: 28, maxZ: 36 },
    { minX: 30, maxX: 36, minZ: -14, maxZ: 30 },
  ];

  return {
    colliders,
    circles,
    lots,
    sidewalkLoops,
    sun,
    greens,
    bound: CAMPUS.bound,
    name: "Harbor Heights High",
    ground: () => 0,
    update(t, dt, player) {
      for (const u of updaters) u(t, dt);
      sky.position.set(player.x, 0, player.z);
      sun.position.set(player.x - 70, 110, player.z + 50);
      sun.target.position.set(player.x, 0, player.z);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
