import { createLocalStore } from "~/hooks/use-local-store";
import type { League } from "./league";

/** The saved Owner Mode franchise (null until a team is picked) */
const store = createLocalStore<{ league: League | null }>("ebl2.owner.v1", { league: null });
export const useLeague = store.useStore;
