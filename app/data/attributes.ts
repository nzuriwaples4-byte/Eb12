import type { Ratings } from "./characters";
import type { Archetype } from "./career";

/**
 * 2K-style attributes for your created player. Each has a current value and
 * a max cap set by archetype + height. Upgrades cost Skill Points (SP),
 * earned from games and practice. Attributes roll up into the engine's
 * eight ratings.
 */

export type AttrGroup = "finishing" | "shooting" | "playmaking" | "defense" | "rebounding" | "physicals";

export const GROUPS: Record<AttrGroup, { label: string; color: string; glow: string }> = {
  finishing: { label: "Finishing", color: "#1f6fff", glow: "#6fa8ff" },
  shooting: { label: "Shooting", color: "#18b848", glow: "#6dff9a" },
  playmaking: { label: "Playmaking", color: "#ff7a1a", glow: "#ffb46a" },
  defense: { label: "Defense", color: "#e0242a", glow: "#ff7070" },
  rebounding: { label: "Rebounding", color: "#7a3fe0", glow: "#b88cff" },
  physicals: { label: "Physicals", color: "#f0a07a", glow: "#ffd2b8" },
};

export const ATTRS = [
  { id: "close", label: "Close Shot", group: "finishing" },
  { id: "layup", label: "Driving Layup", group: "finishing" },
  { id: "drivingDunk", label: "Driving Dunk", group: "finishing" },
  { id: "standingDunk", label: "Standing Dunk", group: "finishing" },
  { id: "post", label: "Post Control", group: "finishing" },
  { id: "mid", label: "Mid-Range Shot", group: "shooting" },
  { id: "three", label: "Three-Point Shot", group: "shooting" },
  { id: "ft", label: "Free Throw", group: "shooting" },
  { id: "pass", label: "Pass Accuracy", group: "playmaking" },
  { id: "handle", label: "Ball Handle", group: "playmaking" },
  { id: "swb", label: "Speed With Ball", group: "playmaking" },
  { id: "interior", label: "Interior Defense", group: "defense" },
  { id: "perimeter", label: "Perimeter Defense", group: "defense" },
  { id: "steal", label: "Steal", group: "defense" },
  { id: "block", label: "Block", group: "defense" },
  { id: "oreb", label: "Offensive Rebound", group: "rebounding" },
  { id: "dreb", label: "Defensive Rebound", group: "rebounding" },
  { id: "speed", label: "Speed", group: "physicals" },
  { id: "agility", label: "Agility", group: "physicals" },
  { id: "strength", label: "Strength", group: "physicals" },
  { id: "vertical", label: "Vertical", group: "physicals" },
] as const satisfies readonly { id: string; label: string; group: AttrGroup }[];

export type AttrId = (typeof ATTRS)[number]["id"];
export type Attrs = Record<AttrId, number>;

type Profile = Partial<Record<AttrId, number>>;

/** Archetype strengths: +/- applied to a base cap of 80 */
const ARCH: Record<Archetype, Profile> = {
  slasher: {
    layup: 15,
    drivingDunk: 17,
    swb: 10,
    speed: 12,
    agility: 12,
    vertical: 14,
    three: -12,
    post: -10,
    block: -12,
    interior: -10,
  },
  sniper: {
    mid: 15,
    three: 19,
    ft: 15,
    handle: 6,
    drivingDunk: -15,
    standingDunk: -20,
    block: -15,
    strength: -10,
    post: -8,
  },
  "floor-general": {
    pass: 19,
    handle: 17,
    swb: 14,
    perimeter: 12,
    steal: 12,
    three: 4,
    standingDunk: -20,
    block: -15,
    strength: -8,
  },
  lockdown: {
    perimeter: 19,
    steal: 17,
    interior: 10,
    block: 8,
    agility: 10,
    speed: 6,
    dreb: 6,
    three: -6,
    handle: -6,
    pass: -6,
  },
  big: {
    standingDunk: 19,
    post: 15,
    block: 19,
    interior: 17,
    oreb: 15,
    dreb: 17,
    strength: 14,
    three: -18,
    handle: -18,
    swb: -18,
    speed: -12,
    agility: -12,
  },
};

/** Height shifts caps: taller → better inside, worse handles/speed */
function heightShift(id: AttrId, heightIn: number) {
  const t = (heightIn - 78) / 8; // 6'6" = 0, 7'2" ≈ +1, 5'10" = -1
  const inside: AttrId[] = ["standingDunk", "block", "interior", "oreb", "dreb", "post", "strength"];
  const quick: AttrId[] = ["handle", "swb", "speed", "agility", "steal", "perimeter"];
  if (inside.includes(id)) return Math.round(t * 8);
  if (quick.includes(id)) return Math.round(-t * 8);
  return 0;
}

export function caps(arch: Archetype, heightIn: number): Attrs {
  const out = {} as Attrs;
  for (const a of ATTRS) {
    const v = 80 + (ARCH[arch][a.id] ?? 0) + heightShift(a.id, heightIn);
    out[a.id] = Math.max(40, Math.min(99, v));
  }
  return out;
}

/** Starting values: a high-school freshman ~ 55-65% of each cap */
export function startAttrs(arch: Archetype, heightIn: number): Attrs {
  const c = caps(arch, heightIn);
  const out = {} as Attrs;
  for (const a of ATTRS) out[a.id] = Math.max(25, Math.round(c[a.id] * 0.62));
  return out;
}

/** SP cost to raise an attribute from v to v+1 */
export function upgradeCost(v: number) {
  if (v < 60) return 1;
  if (v < 70) return 2;
  if (v < 80) return 3;
  if (v < 90) return 5;
  return 8;
}

const avg = (...xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

/** Roll the 20 attributes up into the engine's 8 ratings */
export function toRatings(a: Attrs): Ratings {
  return {
    speed: avg(a.speed, a.agility, a.swb),
    shooting: avg(a.mid, a.ft),
    three: a.three,
    finishing: avg(a.close, a.layup, a.post, a.strength),
    dunk: avg(a.drivingDunk, a.standingDunk, a.vertical),
    handles: avg(a.handle, a.swb, a.pass),
    defense: avg(a.perimeter, a.steal, a.interior),
    block: avg(a.block, a.interior, a.vertical, a.dreb),
  };
}

/** 2K-style overall (weighted, 40-99) */
export function overallOf(a: Attrs, arch: Archetype): number {
  const weights: Record<Archetype, Partial<Record<AttrGroup, number>>> = {
    slasher: { finishing: 3, physicals: 2, playmaking: 1.5, shooting: 1, defense: 1, rebounding: 0.5 },
    sniper: { shooting: 3, playmaking: 1.5, physicals: 1, defense: 1, finishing: 1, rebounding: 0.5 },
    "floor-general": { playmaking: 3, shooting: 1.5, defense: 1.5, physicals: 1.5, finishing: 1, rebounding: 0.5 },
    big: { finishing: 2, defense: 2.5, rebounding: 2, physicals: 1.5, shooting: 0.8, playmaking: 0.5 },
    lockdown: { defense: 3, physicals: 2, rebounding: 1, shooting: 1, playmaking: 1, finishing: 1 },
  };
  let sum = 0;
  let wsum = 0;
  for (const at of ATTRS) {
    const w = weights[arch][at.group] ?? 1;
    sum += a[at.id] * w;
    wsum += w;
  }
  return Math.round(Math.max(40, Math.min(99, (sum / wsum) * 1.08)));
}

export function heightLabel(inches: number) {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}
