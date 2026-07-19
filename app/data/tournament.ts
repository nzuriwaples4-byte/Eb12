import { TEAMS, type Team, getTeam } from "./teams";

export type Difficulty = "easy" | "normal" | "hard";
export type MatchLength = 60 | 90 | 120; // seconds of real gameplay

export const ROUND_NAMES = ["Round of 16", "Quarter-final", "Semi-final", "Final"] as const;
export type RoundName = (typeof ROUND_NAMES)[number];

export interface MatchResult {
  round: number;
  opponentId: string;
  playerScore: number;
  opponentScore: number;
  won: boolean;
  stats: MatchStats;
}

export interface MatchStats {
  playerShots: number;
  opponentShots: number;
  playerPossession: number; // percentage
  playerFouls: number;
  opponentFouls: number;
}

export interface TournamentState {
  teamId: string;
  difficulty: Difficulty;
  matchLength: MatchLength;
  /** Ordered list of opponent team ids for each round (4 rounds). */
  opponents: string[];
  /** Current round index (0-3). */
  round: number;
  results: MatchResult[];
  champion: boolean;
  eliminated: boolean;
}

export const TOTAL_ROUNDS = 4;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createTournament(teamId: string, difficulty: Difficulty, matchLength: MatchLength): TournamentState {
  const pool = shuffle(TEAMS.filter((t) => t.id !== teamId).map((t) => t.id));
  const opponents = pool.slice(0, TOTAL_ROUNDS);
  return {
    teamId,
    difficulty,
    matchLength,
    opponents,
    round: 0,
    results: [],
    champion: false,
    eliminated: false,
  };
}

export function currentOpponent(state: TournamentState): Team | undefined {
  return getTeam(state.opponents[state.round]);
}

export function roundName(round: number): RoundName {
  return ROUND_NAMES[Math.min(round, ROUND_NAMES.length - 1)];
}

export function difficultyMultiplier(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy":
      return 0.7;
    case "hard":
      return 1.35;
    default:
      return 1;
  }
}
