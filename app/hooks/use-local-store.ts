import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store shared across components.
 * Reads are cached; every write notifies subscribers.
 */
export function createLocalStore<T>(key: string, initial: T) {
  let cache: T | null = null;
  const listeners = new Set<() => void>();

  function read(): T {
    if (typeof window === "undefined") return initial;
    if (cache === null) {
      try {
        const raw = window.localStorage.getItem(key);
        cache = raw ? { ...initial, ...(JSON.parse(raw) as T) } : initial;
      } catch {
        cache = initial;
      }
    }
    return cache as T;
  }

  function write(next: T) {
    cache = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* private mode / quota */
    }
    listeners.forEach((l) => l());
  }

  function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function useStore() {
    const state = useSyncExternalStore(subscribe, read, () => initial);
    const update = useCallback((fn: (s: T) => T) => write(fn(read())), []);
    return [state, update] as const;
  }

  return { read, write, useStore };
}
