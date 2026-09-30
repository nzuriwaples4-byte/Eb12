import { BALLERS, EXTRA_BALLERS, type Baller, type HairStyle, type Look, type Ratings } from "./characters";
import { getTeam, type EblTeam } from "./ebl";
import type { Line } from "./story";
import { VENUES, type Venue } from "./venues";

/**
 * EBL Career ("Road to the League"): create your own baller and play
 * High School → College → EBL Draft → Rookie Season, with a life off the
 * court (Imani, press, endorsements, money) along the way.
 */

export type Archetype = "slasher" | "sniper" | "floor-general" | "lockdown" | "big";
export type Stage = "create" | "hs" | "college-pick" | "college" | "draft" | "pro" | "done";

export interface MyPlayer {
  name: string;
  nickname: string;
  archetype: Archetype;
  heightIn: number;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  number: string;
}

export const ARCHETYPES: Record<Archetype, { label: string; blurb: string; ratings: Ratings }> = {
  slasher: {
    label: "Slasher",
    blurb: "Explosive first step, lives at the rim.",
    ratings: { speed: 74, shooting: 58, three: 50, finishing: 72, dunk: 72, handles: 66, defense: 58, block: 48 },
  },
  sniper: {
    label: "Sniper",
    blurb: "Deep range and a pure release.",
    ratings: { speed: 66, shooting: 72, three: 74, finishing: 56, dunk: 46, handles: 62, defense: 56, block: 40 },
  },
  "floor-general": {
    label: "Floor General",
    blurb: "Handles, vision and pesky defense.",
    ratings: { speed: 70, shooting: 64, three: 60, finishing: 60, dunk: 50, handles: 76, defense: 66, block: 40 },
  },
  lockdown: {
    label: "Lockdown",
    blurb: "Glue-guy defender who takes the other team's best player.",
    ratings: { speed: 70, shooting: 58, three: 56, finishing: 58, dunk: 56, handles: 58, defense: 78, block: 58 },
  },
  big: {
    label: "Big",
    blurb: "Rim protector and lob finisher.",
    ratings: { speed: 56, shooting: 54, three: 36, finishing: 74, dunk: 78, handles: 48, defense: 66, block: 76 },
  },
};

export interface College {
  id: string;
  name: string;
  /** Short city/state line shown above the mascot on the signing-day board */
  city: string;
  mascot: string;
  short: string;
  primary: string;
  secondary: string;
  pitch: string;
  /** Minimum high-school wins for an offer */
  needWins: number;
  venueId: string;
}

function college(
  id: string,
  city: string,
  mascot: string,
  short: string,
  primary: string,
  secondary: string,
  needWins: number,
  pitch: string,
): College {
  return {
    id,
    name: `${city} ${mascot}`,
    city,
    mascot,
    short,
    primary,
    secondary,
    pitch,
    needWins,
    venueId: `college-${id}`,
  };
}

/** Signing Day board: two columns like the old-school recruiting screens */
export const COLLEGES: College[] = [
  college(
    "meridian-state",
    "Meridian State",
    "Mariners",
    "MSU",
    "#1f8fff",
    "#f2f4f8",
    0,
    "Stay home. Play in front of your city. We'll run the offense through you on day one.",
  ),
  college(
    "coastal-tech",
    "Coastal Tech",
    "Current",
    "CT",
    "#2ec4b6",
    "#0e2a33",
    2,
    "Best development program on the coast. Three of our guys went first round last year.",
  ),
  college(
    "kane-university",
    "Kane University",
    "Architects",
    "KU",
    "#ff3a6e",
    "#16161b",
    3,
    "National TV every week, a private jet, and Victor Kane's personal attention. You'll want for nothing.",
  ),
  college(
    "silver-lake",
    "Silver Lake State",
    "Wolves",
    "SLS",
    "#b8c4d6",
    "#1b2436",
    1,
    "Blue-collar defense, packed gym, and the loudest student section in the conference.",
  ),
  college(
    "bayline",
    "Bayline College",
    "Gulls",
    "BAY",
    "#00b4d8",
    "#f7f3e8",
    1,
    "We play fast. You'll get up forty shots a game and your own highlight reel by November.",
  ),
  college(
    "redwood",
    "Redwood U",
    "Lumberjacks",
    "RWU",
    "#2f7d3a",
    "#f2e2b8",
    0,
    "Small school, big minutes. Starting lineup from your first practice, guaranteed.",
  ),
  college(
    "summit-am",
    "Summit A&M",
    "Rams",
    "SAM",
    "#7a1f2b",
    "#e8c872",
    2,
    "Five straight tournaments. Our coach has sent eleven guards to the league.",
  ),
  college(
    "ironvale",
    "Ironvale",
    "Miners",
    "IRV",
    "#e2b23a",
    "#1b1b22",
    0,
    "Tough town, tough team. Come build something with us from the ground up.",
  ),
  college(
    "crescent-city",
    "Crescent City",
    "Tigers",
    "CCU",
    "#ff7a1a",
    "#1d1a3a",
    2,
    "Music, food, and a sold-out arena every night. You'll love it here, and so will the scouts.",
  ),
  college(
    "northern-pines",
    "Northern Pines",
    "Huskies",
    "NPU",
    "#1d2f5a",
    "#e8e8ea",
    3,
    "Blue-blood program. Two national titles this decade. We only offer players we think can win a third.",
  ),
];

function gymVenue(
  id: string,
  name: string,
  district: string,
  primary: string,
  theme: Venue["theme"],
  crowd: number,
): Venue {
  return {
    id,
    name,
    district,
    theme,
    timeOfDay: "Game night",
    sky: ["#07080d", "#141826"],
    fog: "#0c0e16",
    fogDensity: 0.008,
    floor: "#c08a52",
    paint: "#c99a5e",
    paintAlt: primary,
    line: "#ffffff",
    wet: false,
    sun: { color: "#ffffff", intensity: 1.5, dir: [0.1, 1, 0.2] },
    hemi: { sky: "#eaf0ff", ground: "#3a2c20", intensity: 0.95 },
    lamps: { color: "#ffffff", intensity: 0 },
    crowd,
    storm: false,
    music: { bpm: 96, root: 43, mood: "bright" },
    accent: primary,
  };
}

const hsGym: Venue = {
  ...gymVenue("hs-gym", "Harbor Heights High", "Home of the Harbor Heights Mariners", "#8ec3ee", "school", 70),
  floor: "#d9b27c",
  paint: "#d9b27c",
  line: "#6a4424",
  hemi: { sky: "#fff6ea", ground: "#6a4a2a", intensity: 1.1 },
};
VENUES.push(
  hsGym,
  ...COLLEGES.map((col) =>
    gymVenue(col.venueId, `${col.city} Arena`, `Home of the ${col.name}`, col.primary, "arena", 70),
  ),
);

/** Opponents for the amateur stages */
function amateur(
  id: string,
  name: string,
  nickname: string,
  team: string,
  color: string,
  level: number,
  height: number,
  hair: HairStyle,
  skin: string,
): Baller {
  const base = BALLERS[1];
  const r = (bias = 0) => Math.max(35, Math.min(95, level + bias));
  const b: Baller = {
    ...base,
    id,
    name,
    nickname,
    height,
    heightLabel: `${Math.floor((height * 39.37) / 12)}'${Math.round((height * 39.37) % 12)}"`,
    from: team,
    tagline: team,
    bio: `${name} plays for ${team}.`,
    ratings: {
      speed: r(4),
      shooting: r(),
      three: r(-4),
      finishing: r(2),
      dunk: r(height > 2 ? 10 : -6),
      handles: r(2),
      defense: r(),
      block: r(height > 2 ? 10 : -10),
    },
    special: { ...base.special, name: `${nickname} TIME`, color },
    look: {
      ...base.look,
      skin,
      hair,
      hairColor: "#140f0c",
      jersey: color,
      jerseyTrim: "#ffffff",
      number: String(10 + ((id.length * 7) % 40)),
      shorts: color,
      shortsStripe: "#ffffff",
      shoes: "#f5f5f5",
      soles: color,
      chain: false,
      build: height > 2 ? 1.25 : 0.95,
    },
    portrait: "key-art",
    ebl: true,
    accent: color,
  };
  const i = EXTRA_BALLERS.findIndex((x) => x.id === id);
  if (i >= 0) EXTRA_BALLERS[i] = b;
  else EXTRA_BALLERS.push(b);
  return b;
}

/**
 * Dre Cole: Imani's big brother and your rival from the first day of high
 * school to the EBL. Same face at every stop, different jersey.
 */
export const DRE = amateur("rival-dre", "Dre Cole", "DRE", "Northgate High", "#e8742a", 62, 1.98, "twists", "#5a3625");
const DRE_COLLEGE: Record<string, Baller> = {
  "silver-lake": amateur(
    "rival-dre-sls",
    "Dre Cole",
    "DRE",
    "Silver Lake State",
    "#b8c4d6",
    73,
    1.98,
    "twists",
    "#5a3625",
  ),
  bayline: amateur("rival-dre-bay", "Dre Cole", "DRE", "Bayline College", "#00b4d8", 73, 1.98, "twists", "#5a3625"),
};

/** Where Dre signs: wherever you didn't */
export function dreCollege(myCollegeId?: string) {
  return COLLEGES.find((x) => x.id === (myCollegeId === "silver-lake" ? "bayline" : "silver-lake"))!;
}

export const HS_GAMES = [
  {
    opp: amateur("hs-westside", "Tyrell Banks", "BANKS", "Westside Prep", "#b3122a", 52, 1.85, "fade", "#6b4430"),
    label: "Season opener vs Westside Prep",
  },
  {
    opp: amateur("hs-stjude", "Connor Walsh", "WALSH", "St. Jude Academy", "#1d2f5a", 56, 1.93, "shaved", "#e2b894"),
    label: "Rivalry game vs St. Jude",
  },
  { opp: DRE, label: "City Championship vs Dre Cole & Northgate" },
];

export function collegeGamesFor(myCollegeId?: string) {
  const dc = dreCollege(myCollegeId);
  return [
    {
      opp: amateur("co-1", "Marcus Hale", "HALE", "Redwood U", "#2f7d3a", 64, 1.9, "fade", "#a86f4c"),
      label: "Conference opener vs Redwood U",
    },
    {
      opp: amateur("co-2", "Isaiah Stone", "STONE", "Summit A&M", "#7a1f2b", 68, 2.06, "braids", "#3e2519"),
      label: "Top-10 matchup vs Summit A&M",
    },
    {
      opp: amateur(
        "co-3",
        "Kairo Vance",
        "STATIC",
        "Streetball legend (exhibition)",
        "#1f8fff",
        74,
        1.93,
        "twists",
        "#6b4430",
      ),
      label: "Charity exhibition vs Kairo 'Static' Vance",
    },
    { opp: DRE_COLLEGE[dc.id], label: `Conference championship vs Dre Cole & ${dc.name}` },
  ];
}
export const COLLEGE_GAMES = collegeGamesFor();

/** Build (or refresh) the player's Baller so the engine can use it */
export function registerMyBaller(p: MyPlayer, ratings: Ratings, jersey: string, trim: string): Baller {
  const height = p.heightIn * 0.0254;
  const base = BALLERS[0];
  const look: Look = {
    skin: p.skin,
    hair: p.hair,
    hairColor: p.hairColor,
    jersey,
    jerseyTrim: trim,
    number: p.number,
    shorts: jersey,
    shortsStripe: trim,
    shoes: "#101218",
    soles: trim,
    build: p.archetype === "big" ? 1.28 : p.archetype === "slasher" || p.archetype === "lockdown" ? 1.04 : 0.94,
  };
  const b: Baller = {
    ...base,
    id: "me",
    name: p.name,
    nickname: p.nickname.toUpperCase(),
    height,
    heightLabel: `${Math.floor(p.heightIn / 12)}'${p.heightIn % 12}"`,
    from: "Harbor Heights",
    tagline: "Road to the EBL.",
    bio: `${p.name} is on the road to the EBL.`,
    ratings,
    special: {
      name: `${p.nickname.toUpperCase()} MODE`,
      style: "lightning",
      kind: p.archetype === "sniper" ? "three" : "dunk",
      color: jersey,
      description: "Your signature move.",
    },
    look,
    portrait: "key-art",
    model: undefined,
    taunts: ["Road to the league.", "Remember the name.", "Next up."],
    accent: jersey,
    ebl: true,
  };
  const i = EXTRA_BALLERS.findIndex((x) => x.id === "me");
  if (i >= 0) EXTRA_BALLERS[i] = b;
  else EXTRA_BALLERS.push(b);
  return b;
}

/* --------------------------------------------------------------- scenes */

export interface SceneCtx {
  me: MyPlayer;
  team?: EblTeam;
  college?: College;
  hsWins: number;
  collegeWins: number;
  pick: number;
  wins: number;
  losses: number;
  fans: number;
  love: number;
}

export const SCENES = {
  hsIntro: (c: SceneCtx): Line[] => [
    {
      who: "narrator",
      text: "Harbor Heights High. Senior year. The gym smells like popcorn and floor wax, and the bleachers are already full for a scrimmage.",
    },
    { who: "mom", text: `${c.me.name.split(" ")[0]}, you forgot your lunch. Again. And your mouthguard. Again.` },
    {
      who: "hscoach",
      text: "Coach Bell. Three games decide your senior year: the opener, St. Jude, and the City Championship.",
    },
    {
      who: "hscoach",
      text: "Scouts are in the stands for every one of them. Win and the offers come. Lose and they go watch somebody else.",
    },
    {
      who: "narrator",
      text: "Courtside, a girl with a camera is shooting warmups for the school paper. She lowers it when you walk by.",
    },
    { who: "imani", text: "You're the new starter? I'm Imani. Smile for once, it's for the yearbook." },
    {
      who: "imani",
      text: "Fair warning: my brother plays for Northgate. He says you're overrated.",
      choices: [
        {
          text: "Tell him I'll see him in the championship.",
          effect: { fans: 4 },
          reply: [{ who: "imani", text: "Oh, he's going to love that. I'm telling him word for word." }],
        },
        {
          text: "What do YOU think?",
          effect: { love: 1 },
          reply: [{ who: "imani", text: "I think I'll decide after I see you play." }],
        },
      ],
    },
    { who: "narrator", text: "After practice, a tall kid in an orange Northgate hoodie is waiting by your car." },
    {
      who: "dre",
      text: "Dre Cole. Imani's brother. Northgate's best player, and the only reason anybody watches the City Championship.",
    },
    { who: "dre", text: "Stay away from my sister. And bring your best in March. I'm taking your scholarship." },
    {
      who: "hscoach",
      text: "Ignore him. Or don't. Just win. So what kind of player are you going to be this year?",
      choices: [
        { text: "The kind that wins.", effect: { chemistry: 4 } },
        { text: "The kind they put on posters.", effect: { fans: 6 } },
      ],
    },
  ],
  hsWinAfter: (c: SceneCtx, game: number): Line[] =>
    (
      [
        [
          { who: "hscoach", text: "Good start. Film at seven tomorrow. Bring your mouthguard." },
          { who: "mom", text: "I screamed so loud they asked me to sit down. I did NOT sit down." },
          {
            who: "imani",
            text: "Your dunk is on the front page of the Harbor Herald. My photo. You owe me a milkshake.",
            choices: [
              {
                text: "Friday. The diner on 4th.",
                effect: { love: 1 },
                reply: [{ who: "imani", text: "It's a date. Don't tell Dre." }],
              },
              {
                text: "Put it on my tab.",
                reply: [{ who: "imani", text: "You don't have a tab. You have a mouthguard problem." }],
              },
            ],
          },
        ],
        [
          { who: "hscoach", text: "You beat St. Jude. Coastal Tech called me at halftime." },
          { who: "narrator", text: "Your phone buzzes. 214 new followers, and a message from an unknown number." },
          {
            who: "dre",
            text: "Saw you at the diner with my sister. Championship's in two weeks. I'm going to embarrass you in front of the whole city.",
          },
          {
            who: "dre",
            text: "Anything to say?",
            choices: [
              { text: "Bring your whole family. Oh wait.", effect: { fans: 6, love: -1 } },
              { text: "Respect, Dre. See you on the court.", effect: { chemistry: 4, flag: "dre-respect" } },
            ],
          },
        ],
        [
          {
            who: "narrator",
            text: "Harbor Heights beats Northgate for the City Championship. The student section storms the floor.",
          },
          { who: "dre", text: "...Good game. Don't let it go to your head. I'll see you in college." },
          { who: "imani", text: "My brother just shook your hand. That has never happened. Ever." },
          {
            who: "hscoach",
            text: `${c.hsWins} wins this season. The offers are on my desk. Go home and pick your future.`,
          },
        ],
      ] as Line[][]
    )[game] ?? [],
  hsLoss: (game: number): Line[] =>
    game === 2
      ? [
          { who: "dre", text: "City champs. Northgate. Say it with me." },
          { who: "imani", text: "Ignore him. You were better than the score. The scouts saw it too." },
          { who: "hscoach", text: "Shake it off. The offers will still come. Maybe not all of them." },
        ]
      : [{ who: "hscoach", text: "Shake it off. Film tomorrow. We learn and we go again." }],
  collegeOffers: (c: SceneCtx): Line[] => [
    { who: "narrator", text: "National Signing Day. The whole school packs the gym to watch you pick a hat." },
    { who: "mom", text: "Whatever you choose, I'm proud of you. Now choose fast, the cameras are rolling." },
    { who: "imani", text: "I'm going to Coastal for photojournalism. No pressure. None at all." },
    { who: "narrator", text: `You won ${c.hsWins} of 3 big games. The offers depend on it.` },
  ],
  collegeIntro: (c: SceneCtx): Line[] => [
    {
      who: "narrator",
      text: `${c.college!.name}. Freshman year. The arena seats 18,000 and they already know your name.`,
    },
    {
      who: "collegecoach",
      text: `Welcome to ${c.college!.short}. Four big games this season, and every EBL scout will be watching.`,
    },
    { who: "narrator", text: "At media day, a familiar photographer is laughing at your headshot face." },
    {
      who: "imani",
      text: "Relax your jaw. You look like you're being arrested. The Daily hired me. Small world, huh?",
    },
    {
      who: "imani",
      text: "Better?",
      choices: [
        {
          text: "Only if you take another one.",
          effect: { love: 1 },
          reply: [{ who: "imani", text: "...Okay. That one's actually good." }],
        },
        { text: "Just get the shot, please.", reply: [{ who: "imani", text: "Wow. All business. Noted." }] },
      ],
    },
    {
      who: "imani",
      text: `Oh, and Dre signed with ${dreCollege(c.college?.id).name}. Same conference. He circled your game on his calendar in red.`,
    },
    ...(c.college!.id === "kane-university"
      ? ([
          { who: "architect", text: "Welcome to my university. I only recruit players I plan to own someday." },
        ] as Line[])
      : []),
  ],
  collegeAfter: (c: SceneCtx, game: number): Line[] =>
    (
      [
        [{ who: "collegecoach", text: "One down. The conference noticed." }],
        [
          { who: "imani", text: "My photo of your dunk made the front page. You're welcome." },
          {
            who: "imani",
            text: "Want to celebrate? There's a taco truck outside the library.",
            choices: [
              { text: "Tacos with you? Obviously.", effect: { love: 1 } },
              { text: "I've got film. Rain check?", effect: { chemistry: 3 } },
            ],
          },
        ],
        [
          { who: "narrator", text: "Kairo 'Static' Vance jogs over after the exhibition and daps you up." },
          { who: "kairo", text: "You're nice. See you in the league next year. I'm declaring for the draft too." },
        ],
        [
          {
            who: "narrator",
            text: `Conference champions. Dre Cole sits on the ${dreCollege(c.college?.id).short} bench with a towel over his head.`,
          },
          {
            who: "dre",
            text: "Twice. You beat me twice. ...Take care of her, alright? She talks about you more than she talks about me.",
          },
          { who: "collegecoach", text: `${c.collegeWins} wins in the biggest games of the year. The EBL is calling.` },
          {
            who: "agent",
            text: "Tasha Kim. I'd like to be your agent. Declare for the draft and let me handle the rest.",
          },
        ],
      ] as Line[][]
    )[game] ?? [],
  collegeLoss: (c: SceneCtx, game: number): Line[] =>
    game === 3
      ? [
          { who: "dre", text: `${dreCollege(c.college?.id).short} takes the conference. Told you March was mine.` },
          { who: "imani", text: "He's going to be unbearable at Thanksgiving. You played great." },
          {
            who: "agent",
            text: "Tasha Kim. Scouts watch how you bounce back, not just how you win. Declare. I'll handle the rest.",
          },
        ]
      : [{ who: "collegecoach", text: "Tough one. Scouts watch how you bounce back, not just how you win." }],
  draft: (c: SceneCtx): Line[] => [
    { who: "narrator", text: "EBL Draft Night. Meridian Grand Theater." },
    { who: "mom", text: "I bought a new dress for this. If they don't call your name, I'm walking on stage myself." },
    { who: "narrator", text: "The first picks go by. Kairo Vance goes early to a big ovation." },
    { who: "commish", text: `With pick number ${Math.max(1, c.pick - 1)}... Dre Cole!` },
    { who: "dre", text: "Hey. You're next. Don't trip on the stairs, future brother-in-law." },
    { who: "commish", text: `With pick number ${c.pick}, the ${c.team!.city} ${c.team!.name} select...` },
    { who: "commish", text: `${c.me.name}!` },
    {
      who: "narrator",
      text: "Your mom is crying. The theater is shaking. Imani is in the photo pit, and she doesn't lower her camera once.",
    },
    {
      who: "reporter",
      text: `How does it feel to be a ${c.team!.name}?`,
      choices: [
        { text: "Like the first day of the rest of my life.", effect: { fans: 6 } },
        { text: `${c.team!.city}, I'm bringing you a ring.`, effect: { fans: 10, chemistry: -2 } },
        { text: "I just want to learn and win.", effect: { chemistry: 6 } },
      ],
    },
    {
      who: "agent",
      text: "Rookie deal: ₵300 a game plus win bonuses. Keep winning and the sneaker brands will come to us.",
    },
  ],
  proIntro: (c: SceneCtx): Line[] => [
    {
      who: "coach",
      text: `Dell Harlan, head coach of the ${c.team!.name}. I don't care about your highlights. I care about stops.`,
    },
    {
      who: "coach",
      text: "Eleven games, and the top four make the playoffs. Get better every week and I'll give you minutes.",
    },
    { who: "imani", text: "Guess who got hired as the EBL's staff photographer?" },
    { who: "imani", text: "Try not to frown in every photo this time, rookie." },
  ],
};

export const LIFE_EVENTS: { id: string; when(c: SceneCtx, week: number): boolean; lines(c: SceneCtx): Line[] }[] = [
  {
    id: "kane",
    when: (_c, w) => w >= 3,
    lines: () => [
      {
        who: "architect",
        text: "Congratulations on the draft. The Glass City Architects could use a player like you.",
      },
      {
        who: "architect",
        text: "Ask for a trade. You'll have a ring by twenty-five.",
        choices: [
          { text: "I'd rather beat you for it.", effect: { fans: 6 } },
          { text: "No thanks. I'm happy here.", effect: { chemistry: 5 } },
        ],
      },
    ],
  },
  {
    id: "tabloid",
    when: (c, w) => w >= 5 && c.love >= 2,
    lines: () => [
      { who: "agent", text: "Why is your face on the Meridian Post next to the league photographer?" },
      {
        who: "imani",
        text: "So... we're a headline now. Are you okay with that?",
        choices: [
          {
            text: "I'm okay with it if you are.",
            effect: { love: 1, fans: 4 },
            reply: [{ who: "imani", text: "...Yeah. I think I am." }],
          },
          { text: "Let's keep it quiet for now.", effect: { chemistry: 2 } },
        ],
      },
    ],
  },
  {
    id: "brother",
    when: (_c, w) => w >= 4,
    lines: () => [
      {
        who: "narrator",
        text: "Sunday dinner at the Coles'. Dre is already at the table, wearing his EBL warmup jacket indoors.",
      },
      { who: "dre", text: "Rookie of the Year race is between you and me. Just so everyone at this table knows." },
      { who: "imani", text: "Can we have ONE dinner without a box score?" },
      {
        who: "dre",
        text: "One-on-one after dessert. Loser does the dishes.",
        choices: [
          {
            text: "Get the dish soap, Dre.",
            effect: { fans: 3 },
            reply: [{ who: "dre", text: "Big talk from a man who's never seen my step-back." }],
          },
          {
            text: "I'll do the dishes. Your mom made pie.",
            effect: { love: 1, chemistry: 2 },
            reply: [{ who: "imani", text: "Okay, THAT is why I like you." }],
          },
        ],
      },
    ],
  },
  {
    id: "all-star",
    when: (c, w) => w >= 7 && c.fans >= 35,
    lines: () => [
      { who: "agent", text: "The fan vote just came in. You're an EBL All-Star. As a rookie." },
      { who: "mom", text: "I voted four hundred times. On three phones. Don't ask whose phones." },
      { who: "agent", text: "Harbor Kicks wants you on a signature shoe. There's a ₵1,500 bonus." },
    ],
  },
  {
    id: "official",
    when: (c) => c.love >= 4,
    lines: () => [
      { who: "narrator", text: "Pier 9 at sunset." },
      {
        who: "imani",
        text: "You brought me to a pier to shoot free throws?",
        choices: [
          {
            text: "I brought you here to ask you something. Be my girlfriend?",
            effect: { love: 1, flag: "together" },
            reply: [{ who: "imani", text: "Took you long enough, rookie." }],
          },
          { text: "And to lose to me, obviously.", reply: [{ who: "imani", text: "In your dreams." }] },
        ],
      },
    ],
  },
];

export const DATES: ((c: SceneCtx) => Line[])[] = [
  () => [
    { who: "narrator", text: "A coffee cart outside the practice facility." },
    {
      who: "imani",
      text: "So why basketball? The real reason, not the press conference one.",
      choices: [
        { text: "It's the one place I've always felt like myself.", effect: { love: 1 } },
        {
          text: "Mom said I'd break the TV if I kept playing indoors.",
          effect: { love: 1 },
          reply: [{ who: "imani", text: "Ha! Okay. I like your mom already." }],
        },
      ],
    },
  ],
  () => [
    { who: "narrator", text: "A gallery in the Harbor District. Half the photos on the walls are hers." },
    {
      who: "imani",
      text: "That one's you, senior year. I was in the stands at the City Championship.",
      choices: [
        {
          text: "You've been watching me that long?",
          effect: { love: 1 },
          reply: [{ who: "imani", text: "Watching the game. You just happened to be in it." }],
        },
        { text: "Show me the rest.", effect: { love: 1 } },
      ],
    },
  ],
  () => [
    { who: "narrator", text: "Rooftop dinner. Meridian Tower glows blue across the skyline." },
    {
      who: "imani",
      text: "Okay, fine. This is a very good date.",
      choices: [
        {
          text: "Only very good?",
          effect: { love: 1 },
          reply: [{ who: "imani", text: "You still haven't let me beat you one-on-one." }],
        },
        { text: "I'll take very good.", effect: { love: 1 } },
      ],
    },
  ],
  () => [
    { who: "narrator", text: "Sunday dinner at Mom's." },
    { who: "mom", text: "So YOU'RE the photographer. I've seen every picture you've taken of my baby." },
    {
      who: "imani",
      text: "He was a very cute baby, I'm told.",
      choices: [
        {
          text: "Mom, please don't get the albums.",
          effect: { love: 1 },
          reply: [{ who: "mom", text: "Too late. They're already on the table." }],
        },
        { text: "Here we go...", effect: { love: 1 } },
      ],
    },
  ],
  () => [
    { who: "narrator", text: "A late walk through Crown Square. Your highlights are playing on the billboards." },
    {
      who: "imani",
      text: "It's weird seeing you forty feet tall.",
      choices: [
        { text: "Hold her hand.", effect: { love: 1 } },
        { text: "Race her to the red steps.", effect: { love: 1 } },
      ],
    },
  ],
];

export const PRESSERS: ((c: SceneCtx) => Line[])[] = [
  (c) => [
    { who: "reporter", text: `The ${c.team?.name} are ${c.wins}-${c.losses}. Are you the reason?` },
    {
      who: "reporter",
      text: "Your answer?",
      choices: [
        { text: "It's the whole team.", effect: { chemistry: 5 } },
        { text: "I'd like to think so.", effect: { fans: 5, chemistry: -2 } },
        { text: "Ask me after the playoffs.", effect: { fans: 3, chemistry: 2 } },
      ],
    },
  ],
  () => [
    { who: "reporter", text: "Kairo Vance says the rookie scoring title is his. Response?" },
    {
      who: "reporter",
      text: "Anything for Static?",
      choices: [
        { text: "Tell him I said good luck.", effect: { fans: 4, chemistry: 2 } },
        { text: "He'll need it.", effect: { fans: 7 } },
      ],
    },
  ],
  () => [
    { who: "reporter", text: "What does your mom think of your season?" },
    {
      who: "reporter",
      text: "Be honest.",
      choices: [
        { text: "She thinks I should pass more.", effect: { fans: 4, chemistry: 3 } },
        { text: "She's my biggest fan. And my biggest critic.", effect: { fans: 5 } },
      ],
    },
  ],
];

export const FINALE = {
  playoffs: (c: SceneCtx): Line[] => [
    {
      who: "coach",
      text: `${c.wins} and ${c.losses}, and we're in the playoffs. Everything is first to 21 now. Win or go home.`,
    },
    { who: "imani", text: "I'll be under the basket. Look for me after you win." },
  ],
  missed: (c: SceneCtx): Line[] => [
    { who: "coach", text: `${c.wins} and ${c.losses}. Not enough this year. Rookie seasons are for learning.` },
    { who: "mom", text: "Next year, baby. I already bought the playoff tickets." },
  ],
  champion: (c: SceneCtx): Line[] => [
    {
      who: "narrator",
      text: `The ${c.team!.city} ${c.team!.name} are EBL champions. Confetti is falling all over Meridian.`,
    },
    { who: "commish", text: `Your Finals MVP, and Rookie of the Year... ${c.me.name}!` },
    { who: "mom", text: "THAT'S MY BABY! THAT'S MY BABY!" },
    { who: "imani", text: "I got the shot. The one that goes on the wall." },
    { who: "narrator", text: "From a high school gym to an EBL ring. And your story is only getting started." },
  ],
  finalsLoss: (c: SceneCtx): Line[] => [
    { who: "coach", text: `One game short. I'm proud of you. The ${c.team!.name} have a franchise player now.` },
    { who: "imani", text: "Next year. Same seat." },
  ],
};

export function eblTeam(id: string) {
  return getTeam(id);
}

/** Which 3D set each career scene is staged on */
export function sceneSet(
  key: string,
  ctx: { college?: College; team?: EblTeam },
): { set: "court" | "draft"; venueId?: string } {
  if (key === "draft") return { set: "draft" };
  if (VENUES.some((v) => v.id === key)) return { set: "court", venueId: key };
  if (key === "hsIntro" || key === "hsAfter") return { set: "court", venueId: "hs-gym" };
  if (key === "collegeIntro" || key === "collegeAfter")
    return { set: "court", venueId: ctx.college?.venueId ?? "college-msu" };
  const dates = ["queensway", "neon-alley", "the-crown", "pier-9", "the-crown"];
  if (key.startsWith("date")) return { set: "court", venueId: dates[Number(key.slice(4)) || 0] };
  if (key === "official") return { set: "court", venueId: "pier-9" };
  if (key === "kane") return { set: "court", venueId: "arena-gca" };
  return { set: "court", venueId: ctx.team?.venueId ?? "arena-pmt" };
}
