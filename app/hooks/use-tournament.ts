import { useCallback, useSyncExternalStore } from "react";
import type { MatchResult, TournamentState } from "~/data/tournament";
import { TOTAL_ROUNDS } from "~/data/tournament";

const STORAGE_KEY = "goalglory.tournament";

let memoryState: TournamentState | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function read(): TournamentState | null {
  if (typeof window === "undefined") return null;
  if (!hydrated) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      memoryState = raw ? (JSON.parse(raw) as TournamentState) : null;
    } catch {
      memoryState = null;
    }
    hydrated = true;
  }
  return memoryState;
}

function write(next: TournamentState | null) {
  memoryState = next;
  hydrated = true;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / privacy errors */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTournament() {
  const state = useSyncExternalStore(subscribe, read, () => null);

  const start = useCallback((next: TournamentState) => write(next), []);

  const reset = useCallback(() => write(null), []);

  const applyResult = useCallback((result: MatchResult) => {
    const current = read();
    if (!current) return;
    const results = [...current.results, result];
    if (!result.won) {
      write({ ...current, results, eliminated: true });
      return;
    }
    const nextRound = current.round + 1;
    const champion = nextRound >= TOTAL_ROUNDS;
    write({
      ...current,
      results,
      round: champion ? current.round : nextRound,
      champion,
    });
  }, []);

  return { state, start, reset, applyResult };
}
