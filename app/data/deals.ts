import type { MyPlayer } from "./career";
import type { Line } from "./story";

/**
 * Shoe deals. Two brands, both the studio's own: VYRO Athletics and VANTA.
 * The agent brings both offers; you sign one contract and wear the brand.
 * Deals grow with you: Rookie → Signature Athlete (your own shoe) → Icon.
 */

export type BrandId = "vyro" | "vanta";
export type DealTier = "rookie" | "signature" | "icon";

export interface Brand {
  id: BrandId;
  name: string;
  short: string;
  tagline: string;
  /** Header / ink colors for the contract */
  colors: [string, string];
  /** Store brand string on gear items */
  gearBrand: string;
}

export const BRANDS: Record<BrandId, Brand> = {
  vyro: {
    id: "vyro",
    name: "VYRO Athletics",
    short: "VYRO",
    tagline: "Built for more",
    colors: ["#8b5cf6", "#0b0a12"],
    gearBrand: "VYRO Athletics",
  },
  vanta: {
    id: "vanta",
    name: "VANTA",
    short: "VANTA",
    tagline: "Built different.",
    colors: ["#f4f4f6", "#0a0a0b"],
    gearBrand: "VANTA",
  },
};

export interface ShoeDeal {
  brand: BrandId;
  tier: DealTier;
  /** Paid once on signing (₵) */
  bonus: number;
  /** Paid on top of salary every pro game (₵) */
  perGame: number;
  /** Contract length in seasons */
  years: number;
  /** % of your signature shoe's sales, paid each season */
  royalty: number;
  /** Your own model, if the deal includes one */
  shoe: string | null;
  /** Colors of your signature shoe: upper, accent, sole */
  shoeColors: [string, string, string];
  perks: string[];
  /** EBL season the deal was signed */
  signed: number;
}

export const TIER_LABEL: Record<DealTier, string> = {
  rookie: "Rookie Athlete",
  signature: "Signature Athlete",
  icon: "Icon · Lifetime",
};

function tierFor(fans: number, ovr: number, season: number, champion: boolean): DealTier {
  if ((season >= 4 && fans >= 120) || (champion && ovr >= 85)) return "icon";
  if (fans >= 60 || ovr >= 80 || season >= 2) return "signature";
  return "rookie";
}

const round = (n: number) => Math.round(n / 50) * 50;

/** The agent's two offers, one from each brand */
export function dealOffers(
  me: MyPlayer,
  opts: { fans: number; ovr: number; season: number; champion: boolean; current?: ShoeDeal | null },
): ShoeDeal[] {
  const { fans, ovr, season, champion, current } = opts;
  const tier = tierFor(fans, ovr, season, champion);
  const last = me.name.split(" ").slice(-1)[0];
  const step = tier === "icon" ? 3 : tier === "signature" ? 2 : 1;
  const base = 600 * step + fans * 8 + Math.max(0, ovr - 60) * 25;
  const loyal = (b: BrandId) => (current?.brand === b ? 1.1 : 1);
  // VYRO pays more up front; VANTA pays more per game and bets on you sooner
  const vantaTier: DealTier = tier === "rookie" && fans >= 30 ? "signature" : tier;
  // Re-up with the same brand and you get the next model
  const model = (b: BrandId) => (current?.brand === b ? Number(current.shoe?.match(/(\d+)$/)?.[1] ?? 0) + 1 : 1);
  const ten = (n: number) => Math.round(n / 10) * 10;
  const vyro: ShoeDeal = {
    brand: "vyro",
    tier,
    bonus: round(base * 1.4 * loyal("vyro")),
    perGame: ten((40 + step * 50 + fans) * loyal("vyro")),
    years: tier === "icon" ? 99 : 3,
    royalty: tier === "rookie" ? 0 : tier === "signature" ? 8 : 12,
    shoe: tier === "rookie" ? null : `${last} ${model("vyro")}`,
    shoeColors: ["#0b0a12", "#8b5cf6", "#8b5cf6"],
    perks: [
      "Full VYRO wardrobe, every colorway",
      tier === "rookie" ? "Player Edition Waples 1s" : "Your shoe in VYRO stores nationwide",
      "Atlanta flagship launch party",
    ],
    signed: season,
  };
  const vanta: ShoeDeal = {
    brand: "vanta",
    tier: vantaTier,
    bonus: round(base * 1.05 * loyal("vanta")),
    perGame: ten((60 + step * 70 + fans * 1.3) * loyal("vanta")),
    years: vantaTier === "icon" ? 99 : 2,
    royalty: vantaTier === "rookie" ? 0 : vantaTier === "signature" ? 12 : 15,
    shoe: vantaTier === "rookie" ? null : `VANTA ${last.toUpperCase()} 0${Math.min(9, model("vanta"))}`,
    shoeColors: ["#0d0d0f", "#ffffff", "#f4f4f6"],
    perks: [
      "VANTA 01–04 in every colorway",
      vantaTier !== tier ? "Signature shoe NOW (VANTA bets early)" : "Your shoe on the VANTA homepage",
      "Design input on colorways",
    ],
    signed: season,
  };
  return [vyro, vanta];
}

export function dealExpired(deal: ShoeDeal | null | undefined, season: number) {
  return !deal || season - deal.signed >= deal.years;
}

/** Royalty check for a season of signature-shoe sales */
export function royaltyCheck(deal: ShoeDeal, fans: number) {
  if (!deal.shoe) return 0;
  return Math.round((fans * 40 * deal.royalty) / 100 / 10) * 10;
}

/* ---------------------------------------------------------- scenes */

export function dealIntro(first: string, current: ShoeDeal | null | undefined): Line[] {
  if (current)
    return [
      { who: "agent", text: `Your ${BRANDS[current.brand].name} deal is up. They want to re-up, and they're not the only ones calling.` },
      { who: "agent", text: "Same drill: two contracts, one signature. Read the royalty line this time." },
      { who: "imani", text: "Whatever you pick, I'm shooting the campaign. That's non-negotiable." },
    ];
  return [
    { who: "agent", text: `${first}. Two sneaker companies called this morning. Both want you in their shoes.` },
    { who: "agent", text: "VYRO Athletics: big money up front, stores everywhere. VANTA: built different, pays per game and bets on you early." },
    { who: "mom", text: "Just make sure they're comfortable. And that they send some to your mother." },
    { who: "imani", text: "VYRO or VANTA? Choose wisely. I'm the one shooting the ad." },
  ];
}

export function dealSigned(deal: ShoeDeal): Line[] {
  const b = BRANDS[deal.brand];
  return [
    { who: "agent", text: `Done. You're a ${b.name} ${TIER_LABEL[deal.tier]}. ₵${deal.bonus.toLocaleString()} just hit your account.` },
    deal.shoe
      ? { who: "narrator", text: `The ${deal.shoe} drops this season. ${deal.brand === "vanta" ? "Built different." : "Built for more."}` }
      : { who: "narrator", text: `A box of ${deal.brand === "vanta" ? "VANTA 01s" : "Waples 1s"} is waiting in your locker.` },
    { who: "imani", text: "Campaign shoot is Thursday. Wear the shoes. Smile once." },
  ];
}
