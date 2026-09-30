import type { Look } from "./characters";

/** Gear sold at KICKS & GEAR in Meridian City. Prices are in Crowns (₵). */
export type GearSlot = "shoes" | "jersey" | "headband" | "sleeve" | "chain" | "lifestyle";

export interface GearItem {
  id: string;
  slot: GearSlot;
  name: string;
  brand: string;
  price: number;
  /** Swatch colors for the shop card */
  swatch: string[];
  apply(look: Look): Look;
  /** VYRO Athletics catalog fields */
  line?: string;
  colorway?: string;
  /** Upper / accent / sole colors for the sneaker preview */
  shoe?: [string, string, string];
  kind?: string;
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

/* ---------------------------------------------------------- VYRO Athletics */

/** A VYRO sneaker in one colorway */
const vyroShoe = (
  line: string,
  kind: string,
  price: number,
  colorway: string,
  upper: string,
  accent: string,
  sole: string,
): GearItem => ({
  id: `vyro-${line.toLowerCase().replace(/\s+/g, "-")}-${colorway.toLowerCase().replace(/[^a-z]+/g, "-")}`,
  slot: "shoes",
  name: `${line} '${colorway}'`,
  brand: "VYRO Athletics",
  price,
  swatch: [upper, accent, sole],
  shoe: [upper, accent, sole],
  line,
  colorway,
  kind,
  // In game the upper takes the main color and the sole carries the accent
  apply: (l) => ({ ...l, shoes: upper, soles: sole === "#f4f4f6" || sole === upper ? accent : sole }),
});

const vyroGoods = (id: string, name: string, kind: string, price: number, colors: string[]): GearItem => ({
  id: `vyro-${id}`,
  slot: "lifestyle",
  name,
  brand: "VYRO Athletics",
  price,
  swatch: colors,
  kind,
  line: name,
  apply: (l) => l,
});

export const VYRO: GearItem[] = [
  // Waples signature line
  vyroShoe("Waples 1", "Signature Shoe", 900, "Black/Blue", "#0b0c14", "#2f6bff", "#2f6bff"),
  vyroShoe("Waples 1", "Signature Shoe", 900, "White/Volt", "#f2f3f7", "#3ddc5a", "#f4f4f6"),
  vyroShoe("Waples 1", "Signature Shoe", 950, "Silver", "#b9bec8", "#6d7380", "#e3e6ec"),
  vyroShoe("Waples 1", "Signature Shoe", 1100, "Gold", "#1a1508", "#e2b23a", "#e2b23a"),
  vyroShoe("Waples 2", "Signature Shoe", 1200, "Black/Purple", "#0b0a12", "#8b5cf6", "#8b5cf6"),
  vyroShoe("Waples 2", "Signature Shoe", 1200, "White/Blue", "#f2f3f7", "#2f6bff", "#f4f4f6"),
  vyroShoe("Waples 2", "Signature Shoe", 1250, "Grey/Gold", "#6d7078", "#e2b23a", "#2a2b30"),
  vyroShoe("Waples 2", "Signature Shoe", 1250, "Red/Black", "#c21d2a", "#0b0b0e", "#0b0b0e"),
  vyroShoe("Waples 3", "Signature Shoe", 1600, "Black/Purple", "#0c0a14", "#7c3aed", "#b8932e"),
  vyroShoe("Waples 3", "Signature Shoe", 1600, "White/Gold", "#f4f1ea", "#d4a93a", "#f4f4f6"),
  vyroShoe("Waples 3", "Signature Shoe", 1650, "Grey/Blue", "#7a7e88", "#2f6bff", "#23252b"),
  vyroShoe("Waples 3", "Signature Shoe", 1650, "Orange/Black", "#ff6a1a", "#0b0b0e", "#0b0b0e"),
  // Footwear
  vyroShoe("VYRO Trainer 1", "Training Shoe", 550, "Black/Purple", "#101018", "#8b5cf6", "#f4f4f6"),
  vyroShoe("VYRO Lifestyle 1", "Casual Shoe", 500, "Speckle White", "#f2f2f4", "#1a1a20", "#f4f4f6"),
  vyroShoe("VYRO Run 1", "Running Shoe", 450, "Violet", "#1b1430", "#a78bfa", "#d9dbe2"),
  vyroShoe("VYRO Kids 1", "Youth Shoe", 300, "Royal", "#0e1020", "#2f6bff", "#2f6bff"),
  // Apparel & gear (collectibles for your closet)
  vyroGoods("hoops-1", "VYRO Hoops 1", "Backpack", 350, ["#0b0b10", "#7c3aed"]),
  vyroGoods("tech-2", "VYRO Tech 2", "Hoodie", 450, ["#0d0d12", "#8b5cf6"]),
  vyroGoods("tech-tee", "VYRO Tech", "T-Shirt", 200, ["#101016", "#8b5cf6"]),
  vyroGoods("ball", "VYRO Basketball", "Official Game Ball", 250, ["#16121f", "#7c3aed"]),
  vyroGoods("duffel-1", "VYRO Duffel 1", "Gym Bag", 400, ["#0b0b10", "#6d28d9"]),
  vyroGoods("slides", "VYRO Slides", "Lifestyle", 150, ["#0b0b10", "#8b5cf6"]),
  vyroGoods("socks", "VYRO Elite Socks", "Performance", 100, ["#f4f4f6", "#0b0b10", "#7c3aed"]),
  // Elite Circuit jersey (equippable kit)
  {
    id: "vyro-elite-circuit",
    slot: "jersey",
    name: "Elite Circuit Jersey #23",
    brand: "VYRO Athletics",
    price: 900,
    swatch: ["#0b0a12", "#8b5cf6", "#0b0a12"],
    kind: "Jersey",
    line: "Elite Circuit",
    apply: (l) => ({ ...l, jersey: "#0b0a12", jerseyTrim: "#8b5cf6", shorts: "#0b0a12", shortsStripe: "#8b5cf6" }),
  },
];

GEAR.push(...VYRO);

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
