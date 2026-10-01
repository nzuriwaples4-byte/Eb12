import { cityFor } from "./cities";
import type { Line } from "./story";

/**
 * Real estate in your home city, and the family that fills it. Buy with
 * Crowns; more bedrooms means room for kids (up to three).
 */

export interface HomeListing {
  tier: 1 | 2 | 3 | 4 | 5;
  name: string;
  kind: string;
  neighborhood: string;
  price: number;
  beds: number;
  baths: number;
  blurb: string;
}

export interface OwnedHome {
  tier: HomeListing["tier"];
  name: string;
  teamId: string;
  bought: number;
}

export interface Kid {
  name: string;
  girl: boolean;
  /** EBL season they were born */
  born: number;
  skin: string;
  hair: "fade" | "twists" | "afro-puff" | "braids" | "cap";
}

const HOODS: Record<string, string[]> = {
  atl: ["Midtown", "Old Fourth Ward", "Decatur", "Buckhead", "Buckhead"],
  nyc: ["Harlem", "Brooklyn Heights", "Park Slope", "Upper East Side", "Tribeca"],
  lva: ["Downtown", "Summerlin", "Henderson", "The Ridges", "MacDonald Highlands"],
  sds: ["Gaslamp", "North Park", "Mission Hills", "La Jolla", "Rancho Santa Fe"],
  phx: ["Roosevelt Row", "Arcadia", "Tempe", "Paradise Valley", "Paradise Valley"],
  pit: ["Strip District", "Lawrenceville", "Shadyside", "Fox Chapel", "Sewickley Heights"],
  sea: ["Capitol Hill", "Ballard", "Queen Anne", "Medina", "Mercer Island"],
  mia: ["Brickell", "Wynwood", "Coconut Grove", "Coral Gables", "Star Island"],
  chi: ["River North", "Wicker Park", "Lincoln Park", "Gold Coast", "Lake Forest"],
  hou: ["Midtown", "The Heights", "Montrose", "River Oaks", "River Oaks"],
  por: ["Pearl District", "Alberta Arts", "Laurelhurst", "West Hills", "Lake Oswego"],
  las: ["Downtown LA", "Silver Lake", "Studio City", "Bel Air", "Beverly Hills"],
};

const TIERS: Omit<HomeListing, "neighborhood">[] = [
  { tier: 1, name: "City Condo", kind: "Condo", price: 3000, beds: 1, baths: 1, blurb: "Floor-to-ceiling windows, ten minutes from the arena." },
  { tier: 2, name: "Townhouse", kind: "Townhouse", price: 8000, beds: 2, baths: 2, blurb: "Rooftop deck and a garage for the first real car." },
  { tier: 3, name: "Family Home", kind: "House", price: 16000, beds: 4, baths: 3, blurb: "Big backyard, good schools, a hoop over the garage." },
  { tier: 4, name: "Mansion", kind: "Mansion", price: 35000, beds: 6, baths: 6, blurb: "Pool, home theater, and a trophy room waiting to be filled." },
  { tier: 5, name: "Estate", kind: "Estate", price: 70000, beds: 8, baths: 9, blurb: "Gated, with a full indoor court. The house a legend retires in." },
];

export function listings(teamId: string): HomeListing[] {
  const hoods = HOODS[teamId] ?? ["Downtown", "Uptown", "Suburbs", "The Hills", "Lakefront"];
  return TIERS.map((t, i) => ({ ...t, neighborhood: hoods[i] }));
}

export function homeName(h: OwnedHome) {
  const l = listings(h.teamId)[h.tier - 1];
  return `${l.neighborhood} ${l.name}`;
}

export function bedsFor(tier: number) {
  return TIERS[tier - 1]?.beds ?? 1;
}

/** Kids fit one per spare bedroom, up to three */
export function roomForKids(home: OwnedHome | null | undefined) {
  return home ? Math.min(3, bedsFor(home.tier) - 1) : 0;
}

export function kidAge(k: Kid, season: number) {
  // Three EBL seasons ≈ a few years of growing up in game time
  return Math.max(0, (season - k.born) * 2);
}

export const BOY_NAMES = ["Jaylen", "Malik", "Kairo", "Josiah", "Amari", "Zion"];
export const GIRL_NAMES = ["Nyla", "Amara", "Zuri", "Kenzie", "Aaliyah", "Simone"];

/** Scene: Jaailyah's big news */
export function babyNews(first: string, kids: Kid[], married: boolean): Line[] {
  if (kids.length)
    return [
      { who: "imani", text: `${first}... sit down. No, really, sit down.` },
      { who: "imani", text: `${kids[0].name} is going to be a big ${kids[0].girl ? "sister" : "brother"}.` },
      { who: "mom", text: "I KNEW it. I said it at Sunday dinner and nobody believed me." },
    ];
  return [
    { who: "narrator", text: "Late night. The house is quiet. Jaailyah is holding something behind her back." },
    { who: "imani", text: `${first}. I took three tests. All three say the same thing.` },
    { who: "imani", text: married ? "We're having a baby." : "We're having a baby. Ready or not." },
    { who: "mom", text: "A GRANDBABY? I'm moving in. Don't argue, I already packed." },
  ];
}

/** Scene: family time at home (scales with kids' ages) */
export function familyTime(first: string, kids: Kid[], season: number, house: string): Line[] {
  const lines: Line[] = [{ who: "narrator", text: `${house}. No cameras, no film session. Just home.` }];
  if (!kids.length) {
    lines.push({ who: "imani", text: "Movie night. You pick the movie, I pick the snacks. That's the deal." });
    return lines;
  }
  const [a, b] = kids;
  const ageA = kidAge(a, season);
  lines.push(
    ageA < 2
      ? { who: "imani", text: `${a.name} fell asleep on your chest during the highlights again. Don't move.` }
      : ageA < 6
        ? { who: "kid1", text: `Daddy! Watch me dunk! (${a.name} dunks on the toy hoop and screams.)` }
        : { who: "kid1", text: "Can we play one-on-one? And you can't jump. Or use your left hand." },
  );
  if (b)
    lines.push({
      who: "kid2",
      text: kidAge(b, season) < 3 ? `(${b.name} is chewing on your championship hat.)` : `I'm on ${a.name}'s team!`,
    });
  lines.push({ who: "imani", text: `This is my favorite part of the season, ${first}. Right here.` });
  return lines;
}

/** Home set id for the cutscene stage: "<teamId>:<tier>" */
export function homeSetId(h: OwnedHome) {
  return `${h.teamId}:${h.tier}`;
}

export function homeCity(h: OwnedHome) {
  return cityFor(h.teamId);
}
