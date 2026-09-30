import * as THREE from "three";
import type { Baller } from "~/data/characters";
import { assetSources } from "~/data/higgsfield-assets";
import { idle } from "./animator";
import { makeBallMesh } from "./ball-mesh";
import { buildProceduralBody, loadHiggsfieldBody, type Body } from "./body";
import { createPose } from "./rig";
import { createRenderer, environmentFor, fitToParent } from "./stage";
import { damp } from "./math";

interface Slot {
  baller: Baller;
  body: Body;
  ball: THREE.Mesh;
  x: number;
  pose: ReturnType<typeof createPose>;
  ballPos: THREE.Vector3;
}

/**
 * Character lineup / select stage: every baller idling under spotlights.
 * The focused baller steps forward and the camera eases toward them.
 */
export class Showcase {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private slots: Slot[] = [];
  private focus = -1;
  private raf = 0;
  private clock = new THREE.Clock();
  private camX = 0;
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    ballers: Baller[],
    private opts: { useHiggsfield: boolean; spacing?: number } = { useHiggsfield: true },
  ) {
    this.renderer = createRenderer(canvas, { shadows: true, pixelRatio: 2 });
    this.scene.environment = environmentFor(this.renderer);
    this.scene.environmentIntensity = 0.35;
    this.scene.background = new THREE.Color("#07090f");
    this.scene.fog = new THREE.Fog("#07090f", 9, 22);

    const floorTex = this.floorTexture();
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.scene.add(new THREE.HemisphereLight("#8fa8ff", "#140c08", 0.6));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(3, 7, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#3ad7ff", 2.4);
    rim.position.set(-4, 4, -6);
    this.scene.add(rim);
    const rim2 = new THREE.DirectionalLight("#ff8a3a", 1.4);
    rim2.position.set(5, 3, -5);
    this.scene.add(rim2);

    const spacing = opts.spacing ?? 1.35;
    ballers.forEach((b, i) => {
      const x = (i - (ballers.length - 1) / 2) * spacing;
      const body = buildProceduralBody(b);
      body.root.position.set(x, 0, 0);
      this.scene.add(body.root);
      const ball = makeBallMesh();
      this.scene.add(ball);
      this.slots.push({ baller: b, body, ball, x, pose: createPose(), ballPos: new THREE.Vector3() });
      if (opts.useHiggsfield && b.model) this.tryHiggsfield(i, b);
    });
    this.camX = 0;
    this.loop();
  }

  private async tryHiggsfield(i: number, b: Baller) {
    const body = await loadHiggsfieldBody(b, assetSources(b.model!));
    if (!body || this.disposed) return;
    const slot = this.slots[i];
    this.scene.remove(slot.body.root);
    slot.body.dispose();
    body.root.position.copy(slot.body.root.position);
    slot.body = body;
    this.scene.add(body.root);
  }

  private floorTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(512, 512, 40, 512, 512, 512);
    grd.addColorStop(0, "#2a2f3c");
    grd.addColorStop(1, "#0a0c12");
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 16000; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
      g.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }
    g.strokeStyle = "rgba(58,215,255,0.55)";
    g.lineWidth = 6;
    g.beginPath();
    g.arc(512, 512, 150, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(0, 512);
    g.lineTo(1024, 512);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  setFocus(id: string | null) {
    this.focus = id ? this.slots.findIndex((s) => s.baller.id === id) : -1;
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    fitToParent(this.renderer, this.camera);

    this.slots.forEach((s, i) => {
      const focused = i === this.focus;
      const z = damp(s.body.root.position.z, focused ? 0.9 : 0, 6, dt);
      s.body.root.position.set(s.x, 0, z);
      s.body.root.rotation.y = Math.sin(t * 0.4 + i) * 0.12;
      s.body.root.updateMatrixWorld(true);
      idle(s.body.poser.proportions, t + i * 0.7, s.pose, s.ballPos);
      s.body.poser.apply(s.pose);
      s.ball.position.copy(s.body.root.localToWorld(s.ballPos.clone()));
    });

    const fx = this.focus >= 0 ? this.slots[this.focus].x * 0.6 : 0;
    this.camX = damp(this.camX, fx, 3, dt);
    const wide = this.focus < 0;
    const dist = this.slots.length === 1 ? 4.6 : wide ? 7.8 + this.slots.length * 0.55 : 7.2;
    this.camera.position.set(this.camX, wide ? 1.7 : 1.45, dist);
    this.camera.lookAt(this.camX, wide ? 1.0 : 1.05, 0);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const s of this.slots) s.body.dispose();
    this.renderer.dispose();
  }
}
