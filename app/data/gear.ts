import type { Look } from "./characters";

/** Gear sold at KICKS & GEAR in Meridian City. Prices are in Crowns (₵). */
export type GearSlot = "shoes" | "jersey" | "headband" | "sleeve" | "chain";

export interface GearItem {
  id: string;
  slot: GearSlot;
  name: string;
  brand: string;
  price: number;
  /** Swatch colors for the shop card */
  swatch: string[];
  apply(look: Look): Look;
}

const shoe = (id: string, name: string, brand: string, price: number, shoes: string, soles: string): GearItem => ({
  id,
  slot: "shoes",
  name,
  brand,
  price,
  swatch: [shoes, soles],
  apply: (l) => ({ ...l, shoes, soles }),
});

const kit = (
  id: string,
  name: string,
  price: number,
  jersey: string,
  jerseyTrim: string,
  shorts: string,
  shortsStripe: string,
): GearItem => ({
  id,
  slot: "jersey",
  name,
  brand: "Crown Circuit",
  price,
  swatch: [jersey, jerseyTrim, shorts],
  apply: (l) => ({ ...l, jersey, jerseyTrim, shorts, shortsStripe }),
});

export const GEAR: GearItem[] = [
  // Shoes
  shoe("volt-00", "Volt 00 'Static'", "Harbor Kicks", 0, "#101218", "#d6ff3a"),
  shoe("blackout", "Blackout Hi", "Harbor Kicks", 300, "#0a0a0c", "#0a0a0c"),
  shoe("sunset-pier", "Pier 9 'Sunset'", "Harbor Kicks", 450, "#ff8a3a", "#fff1e0"),
  shoe("neon-alley", "Alley Runner 'Neon'", "Little Seoul Supply", 600, "#1a1024", "#ff4fd8"),
  shoe("emerald-queen", "Queensway 'Emerald'", "Queensway Athletics", 650, "#f3efe6", "#0f7a47"),
  shoe("crown-gold", "Crown Royale 'Gold'", "Monarch Signature", 1200, "#0c0c0f", "#e2b23a"),
  shoe("ice-white", "Glacier Low", "Kane Performance", 900, "#f4f7fb", "#9fe8ff"),
  shoe("lava", "Magma Mid", "Underline Co.", 750, "#b3122a", "#ffb300"),

  // Jerseys (full kit)
  kit("home-00", "Static Home #00", 0, "#1f8fff", "#0b0f1a", "#0e121c", "#2fc6ff"),
  kit("away-00", "Static Away #00", 400, "#f2f4f8", "#1f8fff", "#f2f4f8", "#1f8fff"),
  kit("blackout-00", "Blackout Edition", 800, "#0b0c10", "#2fc6ff", "#0b0c10", "#2fc6ff"),
  kit("harbor-00", "Harbor Heights Throwback", 700, "#c2452d", "#f4efe6", "#1d2a44", "#f4efe6"),
  kit("crown-00", "Crown Champion", 1500, "#e2b23a", "#0c0c0f", "#0c0c0f", "#e2b23a"),
  kit("ebl-rookie", "EBL Rookie Kit", 1000, "#7a2cff", "#ffffff", "#1a0f33", "#b88cff"),

  // Accessories
  {
    id: "band-white",
    slot: "headband",
    name: "Classic Headband",
    brand: "Harbor Kicks",
    price: 150,
    swatch: ["#f6f6f6"],
    apply: (l) => ({ ...l, headband: "#f6f6f6" }),
  },
  {
    id: "band-blue",
    slot: "headband",
    name: "Static Headband",
    brand: "Harbor Kicks",
    price: 200,
    swatch: ["#2fc6ff"],
    apply: (l) => ({ ...l, headband: "#2fc6ff" }),
  },
  {
    id: "band-gold",
    slot: "headband",
    name: "Gold Crown Band",
    brand: "Monarch Signature",
    price: 500,
    swatch: ["#e2b23a"],
    apply: (l) => ({ ...l, headband: "#e2b23a" }),
  },
  {
    id: "sleeve-black",
    slot: "sleeve",
    name: "Shooter Sleeve (Black)",
    brand: "Kane Performance",
    price: 200,
    swatch: ["#111318"],
    apply: (l) => ({ ...l, sleeveLeft: "#111318" }),
  },
  {
    id: "sleeve-neon",
    slot: "sleeve",
    name: "Shooter Sleeve (Volt)",
    brand: "Kane Performance",
    price: 250,
    swatch: ["#d6ff3a"],
    apply: (l) => ({ ...l, sleeveLeft: "#d6ff3a" }),
  },
  {
    id: "chain-gold",
    slot: "chain",
    name: "Crown Chain",
    brand: "Meridian Jewelers",
    price: 900,
    swatch: ["#e8c15a"],
    apply: (l) => ({ ...l, chain: true }),
  },
];

export const STARTER_GEAR = ["volt-00", "home-00"];

export function getGear(id: string) {
  return GEAR.find((g) => g.id === id);
}

/** Kairo's look with his equipped gear applied */
export function applyGear(look: Look, equipped: Partial<Record<GearSlot, string>>): Look {
  let out = { ...look };
  for (const id of Object.values(equipped)) {
    const g = id ? getGear(id) : undefined;
    if (g) out = g.apply(out);
  }
  return out;
}

/** Crowns earned per result */
export const PAYOUT = {
  storyWin: 300,
  storyStar: 150,
  quickWin: 120,
  quickLoss: 30,
  leagueWin: 200,
  leagueLoss: 50,
  title: 2000,
};
