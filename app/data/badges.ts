import type { AttrId, Attrs } from "./attributes";
import type { Ratings } from "./characters";

/**
 * Badges: 2K22-style perks bought with Badge Points (BP). Each badge has four
 * tiers (Bronze → Hall of Fame). A tier needs the matching attribute to reach
 * its threshold, so your build decides which badges you can max out.
 */

export type BadgeCat = "finishing" | "shooting" | "playmaking" | "defense";

export const BADGE_CATS: { id: BadgeCat; label: string; color: string }[] = [
  { id: "finishing", label: "Finishing", color: "#1f6fff" },
  { id: "shooting", label: "Shooting", color: "#18b848" },
  { id: "playmaking", label: "Playmaking", color: "#ff7a1a" },
  { id: "defense", label: "Defense / Rebounding", color: "#e0242a" },
];

export interface Badge {
  id: string;
  name: string;
  cat: BadgeCat;
  attr: AttrId;
  /** Attribute needed for Bronze, Silver, Gold, Hall of Fame */
  tiers: [number, number, number, number];
  /** Engine rating it boosts (+1 / +2 / +4 / +6 per tier) */
  boosts: keyof Ratings;
  desc: string;
}

export const BADGES: Badge[] = [
  {
    id: "posterizer",
    name: "Posterizer",
    cat: "finishing",
    attr: "drivingDunk",
    tiers: [68, 76, 84, 92],
    boosts: "dunk",
    desc: "Dunks on defenders more often.",
  },
  {
    id: "acrobat",
    name: "Acrobat",
    cat: "finishing",
    attr: "layup",
    tiers: [66, 74, 82, 90],
    boosts: "finishing",
    desc: "Better odds on contested layups.",
  },
  {
    id: "slithery",
    name: "Slithery",
    cat: "finishing",
    attr: "close",
    tiers: [64, 72, 80, 88],
    boosts: "finishing",
    desc: "Slips through contact at the rim.",
  },
  {
    id: "bully",
    name: "Bully",
    cat: "finishing",
    attr: "strength",
    tiers: [66, 74, 82, 90],
    boosts: "dunk",
    desc: "Finishes through bigger bodies.",
  },
  {
    id: "deadeye",
    name: "Deadeye",
    cat: "shooting",
    attr: "three",
    tiers: [66, 74, 82, 90],
    boosts: "three",
    desc: "Contests hurt your jumper less.",
  },
  {
    id: "catch-shoot",
    name: "Catch & Shoot",
    cat: "shooting",
    attr: "three",
    tiers: [62, 70, 78, 86],
    boosts: "three",
    desc: "Hot out of the pass.",
  },
  {
    id: "mid-maestro",
    name: "Mid-Range Maestro",
    cat: "shooting",
    attr: "mid",
    tiers: [64, 72, 80, 88],
    boosts: "shooting",
    desc: "Money from 15 feet.",
  },
  {
    id: "green-machine",
    name: "Green Machine",
    cat: "shooting",
    attr: "ft",
    tiers: [66, 74, 82, 90],
    boosts: "shooting",
    desc: "Bigger perfect-release window.",
  },
  {
    id: "ankle-breaker",
    name: "Ankle Breaker",
    cat: "playmaking",
    attr: "handle",
    tiers: [66, 74, 82, 90],
    boosts: "handles",
    desc: "Crossovers drop defenders.",
  },
  {
    id: "dimer",
    name: "Dimer",
    cat: "playmaking",
    attr: "pass",
    tiers: [64, 72, 80, 88],
    boosts: "handles",
    desc: "Sets teammates up for easy buckets.",
  },
  {
    id: "quick-first-step",
    name: "Quick First Step",
    cat: "playmaking",
    attr: "swb",
    tiers: [66, 74, 82, 90],
    boosts: "speed",
    desc: "Explosive launches off the dribble.",
  },
  {
    id: "tight-handles",
    name: "Tight Handles",
    cat: "playmaking",
    attr: "handle",
    tiers: [62, 70, 78, 86],
    boosts: "handles",
    desc: "Harder to strip.",
  },
  {
    id: "clamps",
    name: "Clamps",
    cat: "defense",
    attr: "perimeter",
    tiers: [66, 74, 82, 90],
    boosts: "defense",
    desc: "Cut off drives and stay in front.",
  },
  {
    id: "glove",
    name: "Glove",
    cat: "defense",
    attr: "steal",
    tiers: [64, 72, 80, 88],
    boosts: "defense",
    desc: "Clean pickpockets.",
  },
  {
    id: "anchor",
    name: "Anchor",
    cat: "defense",
    attr: "block",
    tiers: [66, 74, 82, 90],
    boosts: "block",
    desc: "Owns the paint.",
  },
  {
    id: "rebound-chaser",
    name: "Rebound Chaser",
    cat: "defense",
    attr: "dreb",
    tiers: [64, 72, 80, 88],
    boosts: "block",
    desc: "Tracks down every board.",
  },
];

export const TIER_NAMES = ["—", "Bronze", "Silver", "Gold", "Hall of Fame"];
export const TIER_COLORS = ["#3a3d46", "#c98a4a", "#c9d3e8", "#ffd24a", "#b88cff"];
/** BP cost to reach each tier from the one below */
export const TIER_COST = [0, 1, 2, 3, 4];

export function maxTier(b: Badge, attrs: Attrs) {
  return b.tiers.filter((t) => attrs[b.attr] >= t).length;
}

/** Total BP needed to max every badge in a category at these attribute levels */
export function badgePotential(cat: BadgeCat, attrs: Attrs) {
  let n = 0;
  for (const b of BADGES) {
    if (b.cat !== cat) continue;
    const t = maxTier(b, attrs);
    for (let i = 1; i <= t; i++) n += TIER_COST[i];
  }
  return n;
}

/** Equipped badges boost the engine ratings */
export function applyBadges(r: Ratings, badges: Record<string, number> | undefined): Ratings {
  if (!badges) return r;
  const out = { ...r };
  const step = [0, 1, 2, 4, 6];
  for (const b of BADGES) {
    const t = badges[b.id] ?? 0;
    if (t) out[b.boosts] = Math.min(99, out[b.boosts] + step[t]);
  }
  return out;
}

export const emptyBP = (): Record<BadgeCat, number> => ({ finishing: 0, shooting: 0, playmaking: 0, defense: 0 });
