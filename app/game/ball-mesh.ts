import * as THREE from "three";
import { BALL_RADIUS } from "./constants";

let ballTex: THREE.CanvasTexture | null = null;

function texture() {
  if (ballTex) return ballTex;
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d8642a";
  g.fillRect(0, 0, w, h);
  // Pebbled leather
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    g.fillStyle = Math.random() < 0.5 ? "rgba(120,40,10,0.18)" : "rgba(255,170,110,0.12)";
    g.fillRect(x, y, 1.5, 1.5);
  }
  g.strokeStyle = "#1b0f0a";
  g.lineWidth = 5;
  // Meridian seams
  for (const x of [0, w / 4, w / 2, (3 * w) / 4]) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  // Equator
  g.beginPath();
  g.moveTo(0, h / 2);
  g.lineTo(w, h / 2);
  g.stroke();
  // Curved seams
  for (const off of [0, w / 2]) {
    g.beginPath();
    for (let x = 0; x <= w / 2; x += 4) {
      const y = h / 2 + Math.sin((x / (w / 2)) * Math.PI) * h * 0.32 * (off ? -1 : 1);
      if (x === 0) g.moveTo(x + off, y);
      else g.lineTo(x + off, y);
    }
    g.stroke();
  }
  ballTex = new THREE.CanvasTexture(c);
  ballTex.colorSpace = THREE.SRGBColorSpace;
  ballTex.anisotropy = 4;
  return ballTex;
}

export function makeBallMesh() {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 20),
    new THREE.MeshStandardMaterial({ map: texture(), roughness: 0.75, metalness: 0 }),
  );
  m.castShadow = true;
  m.name = "ball";
  return m;
}
