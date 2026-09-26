import { createLocalStore } from "./use-local-store";

export interface Progress {
  /** Chapter ids beaten */
  beaten: string[];
  /** Objective stars earned per chapter */
  stars: Record<string, boolean>;
  /** Best margin per chapter */
  best: Record<string, [number, number]>;
  /** Quick-match record */
  wins: number;
  losses: number;
  seenIntro: boolean;
}

const store = createLocalStore<Progress>("concrete-crown.progress.v1", {
  beaten: [],
  stars: {},
  best: {},
  wins: 0,
  losses: 0,
  seenIntro: false,
});

export const useProgress = store.useStore;
export const readProgress = store.read;

/** Ballers you can pick in Quick Match: Kairo + anyone beaten in story */
export function unlockedBallers(p: Progress, chapters: { id: string; opponentId: string }[]) {
  const ids = new Set(["kairo"]);
  for (const c of chapters) if (p.beaten.includes(c.id)) ids.add(c.opponentId);
  return ids;
}
