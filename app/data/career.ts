import { BALLERS, EXTRA_BALLERS, type Baller, type HairStyle, type Look, type Ratings } from "./characters";
import { getTeam, type EblTeam } from "./ebl";
import type { Line } from "./story";
import { VENUES, type Venue } from "./venues";

/**
 * EBL Career ("Road to the League"): create your own baller and play
 * High School → College → EBL Draft → Rookie Season, with a life off the
 * court (Jaailyah, press, endorsements, money) along the way.
 */

export type Archetype = "slasher" | "sniper" | "floor-general" | "lockdown" | "big";
export type Stage = "create" | "hs" | "college-pick" | "college" | "draft" | "pro" | "offseason" | "done";

export interface MyPlayer {
  name: string;
  nickname: string;
  archetype: Archetype;
  heightIn: number;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  number: string;
  /** 2K22 vitals */
  position?: "PG" | "SG" | "SF" | "PF" | "C";
  hand?: "R" | "L";
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
  /** School name shown above the mascot on the signing-day board */
  city: string;
  /** Real US state (postal code) */
  state: string;
  mascot: string;
  short: string;
  primary: string;
  secondary: string;
  pitch: string;
  /** Minimum high-school wins for an offer */
  needWins: number;
  venueId: string;
  /** Bonus Badge Points by category for finishing the season */
  bonus: Record<"finishing" | "shooting" | "playmaking" | "defense", number>;
  /** Your hometown school (Atlanta) */
  hometown?: boolean;
}

/** Where your created player grew up */
export const HOMETOWN = { city: "Atlanta", state: "GA", teamId: "atl", school: "Peachtree Heights High" };

const COLLEGE_STATES: Record<string, string> = {
  "meridian-state": "GA",
  "coastal-tech": "NC",
  "kane-university": "NV",
  "silver-lake": "MT",
  bayline: "FL",
  redwood: "CA",
  "summit-am": "CO",
  ironvale: "OH",
  "crescent-city": "LA",
  "northern-pines": "MN",
};

/** Each program develops a different part of your game */
const COLLEGE_BONUS: Record<string, College["bonus"]> = {
  "meridian-state": { finishing: 1, shooting: 2, playmaking: 2, defense: 1 },
  "coastal-tech": { finishing: 2, shooting: 3, playmaking: 1, defense: 0 },
  "kane-university": { finishing: 3, shooting: 2, playmaking: 2, defense: 1 },
  "silver-lake": { finishing: 0, shooting: 1, playmaking: 1, defense: 4 },
  bayline: { finishing: 2, shooting: 2, playmaking: 2, defense: 0 },
  redwood: { finishing: 1, shooting: 1, playmaking: 1, defense: 1 },
  "summit-am": { finishing: 1, shooting: 1, playmaking: 4, defense: 1 },
  ironvale: { finishing: 3, shooting: 0, playmaking: 0, defense: 2 },
  "crescent-city": { finishing: 2, shooting: 3, playmaking: 1, defense: 1 },
  "northern-pines": { finishing: 2, shooting: 2, playmaking: 2, defense: 3 },
};

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
    state: COLLEGE_STATES[id] ?? "",
    mascot,
    short,
    primary,
    secondary,
    pitch,
    needWins,
    venueId: `college-${id}`,
    bonus: COLLEGE_BONUS[id] ?? { finishing: 1, shooting: 1, playmaking: 1, defense: 1 },
    hometown: COLLEGE_STATES[id] === HOMETOWN.state,
  };
}

/** Signing Day board: two columns like the old-school recruiting screens */
export const COLLEGES: College[] = [
  college(
    "meridian-state",
    "Five Points University",
    "Firebirds",
    "FPU",
    "#d7263d",
    "#16181f",
    0,
    "Stay home in the A. Your family courtside every night, and we run the offense through you on day one.",
  ),
  college(
    "coastal-tech",
    "Carolina Coastal Tech",
    "Current",
    "CCT",
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
    "Montana Silver Lake",
    "Wolves",
    "MSL",
    "#b8c4d6",
    "#1b2436",
    1,
    "Blue-collar defense, packed gym, and the loudest student section in the conference.",
  ),
  college(
    "bayline",
    "Gulf Coast College",
    "Gulls",
    "GCC",
    "#00b4d8",
    "#f7f3e8",
    1,
    "We play fast. You'll get up forty shots a game and your own highlight reel by November.",
  ),
  college(
    "redwood",
    "NorCal Redwood U",
    "Lumberjacks",
    "NRU",
    "#2f7d3a",
    "#f2e2b8",
    0,
    "Small school, big minutes. Starting lineup from your first practice, guaranteed.",
  ),
  college(
    "summit-am",
    "Colorado Summit A&M",
    "Rams",
    "CSA",
    "#7a1f2b",
    "#e8c872",
    2,
    "Five straight tournaments. Our coach has sent eleven guards to the league.",
  ),
  college(
    "ironvale",
    "Ohio Ironvale",
    "Miners",
    "OIU",
    "#e2b23a",
    "#1b1b22",
    0,
    "Tough town, tough team. Come build something with us from the ground up.",
  ),
  college(
    "crescent-city",
    "New Orleans Crescent",
    "Tigers",
    "NOC",
    "#ff7a1a",
    "#1d1a3a",
    2,
    "Music, food, and a sold-out arena every night. You'll love it here, and so will the scouts.",
  ),
  college(
    "northern-pines",
    "Minnesota Northern Pines",
    "Huskies",
    "MNP",
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
  ...gymVenue("hs-gym", "Peachtree Heights High", "Home of the Peachtree Heights Panthers · Atlanta, GA", "#8ec3ee", "school", 70),
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
 * Zay Carter: Jaailyah's big brother and your rival from the first day of high
 * school to the EBL. Same face at every stop, different jersey.
 */
export const DRE = amateur(
  "rival-dre",
  "Zay Carter",
  "ZAY",
  "Northgate High",
  "#e8742a",
  62,
  1.98,
  "twists",
  "#5a3625",
);
const DRE_COLLEGE: Record<string, Baller> = {
  "silver-lake": amateur(
    "rival-dre-sls",
    "Zay Carter",
    "ZAY",
    "Silver Lake State",
    "#b8c4d6",
    73,
    1.98,
    "twists",
    "#5a3625",
  ),
  bayline: amateur(
    "rival-dre-bay",
    "Zay Carter",
    "ZAY",
    "Gulf Coast College",
    "#00b4d8",
    73,
    1.98,
    "twists",
    "#5a3625",
  ),
};

/** Where Zay signs: wherever you didn't */
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
  { opp: DRE, label: "City Championship vs Zay Carter & Northgate" },
];

export function collegeGamesFor(myCollegeId?: string) {
  const dc = dreCollege(myCollegeId);
  return [
    {
      opp: amateur("co-1", "Marcus Hale", "HALE", "NorCal Redwood U", "#2f7d3a", 64, 1.9, "fade", "#a86f4c"),
      label: "Conference opener vs NorCal Redwood U",
    },
    {
      opp: amateur("co-2", "Marcus Stone", "STONE", "Colorado Summit A&M", "#7a1f2b", 68, 2.06, "braids", "#3e2519"),
      label: "Top-10 matchup vs Colorado Summit A&M",
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
    { opp: DRE_COLLEGE[dc.id], label: `Conference championship vs Zay Carter & ${dc.name}` },
  ];
}
export const COLLEGE_GAMES = collegeGamesFor();

/** Build (or refresh) the player's Baller so the engine can use it */
export function registerMyBaller(
  p: MyPlayer,
  ratings: Ratings,
  jersey: string,
  trim: string,
  /** Your shoe deal's signature colors (upper, sole) */
  shoes?: [string, string],
): Baller {
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
    shoes: shoes?.[0] ?? "#101218",
    soles: shoes?.[1] ?? trim,
    build: p.archetype === "big" ? 1.28 : p.archetype === "slasher" || p.archetype === "lockdown" ? 1.04 : 0.94,
  };
  const b: Baller = {
    ...base,
    id: "me",
    name: p.name,
    nickname: p.nickname.toUpperCase(),
    height,
    heightLabel: `${Math.floor(p.heightIn / 12)}'${p.heightIn % 12}"`,
    from: "Atlanta, GA",
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
  /** EBL season number (1 = rookie year) */
  season?: number;
  /** The team Zay Carter plays for in the EBL */
  dreTeam?: EblTeam;
  flags?: string[];
}

export const SCENES = {
  hsIntro: (c: SceneCtx): Line[] => [
    {
      who: "narrator",
      text: "Peachtree Heights High, Atlanta. Senior year. The gym smells like popcorn and floor wax, and the bleachers are already full for a scrimmage.",
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
    { who: "imani", text: "You're the new starter? I'm Jaailyah. Smile for once, it's for the yearbook." },
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
      text: "Zay Carter. Jaailyah's brother. Northgate's best player, and the only reason anybody watches the City Championship.",
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
            text: "Your dunk is on the front page of the Peachtree Herald. My photo. You owe me a milkshake.",
            choices: [
              {
                text: "Friday. The diner on 4th.",
                effect: { love: 1 },
                reply: [{ who: "imani", text: "It's a date. Don't tell Zay." }],
              },
              {
                text: "Put it on my tab.",
                reply: [{ who: "imani", text: "You don't have a tab. You have a mouthguard problem." }],
              },
            ],
          },
        ],
        [
          { who: "hscoach", text: "You beat St. Jude. Carolina Coastal Tech called me at halftime." },
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
              { text: "Respect, Zay. See you on the court.", effect: { chemistry: 4, flag: "dre-respect" } },
            ],
          },
        ],
        [
          {
            who: "narrator",
            text: "Peachtree Heights beats Northgate for the Atlanta City Championship. The student section storms the floor.",
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
  /** Face-off at center court before the big games against Zay */
  hsPregame: (c: SceneCtx): Line[] => [
    {
      who: "narrator",
      text: "Atlanta City Championship. Northgate vs Peachtree Heights. The gym is so packed they opened the stage doors.",
    },
    { who: "dre", text: "Look at you. Mouthguard and everything. You remembered it for once?" },
    { who: "me", text: "Remembered it just for you, Zay. Figured you'd want something to look at while I score." },
    {
      who: "dre",
      text: "You took my sister to a diner and now you think you run this city. Tonight I take your scholarship AND your seat at Thanksgiving.",
    },
    {
      who: "dre",
      text: "Last chance to say something smart.",
      choices: [
        {
          text: "Check the ball. Talk after.",
          effect: { chemistry: 3 },
          reply: [{ who: "dre", text: "Oh, I'm checking it. Right into your chest." }],
        },
        {
          text: "Tell your mom I'll need a plate for Sunday.",
          effect: { fans: 5 },
          reply: [{ who: "dre", text: "...You're dead. You're so dead." }],
        },
      ],
    },
    { who: "imani", text: "Both of you. Shake hands. The ref is literally waiting." },
    {
      who: "narrator",
      text: `Neither of them shakes. First to 11. ${c.me.name.split(" ")[0]} vs Zay Carter for the city.`,
    },
  ],
  collegePregame: (c: SceneCtx): Line[] => [
    {
      who: "narrator",
      text: `Conference championship. ${c.college!.short} vs ${dreCollege(c.college?.id).short}. National TV. Zay is already at center court, waiting.`,
    },
    { who: "dre", text: "Round two. Last time was a fluke and everybody knows it." },
    { who: "me", text: "Fluke? I've got the photo on my wall. Your sister took it." },
    { who: "dre", text: "Don't. Bring. Her. Into. This." },
    {
      who: "dre",
      text: "Winner goes top ten in the draft. Loser watches from the green room. You ready?",
      choices: [
        { text: "Been ready since the diner.", effect: { fans: 6 } },
        {
          text: "Respect, Zay. Let's give them a show.",
          effect: { chemistry: 4, flag: "dre-respect" },
          reply: [{ who: "dre", text: "...Yeah. Let's give them a show." }],
        },
      ],
    },
  ],
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
      text: `Oh, and Zay signed with ${dreCollege(c.college?.id).name}. Same conference. He circled your game on his calendar in red.`,
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
            text: `Conference champions. Zay Carter sits on the ${dreCollege(c.college?.id).short} bench with a towel over his head.`,
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
  predraft: (c: SceneCtx): Line[] => [
    { who: "narrator", text: "Two weeks before the draft. Every team wants a workout." },
    {
      who: "agent",
      text: "Twelve teams, twelve workouts. But I know which one you've been thinking about since you were six.",
    },
    { who: "mom", text: "The Titans play twenty minutes from our house. I'm just saying." },
    {
      who: "agent",
      text: `Atlanta picks late. If you want to go home, I tell the Titans you'll only work out for them, and they trade up to get you.`,
      choices: [
        {
          text: "Get me home. I want to be a Titan.",
          effect: { flag: "hometown-draft", fans: 6 },
          reply: [
            { who: "agent", text: "Say less. I'm calling Atlanta." },
            { who: "imani", text: `${c.me.name.split(" ")[0]} in Titans gold? My camera is ready.` },
          ],
        },
        {
          text: "Let the draft decide. I'll go where I'm wanted.",
          effect: { chemistry: 4 },
          reply: [{ who: "agent", text: "Respect. We go where the minutes are." }],
        },
      ],
    },
  ],
  draft: (c: SceneCtx): Line[] => [
    { who: "narrator", text: "EBL Draft Night. Meridian Grand Theater." },
    { who: "mom", text: "I bought a new dress for this. If they don't call your name, I'm walking on stage myself." },
    { who: "narrator", text: "The first picks go by. Kairo Vance goes early to a big ovation." },
    { who: "commish", text: `With pick number ${Math.max(1, c.pick - 1)}... Zay Carter!` },
    { who: "dre", text: "Hey. You're next. Don't trip on the stairs, future brother-in-law." },
    ...(c.flags?.includes("hometown-draft") && c.team?.id === "atl"
      ? [
          {
            who: "commish" as const,
            text: `We have a trade: the Atlanta Titans have acquired pick number ${c.pick}.`,
          },
          { who: "mom" as const, text: "That's HOME! Baby, that's home!" },
        ]
      : []),
    { who: "commish", text: `With pick number ${c.pick}, the ${c.team!.city} ${c.team!.name} select...` },
    { who: "commish", text: `${c.me.name}!` },
    {
      who: "narrator",
      text: "Your mom is crying. The theater is shaking. Jaailyah is in the photo pit, and she doesn't lower her camera once.",
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
        text: "Congratulations on the draft. The Las Vegas Architects could use a player like you.",
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
        text: "Sunday dinner at the Carters'. Zay is already at the table, wearing his EBL warmup jacket indoors.",
      },
      { who: "dre", text: "Rookie of the Year race is between you and me. Just so everyone at this table knows." },
      { who: "imani", text: "Can we have ONE dinner without a box score?" },
      {
        who: "dre",
        text: "One-on-one after dessert. Loser does the dishes.",
        choices: [
          {
            text: "Get the dish soap, Zay.",
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
      { who: "agent", text: "And every sneaker brand in the league just asked for your shoe size. Again." },
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
    { who: "narrator", text: "A gallery downtown. Half the photos on the walls are hers." },
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
): { set: "court" | "draft" | "faceoff"; venueId?: string; lead?: string[]; alias?: Record<string, string> } {
  if (key === "draft") return { set: "draft" };
  if (key.startsWith("eblPregame"))
    return {
      set: "faceoff",
      venueId: key.split(":")[1] || ctx.team?.venueId,
      lead: ["me", "rival-dre-ebl"],
      alias: { "rival-dre": "rival-dre-ebl" },
    };
  if (key === "hsPregame") return { set: "faceoff", venueId: "hs-gym", lead: ["me", "rival-dre"] };
  if (key === "collegePregame")
    return {
      set: "faceoff",
      venueId: dreCollege(ctx.college?.id).venueId,
      lead: ["me", DRE_COLLEGE[dreCollege(ctx.college?.id).id].id],
      alias: { "rival-dre": DRE_COLLEGE[dreCollege(ctx.college?.id).id].id },
    };
  if (key === "collegeAfter" || key === "collegeIntro")
    return {
      set: "court",
      venueId: ctx.college?.venueId ?? "college-msu",
      alias: { "rival-dre": DRE_COLLEGE[dreCollege(ctx.college?.id).id].id },
    };
  if (VENUES.some((v) => v.id === key)) return { set: "court", venueId: key };
  if (key === "hsIntro" || key === "hsAfter") return { set: "court", venueId: "hs-gym" };
  if (key === "collegeIntro" || key === "collegeAfter")
    return { set: "court", venueId: ctx.college?.venueId ?? "college-msu" };
  const dates = ["queensway", "neon-alley", "the-crown", "pier-9", "the-crown"];
  if (key.startsWith("date")) return { set: "court", venueId: dates[Number(key.slice(4)) || 0] };
  if (key === "official") return { set: "court", venueId: "pier-9" };
  if (key === "kane") return { set: "court", venueId: "arena-lva" };
  return { set: "court", venueId: ctx.team?.venueId ?? "arena-nyc" };
}
