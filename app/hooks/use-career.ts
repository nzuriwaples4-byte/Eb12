import type { Attrs } from "~/data/attributes";
import type { MyPlayer, Stage } from "~/data/career";
import { createLocalStore } from "./use-local-store";

export interface ProGame {
  week: number;
  opp: string;
  home: boolean;
  score: [number, number];
  win: boolean;
}

export interface Career {
  stage: Stage;
  me: MyPlayer | null;
  attrs: Attrs | null;
  /** Skill points to spend in the builder */
  sp: number;
  hsGame: number;
  hsWins: number;
  collegeId: string | null;
  collegeGame: number;
  collegeWins: number;
  pick: number;
  teamId: string | null;
  week: number;
  /** Win/loss per team id */
  table: Record<string, { w: number; l: number; pf: number; pa: number }>;
  games: ProGame[];
  /** Life activity used this week */
  activityDone: boolean;
  fans: number;
  love: number;
  chemistry: number;
  flags: string[];
  seen: string[];
  playoff: { seeds: string[]; round: 0 | 1 | 2; alive: boolean } | null;
  earnings: number;
  /** Rapper side quest progress (steps of RAP_QUEST completed) */
  rapStep?: number;
}

export const NEW_CAREER: Career = {
  stage: "create",
  me: null,
  attrs: null,
  sp: 40,
  hsGame: 0,
  hsWins: 0,
  collegeId: null,
  collegeGame: 0,
  collegeWins: 0,
  pick: 0,
  teamId: null,
  week: 0,
  table: {},
  games: [],
  activityDone: false,
  fans: 10,
  love: 0,
  chemistry: 50,
  flags: [],
  seen: [],
  playoff: null,
  earnings: 0,
};

const store = createLocalStore<Career>("concrete-crown.career.v1", NEW_CAREER);
export const useCareer = store.useStore;
export const readCareer = store.read;
export const writeCareer = store.write;
