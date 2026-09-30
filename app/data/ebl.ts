import { BALLERS, EXTRA_BALLERS, type Baller, type HairStyle, type SpecialStyle } from "./characters";
import { VENUES, type Venue } from "./venues";

/**
 * The EBL — Elite Basketball League. Twelve generated franchises, each with
 * a generated star, colors and a home arena. Generation is seeded so the
 * league is the same every time the game loads.
 */

export interface EblTeam {
  id: string;
  city: string;
  name: string;
  abbr: string;
  primary: string;
  secondary: string;
  /** Team strength 55-95 */
  rating: number;
  starId: string;
  venueId: string;
  owner?: string;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

const TEAM_DEFS: [string, string, string, string, string, number, string?][] = [
  ["New York", "Tide", "NYC", "#1f8fff", "#0b0f1a", 64],
  ["Las Vegas", "Architects", "LVA", "#ff3a6e", "#16161b", 92, "Victor Kane"],
  ["Atlanta", "Titans", "ATL", "#c9a24a", "#1c1c24", 86],
  ["San Diego", "Sharks", "SDS", "#2ec4b6", "#0e2a33", 80],
  ["Phoenix", "Blaze", "PHX", "#ff6b1a", "#2a0d05", 77],
  ["Pittsburgh", "Forge", "PIT", "#9aa3b4", "#b3122a", 71],
  ["Seattle", "Kestrels", "SEA", "#6a3fc8", "#f2c230", 83],
  ["Miami", "Solstice", "MIA", "#ffb300", "#8a1c24", 74],
  ["Chicago", "Gales", "CHI", "#3b4a5c", "#e8ecf4", 68],
  ["Houston", "Orbit", "HOU", "#00b4d8", "#ff4fd8", 60],
  ["Portland", "Redwoods", "POR", "#2f7d3a", "#c2452d", 58],
  ["Los Angeles", "Sirens", "LAS", "#b8c4d6", "#1d2f5a", 88],
];

const FIRST = [
  "Jalen",
  "Marcus",
  "Tariq",
  "Devon",
  "Andre",
  "Malik",
  "Isaiah",
  "Cam",
  "Theo",
  "Rashad",
  "Luka",
  "Omar",
  "Bryce",
  "Xavier",
  "Nico",
  "Kofi",
  "Zion",
  "Elias",
  "Jaylen",
  "Reggie",
];
const LAST = [
  "Holloway",
  "Okafor",
  "Brandt",
  "Castillo",
  "Whitaker",
  "Nakamura",
  "Mensah",
  "Delacroix",
  "Pryor",
  "Santos",
  "Abernathy",
  "Kovac",
  "Rhodes",
  "Figueroa",
  "Adebayo",
  "Lindqvist",
  "Merritt",
  "Oduya",
  "Vance-Hill",
  "Tran",
];
const NICKS = [
  "HALO",
  "DYNAMO",
  "SMOOTH",
  "BULLDOZER",
  "CHILL",
  "RAZOR",
  "TORNADO",
  "GOLDEN",
  "SNIPER",
  "PHANTOM",
  "BOOMER",
  "ICE",
  "CAPTAIN",
  "SPIDER",
  "JETSKI",
];
const HAIRS: HairStyle[] = ["fade", "twists", "shaved", "cap", "braids", "silver-part", "afro-puff"];
const SKINS = ["#6b4430", "#a86f4c", "#e2b894", "#4a2d20", "#c68c63", "#8f5d3e", "#f0cfb0", "#3e2519"];
const STYLES: SpecialStyle[] = ["lightning", "viral", "quake", "smoke", "jewel", "reign"];

function makeStar(team: Omit<EblTeam, "starId" | "venueId">, r: () => number, used: Set<string>): Baller {
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  let first = pick(FIRST);
  let last = pick(LAST);
  while (used.has(first + last)) {
    first = pick(FIRST);
    last = pick(LAST);
  }
  used.add(first + last);
  let nick = pick(NICKS);
  while (used.has(nick)) nick = pick(NICKS);
  used.add(nick);
  const base = team.rating;
  const stat = (bias = 0) => Math.round(Math.max(35, Math.min(99, base - 10 + r() * 22 + bias)));
  const height = 1.83 + r() * 0.3;
  const big = height > 2.02;
  const three = r() < 0.5;
  const template = BALLERS[1];
  return {
    ...template,
    id: `ebl-${team.abbr.toLowerCase()}`,
    name: `${first} ${last}`,
    nickname: nick,
    age: 22 + Math.floor(r() * 10),
    height,
    heightLabel: `${Math.floor((height * 39.37) / 12)}'${Math.round((height * 39.37) % 12)}"`,
    from: `${team.city} ${team.name}`,
    tagline: `Franchise star of the ${team.city} ${team.name}.`,
    bio: `${first} ${last} is the ${team.city} ${team.name}' franchise player${team.owner ? `, hand-picked by owner ${team.owner}` : ""}.`,
    ratings: {
      speed: stat(big ? -10 : 5),
      shooting: stat(three ? 5 : 0),
      three: stat(three ? 8 : -12),
      finishing: stat(big ? 8 : 0),
      dunk: stat(big ? 12 : -5),
      handles: stat(big ? -12 : 6),
      defense: stat(),
      block: stat(big ? 14 : -10),
    },
    flair: r(),
    aggression: 0.3 + r() * 0.4,
    special: {
      name: `${nick} MODE`,
      style: pick(STYLES),
      kind: three && r() < 0.5 ? "three" : "dunk",
      color: team.primary,
      description: `The ${team.name}' closer.`,
    },
    look: {
      skin: pick(SKINS),
      hair: pick(HAIRS),
      hairColor: pick(["#140f0c", "#2a1c12", "#d9dde6", "#3a2a1c"]),
      jersey: team.primary,
      jerseyTrim: team.secondary,
      number: String(Math.floor(r() * 55)),
      shorts: team.primary,
      shortsStripe: team.secondary,
      shoes: team.secondary,
      soles: team.primary,
      headband: r() < 0.25 ? team.secondary : undefined,
      beard: r() < 0.35 ? "#15100c" : undefined,
      chain: false,
      build: big ? 1.25 : 0.9 + r() * 0.2,
    },
    portrait: "key-art",
    model: undefined,
    taunts: ["League's mine.", "Welcome to the EBL, rookie.", "Too easy."],
    accent: team.primary,
    ebl: true,
  };
}

function arenaVenue(team: Omit<EblTeam, "starId" | "venueId">): Venue {
  return {
    id: `arena-${team.abbr.toLowerCase()}`,
    name: `${team.city} Arena`,
    district: `Home of the ${team.name}`,
    theme: "arena",
    timeOfDay: "Game night",
    sky: ["#07080d", "#141826"],
    fog: "#0c0e16",
    fogDensity: 0.008,
    floor: "#c08a52",
    paint: "#c99a5e",
    paintAlt: team.primary,
    line: "#ffffff",
    wet: false,
    sun: { color: "#ffffff", intensity: 1.6, dir: [0.1, 1, 0.2] },
    hemi: { sky: "#eaf0ff", ground: "#3a2c20", intensity: 0.9 },
    lamps: { color: "#ffffff", intensity: 0 },
    crowd: 90,
    storm: false,
    music: { bpm: 98, root: 43, mood: "bright" },
    accent: team.primary,
  };
}

const r = rng(20260929);
const used = new Set<string>();
export const EBL_TEAMS: EblTeam[] = TEAM_DEFS.map(([city, name, abbr, primary, secondary, rating, owner]) => {
  const t = { id: abbr.toLowerCase(), city, name, abbr, primary, secondary, rating, owner };
  const star = makeStar(t, r, used);
  EXTRA_BALLERS.push(star);
  const venue = arenaVenue(t);
  VENUES.push(venue);
  return { ...t, starId: star.id, venueId: venue.id };
});

export function getTeam(id: string) {
  return EBL_TEAMS.find((t) => t.id === id) ?? EBL_TEAMS[0];
}

/** Round-robin schedule (circle method): 12 teams → 11 weeks, one game each */
export function roundRobin(ids: string[]): [string, string][][] {
  const teams = [...ids];
  const weeks: [string, string][][] = [];
  const n = teams.length;
  for (let w = 0; w < n - 1; w++) {
    const games: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      games.push(w % 2 ? [a, b] : [b, a]);
    }
    weeks.push(games);
    teams.splice(1, 0, teams.pop()!);
  }
  return weeks;
}

/** Simulated result of a game between two CPU teams */
export function simGame(home: EblTeam, away: EblTeam): [number, number] {
  const edge = (home.rating + 3 - away.rating) / 40;
  const pHome = Math.max(0.1, Math.min(0.9, 0.5 + edge));
  const homeWins = Math.random() < pHome;
  const win = 21;
  const lose = 9 + Math.floor(Math.random() * 11);
  return homeWins ? [win, lose] : [lose, win];
}
