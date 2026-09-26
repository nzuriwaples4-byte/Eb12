import { createLocalStore } from "./use-local-store";

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  difficulty: number;
  shadows: boolean;
  cameraShake: boolean;
  useHiggsfield: boolean;
  unlockAll: boolean;
}

const store = createLocalStore<Settings>("concrete-crown.settings.v1", {
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  difficulty: 1,
  shadows: true,
  cameraShake: true,
  useHiggsfield: true,
  unlockAll: false,
});

export const useSettings = store.useStore;
export const readSettings = store.read;
