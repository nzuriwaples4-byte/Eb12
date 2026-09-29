import type { ObjectiveKind } from "~/data/story";

export type Phase = "loading" | "intro" | "check" | "live" | "dead" | "special" | "over";

export interface MatchConfig {
  playerId: string;
  opponentId: string;
  venueId: string;
  target: number;
  /** 0 = rookie, 1 = pro, 2 = legend */
  difficulty: number;
  useHiggsfield: boolean;
  shadows: boolean;
  cameraShake: boolean;
  /** Custom look for player 0 (purchased gear). Uses the procedural body. */
  playerLook?: import("~/data/characters").Look;
  /** Attract / screenshot mode: both sides AI */
  cpuVsCpu?: boolean;
}

export interface PlayerStats {
  points: number;
  fga: number;
  fgm: number;
  threes: number;
  dunks: number;
  blocks: number;
  steals: number;
  ankles: number;
  perfect: number;
  specials: number;
}

export function emptyStats(): PlayerStats {
  return { points: 0, fga: 0, fgm: 0, threes: 0, dunks: 0, blocks: 0, steals: 0, ankles: 0, perfect: 0, specials: 0 };
}

export const OBJECTIVE_STAT: Record<Exclude<ObjectiveKind, "margin">, keyof PlayerStats> = {
  perfect: "perfect",
  dunks: "dunks",
  ankles: "ankles",
  special: "specials",
  blocks: "blocks",
  threes: "threes",
};

export interface HudState {
  phase: Phase;
  score: [number, number];
  target: number;
  shotClock: number;
  hype: [number, number];
  turbo: [number, number];
  possession: 0 | 1;
  needClear: boolean;
  countdown: number;
  loadingText: string;
  modelKinds: [string, string];
}

export interface Callout {
  id: number;
  text: string;
  sub?: string;
  color: string;
  size: "sm" | "md" | "lg";
}

export interface MatchResult {
  winner: 0 | 1;
  score: [number, number];
  stats: [PlayerStats, PlayerStats];
}

export interface Intent {
  moveX: number;
  moveZ: number;
  turbo: boolean;
  shootPress: boolean;
  shootHeld: boolean;
  shootRelease: boolean;
  juke: boolean;
  trick: boolean;
  lob: boolean;
  special: boolean;
}

export function emptyIntent(): Intent {
  return {
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
}
