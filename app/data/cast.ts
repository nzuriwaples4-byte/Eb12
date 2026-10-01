import { BALLERS, EXTRA_BALLERS, getBaller, type Baller, type HairStyle } from "./characters";
import type { SpeakerId } from "./story";

/**
 * 3D stand-ins for the non-player cast so cutscenes can stage everyone.
 * They reuse the procedural baller body with casual colors.
 */
function castMember(
  id: string,
  name: string,
  height: number,
  skin: string,
  hair: HairStyle,
  hairColor: string,
  top: string,
  bottom: string,
  extra: Partial<Baller["look"]> = {},
): Baller {
  const base = BALLERS[1];
  const b: Baller = {
    ...base,
    id,
    name,
    nickname: name.toUpperCase(),
    height,
    look: {
      ...base.look,
      skin,
      hair,
      hairColor,
      hairTip: undefined,
      jersey: top,
      jerseyTrim: top,
      number: "",
      shorts: bottom,
      shortsStripe: bottom,
      shoes: "#f2f2f2",
      soles: "#d8d8d8",
      chain: false,
      earrings: false,
      build: 0.85,
      ...extra,
    },
    ebl: true,
  };
  EXTRA_BALLERS.push(b);
  return b;
}

castMember("cast-nia", "Nia", 1.66, "#6b4430", "braids", "#1a120c", "#e0a82a", "#2b3a55", { earrings: true });
castMember("cast-imani", "Jaailyah", 1.72, "#5a3625", "afro-puff", "#140e0a", "#e8dcc8", "#3b5a8a", {
  earrings: true,
  hairTip: undefined,
});
castMember("cast-mom", "Mom", 1.68, "#6b4430", "afro-puff", "#2a1c12", "#b3122a", "#1b1b22", { earrings: true });
castMember("cast-coach", "Coach", 1.9, "#c68c63", "shaved", "#1a1410", "#1d2f5a", "#1b1b22", {
  beard: "#5a4a40",
  build: 1.1,
});
castMember("cast-hscoach", "Coach Bell", 1.85, "#4a2d20", "fade", "#1a1512", "#12203a", "#8a8f99", { build: 1.1 });
castMember("cast-collegecoach", "Coach Okafor", 1.93, "#3e2519", "shaved", "#120c09", "#2ec4b6", "#0e2a33", {
  build: 1.05,
});
castMember("cast-agent", "Tasha", 1.7, "#e2b894", "silver-part", "#1a1410", "#16161b", "#16161b", { earrings: true });
castMember("cast-reporter", "Reporter", 1.78, "#a86f4c", "fade", "#1a1410", "#5a6a80", "#2b2f3a");
castMember("cast-commish", "Commissioner", 1.83, "#e2b894", "shaved", "#8f8a86", "#0c0c0f", "#0c0c0f", {
  beard: "#8f8a86",
});
// Jaailyah Carter: her own look (long honey-highlighted waves, Peachtree Heights
// letterman jacket, fitted jeans, VYRO Lifestyle 1s)
castMember("cast-jaailyah", "Jaailyah", 1.68, "#7a4a33", "long-waves", "#1b120d", "#12203a", "#2e4a78", {
  hairTip: "#b87a3e",
  figure: "feminine",
  sleeves: "#e9e2d2",
  jerseyTrim: "#8ec3ee",
  pants: "#2e4a78",
  shoes: "#f2f2f4",
  soles: "#1a1a20",
  earrings: true,
  build: 0.78,
});
castMember("cast-producer", "Nova", 1.75, "#8d5a3b", "braids", "#2a0f3a", "#2a1640", "#16161b", {
  chain: true,
  earrings: true,
});
castMember("cast-teammate", "Teammate", 1.98, "#6b4430", "twists", "#140f0c", "#00b4d8", "#00b4d8");

/** Which 3D actor represents a speaker */
export function actorFor(who: SpeakerId): string | null {
  const direct = [
    "kairo",
    "deuce",
    "brick",
    "silk",
    "queen",
    "monarch",
    "ricochet",
    "metronome",
    "titan",
    "echo",
    "architect",
    "me",
  ];
  if (direct.includes(who)) return who;
  if (who === "dre") return "rival-dre";
  if (who === "kid1" || who === "kid2" || who === "kid3") return `kid-${who.slice(3)}`;
  if (who === "imani") return "cast-jaailyah";
  if (
    [
      "nia",
      "imani",
      "mom",
      "coach",
      "hscoach",
      "collegecoach",
      "agent",
      "reporter",
      "commish",
      "teammate",
      "producer",
    ].includes(who)
  )
    return `cast-${who}`;
  return null; // narrator, announcer
}

export function castExists(id: string) {
  return getBaller(id).id === id;
}

/** Your kids as 3D cast members: they grow a little every season */
export function registerKids(
  kids: { name: string; girl: boolean; born: number; skin: string; hair: HairStyle }[],
  season: number,
) {
  kids.forEach((k, i) => {
    const age = Math.max(0, (season - k.born) * 2);
    const height = Math.min(1.55, 0.78 + age * 0.07);
    const tops = ["#ffd166", "#7bdff2", "#b8f2a6"];
    const b = castMember(`kid-${i + 1}`, k.name, height, k.skin, k.hair, "#140e0a", tops[i % 3], "#2b3a55", {
      build: 0.62,
      figure: k.girl ? "feminine" : undefined,
      earrings: k.girl,
    });
    // castMember appends; keep one entry per kid
    const all = EXTRA_BALLERS.filter((x) => x.id === b.id);
    if (all.length > 1) EXTRA_BALLERS.splice(EXTRA_BALLERS.indexOf(all[0]), 1);
  });
}
