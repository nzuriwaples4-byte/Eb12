import * as THREE from "three";
import type { Action } from "./player";
import type { Match } from "./match";
import type { Intent, MatchResult } from "./types";

/**
 * Online play: a host-authoritative link over the relay server.
 * The host simulates the match; the guest streams its inputs and renders
 * the host's snapshots.
 */

export interface NetPlayer {
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  y: number;
  a: SerialAction | null;
  b: boolean;
  h: "L" | "R";
  hy: number;
  tu: number;
  g: number;
}

type SerialAction = Omit<Action, "from" | "to"> & { from?: number[]; to?: number[] };

export interface Snapshot {
  p: [NetPlayer, NetPlayer];
  ball: { pos: number[]; vel: number[]; state: "held" | "air" | "dead"; holder: number; shot: boolean };
  phase: Match["phase"];
  phaseT: number;
  time: number;
  score: [number, number];
  poss: 0 | 1;
  clear: boolean;
  clock: number;
}

export type NetEvent =
  | { k: "callout"; text: string; sub?: string; color: string; size: "sm" | "md" | "lg" }
  | { k: "sfx"; name: string; s?: number }
  | { k: "shake"; a: number }
  | { k: "flash"; a: number }
  | { k: "slowmo"; s: number; sec: number }
  | { k: "specialStart"; id: number }
  | { k: "specialEnd" }
  | { k: "rim"; a: number };

export type NetMsg =
  | { t: "room"; code: string }
  | { t: "peer" }
  | { t: "left" }
  | { t: "error"; msg: string }
  | { t: "hello"; baller: string; name: string }
  | { t: "start"; venueId: string; target: number; host: string; guest: string }
  | { t: "in"; i: Intent }
  | { t: "snap"; s: Snapshot }
  | { t: "ev"; e: NetEvent }
  | { t: "over"; r: MatchResult };

export function relayUrl() {
  const env = import.meta.env.VITE_RELAY_URL as string | undefined;
  if (env) return env;
  if (typeof location === "undefined") return "ws://localhost:8787";
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8787`;
}

export class NetLink {
  code = "";
  private handlers = new Set<(m: NetMsg) => void>();
  /** Messages that arrived while nobody was listening (e.g. between join and the lobby mounting) */
  private backlog: NetMsg[] = [];
  private constructor(
    private ws: WebSocket,
    public role: "host" | "guest",
  ) {
    ws.onmessage = (e) => {
      let m: NetMsg;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m.t === "room") this.code = m.code;
      this.dispatch(m);
    };
    ws.onclose = () => this.dispatch({ t: "left" });
  }

  /** Open a room and wait for the relay to hand back its code */
  static host(url = relayUrl()) {
    return NetLink.open(`${url}/?create=1`, "host");
  }

  static join(code: string, url = relayUrl()) {
    return NetLink.open(`${url}/?join=${encodeURIComponent(code.trim().toUpperCase())}`, "guest");
  }

  private static open(url: string, role: "host" | "guest") {
    return new Promise<NetLink>((resolve, reject) => {
      const ws = new WebSocket(url);
      const link = new NetLink(ws, role);
      const off = link.on((m) => {
        if (m.t === "room") {
          off();
          resolve(link);
        } else if (m.t === "error" || m.t === "left") {
          off();
          reject(new Error(m.t === "error" ? m.msg : "Couldn't reach the online server"));
        }
      });
      ws.onerror = () => reject(new Error("Couldn't reach the online server"));
    });
  }

  private dispatch(m: NetMsg) {
    if (this.handlers.size === 0) this.backlog.push(m);
    for (const h of [...this.handlers]) h(m);
  }

  on(fn: (m: NetMsg) => void) {
    this.handlers.add(fn);
    if (this.backlog.length) {
      const queued = this.backlog.splice(0);
      queueMicrotask(() => queued.forEach((m) => this.handlers.has(fn) && fn(m)));
    }
    return () => void this.handlers.delete(fn);
  }

  send(m: NetMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  close() {
    this.handlers.clear();
    this.ws.close();
  }
}

/* -------------------------------------------------------- snapshots */

const v3 = (v: THREE.Vector3) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];

function serialAction(a: Action | null): SerialAction | null {
  if (!a) return null;
  const { from, to, ...rest } = a;
  return { ...rest, from: from ? v3(from) : undefined, to: to ? v3(to) : undefined };
}

function deserialAction(a: SerialAction | null): Action | null {
  if (!a) return null;
  const { from, to, ...rest } = a;
  return {
    ...rest,
    from: from ? new THREE.Vector3().fromArray(from) : undefined,
    to: to ? new THREE.Vector3().fromArray(to) : undefined,
  };
}

export function takeSnapshot(m: Match): Snapshot {
  return {
    p: m.players.map((p) => ({
      x: +p.pos.x.toFixed(3),
      z: +p.pos.z.toFixed(3),
      vx: +p.vel.x.toFixed(3),
      vz: +p.vel.z.toFixed(3),
      yaw: +p.yaw.toFixed(3),
      y: +p.y.toFixed(3),
      a: serialAction(p.action),
      b: p.hasBall,
      h: p.dribbleHand,
      hy: Math.round(p.hype),
      tu: +p.turbo.toFixed(2),
      g: +p.glow.toFixed(2),
    })) as [NetPlayer, NetPlayer],
    ball: { pos: v3(m.ball.pos), vel: v3(m.ball.vel), state: m.ball.state, holder: m.ball.holder, shot: !!m.ball.shot },
    phase: m.phase,
    phaseT: m.phaseT,
    time: m.time,
    score: [...m.score] as [number, number],
    poss: m.possession,
    clear: m.needClear,
    clock: m.shotClock,
  };
}

/** Where the host says each guest-side player is (advanced by dead reckoning) */
const targets = new WeakMap<object, THREE.Vector3>();

/** Guest: pull the local match to the host's state */
export function applySnapshot(m: Match, s: Snapshot) {
  s.p.forEach((n, i) => {
    const p = m.players[i];
    const tgt = targets.get(p) ?? new THREE.Vector3();
    tgt.set(n.x, 0, n.z);
    targets.set(p, tgt);
    // Big corrections (checks, teleports) snap; small ones ease in per frame
    if (Math.hypot(p.pos.x - n.x, p.pos.z - n.z) > 1.2) p.pos.copy(tgt);
    p.vel.set(n.vx, 0, n.vz);
    p.yaw = n.yaw;
    p.y = n.y;
    p.action = deserialAction(n.a);
    p.hasBall = n.b;
    p.dribbleHand = n.h;
    p.hype = n.hy;
    p.turbo = n.tu;
    p.glow = n.g;
  });
  m.ball.pos.fromArray(s.ball.pos);
  m.ball.vel.fromArray(s.ball.vel);
  m.ball.state = s.ball.state;
  m.ball.holder = s.ball.holder;
  // The guest only needs to know a shot is in flight (for visibility)
  m.ball.shot = s.ball.shot
    ? (m.ball.shot ?? { shooter: 0, points: 2, make: false, t: 0, kind: "jumper", counted: true })
    : null;
  m.phase = s.phase;
  m.phaseT = s.phaseT;
  m.time = s.time;
  m.score = s.score;
  m.possession = s.poss;
  m.needClear = s.clear;
  m.shotClock = s.clock;
}

/** Guest: every frame, dead-reckon the host's state forward and ease toward it */
export function extrapolate(m: Match, dt: number, fresh: boolean) {
  const k = Math.min(1, dt * 14);
  for (const p of m.players) {
    const tgt = targets.get(p);
    if (!tgt) continue;
    if (!fresh) {
      tgt.x += p.vel.x * dt;
      tgt.z += p.vel.z * dt;
      if (p.action) p.action.t += dt;
    }
    p.pos.x += (tgt.x - p.pos.x) * k;
    p.pos.z += (tgt.z - p.pos.z) * k;
  }
  if (!fresh) {
    if (m.ball.state === "air") m.ball.pos.addScaledVector(m.ball.vel, dt);
    m.phaseT += dt;
    m.time += dt;
  }
}

/** Host: merge the guest's input stream so one-frame presses are never lost */
export class RemoteIntent {
  private cur: Intent = {
    moveX: 0,
    moveZ: 0,
    turbo: false,
    shootPress: false,
    shootHeld: false,
    shootRelease: false,
    juke: false,
    trick: false,
    lob: false,
    special: false,
  };

  push(i: Intent) {
    const c = this.cur;
    c.moveX = i.moveX;
    c.moveZ = i.moveZ;
    c.turbo = i.turbo;
    c.shootHeld = i.shootHeld;
    c.shootPress ||= i.shootPress;
    c.shootRelease ||= i.shootRelease;
    c.juke ||= i.juke;
    c.trick ||= i.trick;
    c.lob ||= i.lob;
    c.special ||= i.special;
  }

  /** Read for this frame and clear the one-shot presses */
  take(): Intent {
    const out = { ...this.cur };
    const c = this.cur;
    c.shootPress = c.shootRelease = c.juke = c.trick = c.lob = c.special = false;
    return out;
  }
}
