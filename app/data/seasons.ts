import { EXTRA_BALLERS, type Baller } from "./characters";
import { DRE, type SceneCtx } from "./career";
import { EBL_TEAMS, getTeam, type EblTeam } from "./ebl";
import type { Line } from "./story";

/**
 * Life after the rookie year: offseasons, contracts, awards, a rivalry with
 * Dre that follows you through the league, the Imani storyline (moving in,
 * the proposal, the wedding) and a Hall of Fame ending.
 */

export type SeasonResult = "champion" | "finals" | "semis" | "missed";

export interface SeasonRecord {
  season: number;
  teamId: string;
  w: number;
  l: number;
  result: SeasonResult;
  awards: string[];
  salary: number;
  ovr: number;
}

export const MAX_SEASONS = 12;
/** Seasons from which you may choose to retire */
export const CAN_RETIRE_FROM = 5;
/** Athletic decline starts this season */
export const AGING_FROM = 8;

export function seasonTitle(season: number) {
  if (season <= 1) return "Rookie Season";
  if (season === 2) return "Sophomore Season";
  return `Season ${season}`;
}

export const RESULT_LABEL: Record<SeasonResult, string> = {
  champion: "🏆 EBL Champions",
  finals: "Lost in the Finals",
  semis: "Lost in the Semifinals",
  missed: "Missed the playoffs",
};

export function awardsFor(season: number, w: number, result: SeasonResult, allStar: boolean): string[] {
  const out: string[] = [];
  if (result === "champion") out.push("Finals MVP");
  if (w >= 9 || (w >= 8 && result === "champion")) out.push("EBL MVP");
  if (season === 1 && w >= 6) out.push("Rookie of the Year");
  if (w >= 7) out.push("All-EBL First Team");
  else if (w >= 6) out.push("All-EBL Second Team");
  if (allStar) out.push("All-Star");
  return out;
}

/** Dre Cole in his EBL uniform. He gets better every year too. */
export function dreEbl(team: EblTeam, season: number): Baller {
  const lvl = (v: number) => Math.min(97, v + 18 + season * 2);
  const b: Baller = {
    ...DRE,
    id: "rival-dre-ebl",
    from: `${team.city} ${team.name}`,
    tagline: `${team.city} ${team.name}`,
    ratings: Object.fromEntries(
      Object.entries(DRE.ratings).map(([k, v]) => [k, lvl(v)]),
    ) as unknown as Baller["ratings"],
    look: {
      ...DRE.look,
      jersey: team.primary,
      jerseyTrim: team.secondary,
      shorts: team.primary,
      shortsStripe: team.secondary,
      soles: team.secondary,
    },
    accent: team.primary,
  };
  const i = EXTRA_BALLERS.findIndex((x) => x.id === b.id);
  if (i >= 0) EXTRA_BALLERS[i] = b;
  else EXTRA_BALLERS.push(b);
  return b;
}

/** Dre goes one pick before you (or right after, if you went first) */
export function dreTeamFor(pick: number, myTeamId?: string) {
  const order = [...EBL_TEAMS].sort((a, b) => a.rating - b.rating);
  const t = order[pick >= 2 ? pick - 2 : 1];
  return t.id === myTeamId ? order.find((x) => x.id !== myTeamId)! : t;
}

const first = (c: SceneCtx) => c.me.name.split(" ")[0];
const has = (c: SceneCtx, f: string) => !!c.flags?.includes(f);

/* ---------------------------------------------------------- season intros */

export function seasonIntro(c: SceneCtx): Line[] {
  const s = c.season ?? 1;
  const t = c.team!;
  const dre = c.dreTeam;
  const by: Record<number, Line[]> = {
    2: [
      { who: "narrator", text: `Year two. Nobody calls you "rookie" anymore, except Imani, on purpose.` },
      {
        who: "coach",
        text: `Last year you were a surprise. This year every team in the EBL has a folder on you. Get better.`,
      },
      {
        who: "dre",
        text: `${dre ? `The ${dre.name} play you twice this year` : "We play you twice this year"}. I've been in the gym all summer. Just so you know.`,
      },
    ],
    3: [
      { who: "narrator", text: `Season three. Your jersey is the best seller in ${t.city}.` },
      { who: "coach", text: "You're not the young guy anymore. You're the guy. The locker room follows you now." },
      { who: "agent", text: "Harbor Kicks wants a second signature shoe. The first one sold out in four minutes." },
    ],
    4: [
      { who: "narrator", text: "Season four. The MVP ladder has your name at the top in September." },
      { who: "mom", text: "I retired from the hospital. Now I have time to yell at your games in person. Every one." },
    ],
    5: [
      { who: "narrator", text: "Season five. Half the league grew up watching your high-school mixtape." },
      { who: "teammate", text: "Vet! Can you show me that step-back? The one you hit on Dre in the conference final?" },
    ],
  };
  const late: Line[] = [
    {
      who: "narrator",
      text: `${seasonLabelLong(s)}. The body takes longer to warm up. The mind has never been sharper.`,
    },
    { who: "coach", text: "Lead the young guys, pick your spots, and give me one more run." },
  ];
  const lines = by[s] ?? late;
  if (has(c, "married")) lines.push({ who: "imani", text: "Go to work. I'll be under the basket, like always." });
  else if (has(c, "together"))
    lines.push({ who: "imani", text: "New season, same seat. Try to smile in one photo this year." });
  return lines;
}

function seasonLabelLong(s: number) {
  const words = ["", "", "Year two", "Year three", "Year four", "Year five", "Year six", "Year seven", "Year eight"];
  return words[s] ?? `Year ${s}`;
}

/* ---------------------------------------------------------- in-season events */

export interface SeasonEvent {
  id: string;
  /** Unlocks at or after this week of the season */
  week: number;
  when(c: SceneCtx, s: number): boolean;
  title: string;
  set?: string;
  bonus?: { crowns?: number; sp?: number; flag?: string };
  lines(c: SceneCtx, s: number): Line[];
}

export const SEASON_EVENTS: SeasonEvent[] = [
  {
    id: "moving-in",
    week: 3,
    title: "Home",
    set: "pier-9",
    when: (c, s) => s >= 2 && has(c, "together") && !has(c, "moved-in"),
    bonus: { flag: "moved-in" },
    lines: (c) => [
      { who: "imani", text: "So. My lease is up. And your apartment has a darkroom-shaped closet." },
      {
        who: "imani",
        text: "Are you asking me, or am I asking you?",
        choices: [
          {
            text: "I'm asking. Move in with me.",
            effect: { love: 1 },
            reply: [{ who: "imani", text: "I'm bringing my plants. All forty of them." }],
          },
          {
            text: "You had me at darkroom.",
            effect: { love: 1 },
            reply: [{ who: "imani", text: "Smooth. Help me carry boxes, superstar." }],
          },
        ],
      },
      {
        who: "dre",
        text: `Heard you two are living together. Cool. I'm going to be over every Sunday, ${first(c)}. Every. Sunday.`,
      },
    ],
  },
  {
    id: "kane-bid",
    week: 6,
    title: "Front Office",
    when: (c, s) => s === 2 && c.team?.id !== "lva",
    lines: (c) => [
      { who: "narrator", text: `Rumors all week: Victor Kane is trying to buy the ${c.team!.city} ${c.team!.name}.` },
      { who: "architect", text: "Every franchise has a price. Yours is lower than you'd think. Mine never is." },
      {
        who: "architect",
        text: "Say the word and I keep your team where it is, with you as its owner-in-waiting.",
        choices: [
          {
            text: "The city owns this team. Not you.",
            effect: { fans: 10 },
            reply: [{ who: "architect", text: "Noble. We'll see how long noble lasts." }],
          },
          { text: "I just play. Talk to my agent.", effect: { chemistry: 3 } },
        ],
      },
      { who: "agent", text: "For the record, I told him no in three languages." },
    ],
  },
  {
    id: "proposal",
    week: 5,
    title: "Pier 9",
    set: "pier-9",
    when: (c, s) => s >= 3 && has(c, "together") && c.love >= 5 && !has(c, "engaged"),
    lines: (c) => [
      { who: "narrator", text: "Pier 9 at sunset. The court where your first date ended in a free-throw contest." },
      { who: "imani", text: `Why do you look nervous? You shoot free throws in front of twenty thousand people.` },
      {
        who: "me",
        text: "Because this one counts more.",
        choices: [
          {
            text: "(Kneel) Imani Cole. Marry me?",
            effect: { love: 2, fans: 8, flag: "engaged" },
            reply: [
              { who: "imani", text: "...Yes. YES. Get up, you'll ruin your knees, we need those." },
              {
                who: "dre",
                text: `(from behind the fence) SHE SAID YES! ...Sorry. I was never here. Welcome to the family, ${first(c)}.`,
              },
            ],
          },
          {
            text: "(Lose your nerve) ...Want to shoot free throws?",
            reply: [{ who: "imani", text: "Always. ...You okay? You're sweating." }],
          },
        ],
      },
    ],
  },
  {
    id: "wedding",
    week: 2,
    title: "The Wedding",
    set: "the-crown",
    when: (c, s) => s >= 4 && has(c, "engaged") && !has(c, "married"),
    bonus: { flag: "married", crowns: 1000 },
    lines: (c) => [
      { who: "narrator", text: "The Crown rooftop, strung with lights. Half the EBL is in folding chairs." },
      {
        who: "dre",
        text: `Best man speech. ${first(c)} beat me in high school, in college, and in front of my own mother at Sunday dinner.`,
      },
      {
        who: "dre",
        text: "And he's the only guy I'd ever trust with my sister. Don't make me regret it. To the Coles!",
      },
      { who: "mom", text: "I'm not crying. The wind is crying. On the roof." },
      { who: "imani", text: "I got a photographer for today, so for once I'm in the picture." },
      { who: "narrator", text: "Just married. (+₵1,000 in wedding gifts, mostly from teammates who lost bets.)" },
    ],
  },
  {
    id: "all-star",
    week: 7,
    title: "All-Star",
    when: (c, s) => s >= 2 && c.fans >= 30 + s * 6,
    bonus: { crowns: 1500, sp: 10 },
    lines: (c, s) => [
      { who: "agent", text: `All-Star, year ${s}. The fans voted you a starter again.` },
      {
        who: "reporter",
        text: "Three-point contest or dunk contest this year?",
        choices: [
          { text: "Dunk contest. Obviously.", effect: { fans: 6 } },
          { text: "Three-point contest. Grown-man hoops.", effect: { chemistry: 3 } },
        ],
      },
      ...(c.dreTeam
        ? ([{ who: "dre", text: "Same team this weekend. Don't get used to passing me the ball." }] as Line[])
        : []),
    ],
  },
  {
    id: "mentor",
    week: 4,
    title: "The Vet",
    when: (c, s) => s >= 5 && !has(c, "mentored"),
    bonus: { sp: 15, flag: "mentored" },
    lines: () => [
      {
        who: "teammate",
        text: "Rookie here. Everyone says to ask you. How do you handle all of it? The noise, the money, the pressure?",
      },
      {
        who: "me",
        text: "Here's what I wish somebody told me.",
        choices: [
          { text: "Keep your circle small and your mom close.", effect: { chemistry: 6 } },
          { text: "Get in the gym before anyone else. Every day.", effect: { chemistry: 4 } },
          {
            text: "Marry the photographer.",
            effect: { love: 1 },
            reply: [{ who: "teammate", text: "...Is that a metaphor?" }],
          },
        ],
      },
      { who: "narrator", text: "Teaching it makes you better at it. (+15 SP)" },
    ],
  },
  {
    id: "banner",
    week: 5,
    title: "Legacy",
    when: (c, s) => s >= 8 && !has(c, "banner"),
    bonus: { sp: 10, flag: "banner" },
    lines: (c) => [
      {
        who: "coach",
        text: `The owners called. When you're done, your number goes to the rafters in ${c.team!.city}. Nobody wears #${c.me.number} again.`,
      },
      { who: "mom", text: "I told them I want a seat right under it." },
    ],
  },
];

/* ---------------------------------------------------------- rivalry week */

export function eblPregame(c: SceneCtx): Line[] {
  const s = c.season ?? 1;
  const t = c.dreTeam!;
  const byYear: Line[][] = [
    [
      {
        who: "narrator",
        text: `Rivalry Week. ${c.team!.city} vs ${t.city}. National broadcast, sold out in six minutes.`,
      },
      { who: "dre", text: "First time in the league against each other. They're calling it the Thanksgiving Game." },
      { who: "me", text: "Let's give your mom something to argue about." },
    ],
    [
      { who: "narrator", text: `Rivalry Week, year ${s}. The ${t.name} fans brought signs about your haircut.` },
      { who: "dre", text: "I spent the whole summer guarding a guy your height. I know every move you've got." },
      { who: "me", text: "Then you know what's coming. Still can't stop it." },
    ],
  ];
  const lines = s === 1 ? byYear[0] : byYear[1];
  return [
    ...lines,
    {
      who: "dre",
      text: "Loser buys the whole family dinner.",
      choices: [
        { text: "Hope you brought your wallet.", effect: { fans: 4 } },
        { text: "Deal. Let's go, brother.", effect: { chemistry: 3 } },
      ],
    },
    ...(has(c, "married") || has(c, "engaged")
      ? ([{ who: "imani", text: "I'm wearing both jerseys, sewn together. Nobody look at me." }] as Line[])
      : []),
  ];
}

/* ---------------------------------------------------------- offseason */

export function awardsCeremony(c: SceneCtx, rec: SeasonRecord): Line[] {
  const t = getTeam(rec.teamId);
  const lines: Line[] = [
    {
      who: "narrator",
      text: `${seasonTitle(rec.season)} in the books: ${t.city} ${t.name}, ${rec.w}-${rec.l}. ${RESULT_LABEL[rec.result]}.`,
    },
  ];
  if (rec.awards.length) {
    lines.push({ who: "commish", text: `This year's honors for ${c.me.name}: ${rec.awards.join(", ")}.` });
    if (rec.awards.includes("EBL MVP")) {
      lines.push({ who: "mom", text: "MVP. My baby is the MOST VALUABLE. I'm getting it tattooed." });
      lines.push({ who: "dre", text: "MVP? ...Fine. You earned it. I'll get it next year." });
    }
  } else {
    lines.push({ who: "coach", text: "No trophies this year. Take a week off, then get back in the gym." });
  }
  lines.push({ who: "agent", text: "Now, the fun part: the offseason. Let's talk about your contract." });
  return lines;
}

export interface Offer {
  teamId: string;
  salary: number;
  pitch: string;
  resign?: boolean;
}

/** Contract offers: your team re-signs you, two others and (sometimes) Victor Kane bid */
export function contractOffers(
  teamId: string,
  dreTeamId: string | undefined,
  season: number,
  salary: number,
  ovr: number,
  fans: number,
): Offer[] {
  const base = Math.round((salary * 1.25 + ovr * 3 + fans * 2) / 10) * 10;
  const offers: Offer[] = [
    { teamId, salary: base, pitch: "Stay home. The city built this team around you.", resign: true },
  ];
  const others = EBL_TEAMS.filter((t) => t.id !== teamId && t.id !== dreTeamId && t.id !== "lva");
  const pickN = (n: number) => others[(season * 7 + n * 5 + ovr) % others.length];
  const a = pickN(1);
  let b = pickN(2);
  if (b.id === a.id) b = others[(others.indexOf(a) + 3) % others.length];
  offers.push({
    teamId: a.id,
    salary: Math.round((base * 1.12) / 10) * 10,
    pitch: `The ${a.name} want a leader. Starter's minutes and the keys to the offense.`,
  });
  offers.push({
    teamId: b.id,
    salary: Math.round((base * 1.2) / 10) * 10,
    pitch: `The ${b.name} are one star away from a title. You're the star.`,
  });
  if (season >= 2 && teamId !== "lva" && dreTeamId !== "lva")
    offers.push({
      teamId: "lva",
      salary: Math.round((base * 1.6) / 10) * 10,
      pitch: "Victor Kane's supermax. The most money in league history, and you play for him.",
    });
  return offers;
}

export function signingLines(c: SceneCtx, offer: Offer, from: EblTeam): Line[] {
  const t = getTeam(offer.teamId);
  if (offer.resign)
    return [
      { who: "agent", text: `Done. You re-signed with the ${t.name} for ₵${offer.salary} a game.` },
      { who: "coach", text: "Good. I didn't want to learn to game-plan against you." },
    ];
  if (t.id === "lva")
    return [
      { who: "architect", text: "Welcome to Las Vegas. I always get what I build for." },
      { who: "imani", text: "...Kane? Really? Okay. Just promise me you're still you." },
      { who: "dre", text: `You're an Architect now? Wow. Rivalry Week just got personal.` },
    ];
  return [
    { who: "agent", text: `Signed. You're a ${t.city} ${t.name}, ₵${offer.salary} a game.` },
    { who: "narrator", text: `${from.city} fans are burning jerseys. ${t.city} fans are buying them twice as fast.` },
  ];
}

export function hallOfFame(c: SceneCtx, history: SeasonRecord[]): Line[] {
  const rings = history.filter((h) => h.result === "champion").length;
  const mvps = history.filter((h) => h.awards.includes("EBL MVP")).length;
  const allStars = history.filter((h) => h.awards.includes("All-Star")).length;
  return [
    {
      who: "narrator",
      text: `${history.length} seasons. ${rings} ${rings === 1 ? "ring" : "rings"}. ${mvps} MVP${mvps === 1 ? "" : "s"}. ${allStars} All-Star${allStars === 1 ? "" : "s"}.`,
    },
    { who: "commish", text: `The Elite Basketball League Hall of Fame welcomes ${c.me.name}, "${c.me.nickname}".` },
    {
      who: "hscoach",
      text: "I still have the film from your senior year. You forgot your mouthguard in every single game.",
    },
    {
      who: "dre",
      text: "I've been beating this guy in my head for fifteen years. Never once in real life. Proudest loser in the building.",
    },
    ...(has(c, "married")
      ? ([
          { who: "imani", text: "I took a photo of every game you ever played. Tonight I'm putting the camera down." },
        ] as Line[])
      : ([{ who: "imani", text: "I shot your first game and your last. Not a bad career for both of us." }] as Line[])),
    { who: "mom", text: "THAT'S MY BABY. STILL MY BABY." },
    { who: "narrator", text: "From a high-school gym to the Hall of Fame. Thank you for playing." },
  ];
}
