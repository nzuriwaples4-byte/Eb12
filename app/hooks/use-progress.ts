import { STARTER_GEAR, applyGear, type GearSlot } from "~/data/gear";
import { getBaller, type Look } from "~/data/characters";
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
  /** Crowns (₵), the in-game currency */
  crowns: number;
  owned: string[];
  equipped: Partial<Record<GearSlot, string>>;
}

const store = createLocalStore<Progress>("concrete-crown.progress.v1", {
  beaten: [],
  stars: {},
  best: {},
  wins: 0,
  losses: 0,
  seenIntro: false,
  crowns: 500,
  owned: STARTER_GEAR,
  equipped: { shoes: "volt-00", jersey: "home-00" },
});

export const useProgress = store.useStore;
export const readProgress = store.read;

/** Ballers you can pick in Quick Match: Kairo + anyone beaten in story */
export function unlockedBallers(p: Progress, chapters: { id: string; opponentId: string }[]) {
  const ids = new Set(["kairo"]);
  for (const c of chapters) if (p.beaten.includes(c.id)) ids.add(c.opponentId);
  return ids;
}

/** Kairo's look with purchased gear; null when he's wearing the default kit */
export function kairoLook(p: Progress): Look | null {
  const e = p.equipped ?? {};
  const isDefault =
    (e.shoes ?? "volt-00") === "volt-00" &&
    (e.jersey ?? "home-00") === "home-00" &&
    !e.headband &&
    !e.sleeve &&
    !e.chain;
  return isDefault ? null : applyGear(getBaller("kairo").look, e);
}

export function addCrowns(p: Progress, amount: number): Progress {
  return { ...p, crowns: (p.crowns ?? 0) + amount };
}
