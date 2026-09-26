import type { AssetId } from "./higgsfield-assets";

export type HairStyle = "twists" | "cap" | "shaved" | "silver-part" | "afro-puff" | "fade" | "braids";
export type SpecialStyle = "lightning" | "viral" | "quake" | "smoke" | "jewel" | "reign";

export interface Ratings {
  /** Top speed & acceleration */
  speed: number;
  /** Mid-range jumpers */
  shooting: number;
  /** Three-pointers */
  three: number;
  /** Layups & close finishes */
  finishing: number;
  /** Dunk range and power */
  dunk: number;
  /** Crossovers, ball security */
  handles: number;
  /** Perimeter defense & steals */
  defense: number;
  /** Shot blocking */
  block: number;
}

export interface Look {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  hairTip?: string;
  jersey: string;
  jerseyTrim: string;
  number: string;
  shorts: string;
  shortsStripe: string;
  shoes: string;
  soles: string;
  sleeveLeft?: string;
  kneeBraceRight?: string;
  headband?: string;
  beard?: string;
  chain?: boolean;
  earrings?: boolean;
  /** Width multiplier for the torso/limbs (1 = lean guard) */
  build: number;
}

export interface Baller {
  id: string;
  name: string;
  nickname: string;
  age: number;
  /** meters */
  height: number;
  heightLabel: string;
  from: string;
  tagline: string;
  bio: string;
  ratings: Ratings;
  /** 0..1: how often the AI shows off */
  flair: number;
  /** 0..1: how often the AI gambles for steals */
  aggression: number;
  special: { name: string; style: SpecialStyle; kind: "dunk" | "three"; color: string; description: string };
  look: Look;
  portrait: AssetId;
  /** Optional Higgsfield rigged GLB used in-game instead of the procedural body. */
  model?: AssetId;
  taunts: string[];
  /** Accent color used by the UI */
  accent: string;
}

export const BALLERS: Baller[] = [
  {
    id: "kairo",
    name: "Kairo Vance",
    nickname: "STATIC",
    age: 21,
    height: 1.93,
    heightLabel: `6'4"`,
    from: "Harbor Heights, Port Meridian",
    tagline: "Every comeback starts at zero.",
    bio: "Two years ago he was the #1 prospect in Port Meridian, until his right knee gave out on a dunk in the city title game. The scholarship disappeared, and so did his mentor. Now he loads cargo at the harbor by night and hoops at dawn, wearing number 00 because that's where he's starting over.",
    ratings: { speed: 88, shooting: 80, three: 76, finishing: 86, dunk: 88, handles: 86, defense: 76, block: 62 },
    flair: 0.55,
    aggression: 0.5,
    special: {
      name: "LIGHTS OUT",
      style: "lightning",
      kind: "dunk",
      color: "#3ad7ff",
      description: "The court goes dark and he's already at the rim. Windmill dunk riding a bolt of lightning.",
    },
    look: {
      skin: "#6b4430",
      hair: "twists",
      hairColor: "#16110e",
      hairTip: "#2fc6ff",
      jersey: "#1f8fff",
      jerseyTrim: "#0b0f1a",
      number: "00",
      shorts: "#0e121c",
      shortsStripe: "#2fc6ff",
      shoes: "#101218",
      soles: "#d6ff3a",
      sleeveLeft: "#f2f4f8",
      kneeBraceRight: "#15171d",
      build: 1,
    },
    portrait: "kairo-portrait",
    model: "kairo-rigged",
    taunts: ["Static on the line.", "Lights out.", "Started from 00."],
    accent: "#3ad7ff",
  },
  {
    id: "deuce",
    name: "Darnell Price",
    nickname: "DEUCE",
    age: 18,
    height: 1.8,
    heightLabel: `5'11"`,
    from: "Pier 9, Port Meridian",
    tagline: "If it ain't on stream, it didn't happen.",
    bio: "Pier 9's loudest mouth and most-watched streamer. Deuce livestreams every game, every trick and every trash-talk session. He's quicker than he looks and never met a behind-the-back he didn't like.",
    ratings: { speed: 86, shooting: 64, three: 60, finishing: 70, dunk: 55, handles: 82, defense: 58, block: 40 },
    flair: 0.85,
    aggression: 0.55,
    special: {
      name: "GO VIRAL",
      style: "viral",
      kind: "dunk",
      color: "#ff8a1f",
      description: "A strobe of phone flashes and a 360 layup straight to the For You page.",
    },
    look: {
      skin: "#a86f4c",
      hair: "cap",
      hairColor: "#1a120c",
      jersey: "#ff7a1a",
      jerseyTrim: "#fff1e0",
      number: "2",
      shorts: "#fff1e0",
      shortsStripe: "#ff7a1a",
      shoes: "#f5f5f5",
      soles: "#ff7a1a",
      chain: true,
      build: 0.9,
    },
    portrait: "deuce-portrait",
    taunts: ["Chat, y'all seeing this?", "Clip it!", "Hold that L on stream."],
    accent: "#ff8a1f",
  },
  {
    id: "brick",
    name: "Tomas Moreno",
    nickname: "BRICK",
    age: 27,
    height: 2.06,
    heightLabel: `6'9"`,
    from: "The Cage, Underline District",
    tagline: "Nobody scores in my house.",
    bio: "The Cage sits under the elevated train line, and Brick has run it for six years. He blocks shots into the tracks and bumps drivers into the fence. They call him Brick because of how he plays defense, not how he shoots. He can't shoot.",
    ratings: { speed: 62, shooting: 48, three: 30, finishing: 88, dunk: 94, handles: 50, defense: 80, block: 95 },
    flair: 0.25,
    aggression: 0.35,
    special: {
      name: "WRECKING BALL",
      style: "quake",
      kind: "dunk",
      color: "#ff3b3b",
      description: "A tomahawk so heavy the whole cage shakes.",
    },
    look: {
      skin: "#b98463",
      hair: "shaved",
      hairColor: "#1a1410",
      jersey: "#b3122a",
      jerseyTrim: "#2a0a10",
      number: "44",
      shorts: "#2a0a10",
      shortsStripe: "#b3122a",
      shoes: "#2a2a2a",
      soles: "#b3122a",
      beard: "#15100c",
      build: 1.35,
    },
    portrait: "brick-portrait",
    taunts: ["Get that outta here.", "Not in my house.", "Train's louder than you."],
    accent: "#ff4b4b",
  },
  {
    id: "silk",
    name: "Jae-won Park",
    nickname: "SILK",
    age: 24,
    height: 1.85,
    heightLabel: `6'1"`,
    from: "Neon Alley, Little Seoul",
    tagline: "You'll hear your ankles before you feel them.",
    bio: "Silk never raises his voice or his heart rate. He works the neon-lit alley court in Little Seoul, dribbling like the ball is on a string. People say nobody has broken his ankles, but he has broken plenty of theirs.",
    ratings: { speed: 84, shooting: 78, three: 74, finishing: 76, dunk: 50, handles: 98, defense: 74, block: 42 },
    flair: 0.75,
    aggression: 0.6,
    special: {
      name: "SMOKE & MIRRORS",
      style: "smoke",
      kind: "dunk",
      color: "#b46bff",
      description: "Three afterimages, one real Silk. Spin, fade, reverse finish.",
    },
    look: {
      skin: "#e2b894",
      hair: "silver-part",
      hairColor: "#d9dde6",
      jersey: "#1a1024",
      jerseyTrim: "#a35bff",
      number: "11",
      shorts: "#1a1024",
      shortsStripe: "#a35bff",
      shoes: "#0f0f12",
      soles: "#ff4fd8",
      earrings: true,
      build: 0.92,
    },
    portrait: "silk-portrait",
    taunts: ["Too slow.", "Watch the hands.", "Smooth."],
    accent: "#b46bff",
  },
  {
    id: "queen",
    name: "Adaeze Okoro",
    nickname: "QUEEN",
    age: 28,
    height: 1.88,
    heightLabel: `6'2"`,
    from: "Queensway Park",
    tagline: "The line is mine.",
    bio: "A former overseas pro who came home to run the Crown Circuit bracket. Queen hits threes from the logo, and she's the one person who knows what happened the night Kairo got hurt, because she was sitting next to Monarch when it happened.",
    ratings: { speed: 78, shooting: 90, three: 97, finishing: 74, dunk: 45, handles: 82, defense: 84, block: 60 },
    flair: 0.4,
    aggression: 0.45,
    special: {
      name: "CROWN JEWEL",
      style: "jewel",
      kind: "three",
      color: "#2bd67b",
      description: "A step-back from the deep end with an emerald trail. It never misses.",
    },
    look: {
      skin: "#5a3625",
      hair: "afro-puff",
      hairColor: "#140e0a",
      hairTip: "#e8c15a",
      jersey: "#0f7a47",
      jerseyTrim: "#e8c15a",
      number: "3",
      shorts: "#0f7a47",
      shortsStripe: "#e8c15a",
      shoes: "#f3efe6",
      soles: "#e8c15a",
      earrings: true,
      build: 0.88,
    },
    portrait: "queen-portrait",
    taunts: ["Count it.", "Bow.", "Too easy from here."],
    accent: "#2bd67b",
  },
  {
    id: "monarch",
    name: "Marcus Vale",
    nickname: "MONARCH",
    age: 38,
    height: 1.98,
    heightLabel: `6'6"`,
    from: "The Crown, Meridian Tower",
    tagline: "Heavy is the head.",
    bio: "The undefeated king of Port Meridian streetball and Kairo's old mentor. Two years ago he told a hurt Kairo that legends don't sit. Then he vanished. He came back at the top of Meridian Tower, running the Crown Circuit and waiting for somebody to take his crown.",
    ratings: { speed: 84, shooting: 92, three: 86, finishing: 94, dunk: 92, handles: 92, defense: 92, block: 80 },
    flair: 0.5,
    aggression: 0.55,
    special: {
      name: "REIGN",
      style: "reign",
      kind: "dunk",
      color: "#ffc93a",
      description: "Gold light, thunder, and a between-the-legs slam from the free-throw line.",
    },
    look: {
      skin: "#4a2d20",
      hair: "fade",
      hairColor: "#1a1512",
      jersey: "#0c0c0f",
      jerseyTrim: "#e2b23a",
      number: "1",
      shorts: "#0c0c0f",
      shortsStripe: "#e2b23a",
      shoes: "#0c0c0f",
      soles: "#e2b23a",
      headband: "#e2b23a",
      beard: "#8f8a86",
      build: 1.12,
    },
    portrait: "monarch-portrait",
    taunts: ["Kneel.", "Still not ready.", "The crown stays."],
    accent: "#ffc93a",
  },
];

export function getBaller(id: string): Baller {
  return BALLERS.find((b) => b.id === id) ?? BALLERS[0];
}

/** Overall rating, shown on select screens */
export function overall(b: Baller): number {
  const r = b.ratings;
  return Math.round((r.speed + r.shooting + r.three + r.finishing + r.dunk + r.handles + r.defense + r.block) / 8 + 4);
}
