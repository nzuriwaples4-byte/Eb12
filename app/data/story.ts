import type { AssetId } from "./higgsfield-assets";

export type SpeakerId =
  | "kairo"
  | "nia"
  | "deuce"
  | "brick"
  | "silk"
  | "queen"
  | "monarch"
  | "ricochet"
  | "metronome"
  | "titan"
  | "echo"
  | "architect"
  | "imani"
  | "dre"
  | "coach"
  | "agent"
  | "producer"
  | "reporter"
  | "commish"
  | "teammate"
  | "mom"
  | "hscoach"
  | "collegecoach"
  | "me"
  | "kid1"
  | "kid2"
  | "kid3"
  | "narrator"
  | "announcer";

export interface Speaker {
  name: string;
  portrait?: AssetId;
  accent: string;
}

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  kairo: { name: "Kairo", portrait: "kairo-portrait", accent: "#3ad7ff" },
  nia: { name: "Nia", portrait: "nia-portrait", accent: "#ffc53d" },
  deuce: { name: "Deuce", portrait: "deuce-portrait", accent: "#ff8a1f" },
  brick: { name: "Brick", portrait: "brick-portrait", accent: "#ff4b4b" },
  silk: { name: "Silk", portrait: "silk-portrait", accent: "#b46bff" },
  queen: { name: "Queen", portrait: "queen-portrait", accent: "#2bd67b" },
  monarch: { name: "Monarch", portrait: "monarch-portrait", accent: "#ffc93a" },
  ricochet: { name: "Ricochet", portrait: "ricochet-portrait", accent: "#a6ff3a" },
  metronome: { name: "Metronome", portrait: "metronome-portrait", accent: "#6fa8ff" },
  titan: { name: "Titan", portrait: "titan-portrait", accent: "#2de0c8" },
  echo: { name: "Echo", portrait: "echo-portrait", accent: "#e8ecf4" },
  architect: { name: "The Architect", portrait: "architect-portrait", accent: "#ff3a6e" },
  imani: { name: "Jaailyah", portrait: "imani-portrait", accent: "#ff9ec7" },
  dre: { name: "Zay Carter", accent: "#e8742a" },
  coach: { name: "Coach Harlan", accent: "#9fb4ff" },
  agent: { name: "Tasha (Agent)", accent: "#5dff9a" },
  producer: { name: "Nova (Producer)", accent: "#c77dff" },
  reporter: { name: "Reporter", accent: "#c9d3e8" },
  commish: { name: "Commissioner", accent: "#ffffff" },
  teammate: { name: "Teammate", accent: "#ffc53d" },
  mom: { name: "Mom", accent: "#ffb38a" },
  hscoach: { name: "Coach Bell", accent: "#6ddc9a" },
  collegecoach: { name: "Coach Okafor", accent: "#9fb4ff" },
  me: { name: "You", accent: "#3ad7ff" },
  kid1: { name: "Kid", accent: "#ffd166" },
  kid2: { name: "Kid", accent: "#7bdff2" },
  kid3: { name: "Kid", accent: "#b8f2a6" },
  narrator: { name: "", accent: "#c9d3e8" },
  announcer: { name: "Announcer", accent: "#ff5a5a" },
};

export interface Effect {
  fans?: number;
  chemistry?: number;
  love?: number;
  crowns?: number;
  flag?: string;
}

export interface Choice {
  text: string;
  effect?: Effect;
  reply?: Line[];
}

export interface Line {
  who: SpeakerId;
  text: string;
  /** Player picks one; its reply lines play next */
  choices?: Choice[];
}

export type ObjectiveKind = "perfect" | "dunks" | "ankles" | "margin" | "special" | "blocks" | "threes";

export interface Objective {
  kind: ObjectiveKind;
  count: number;
  label: string;
}

export interface Chapter {
  id: string;
  /** 1 = The Rebound, 2 = The Undercity */
  book?: number;
  number: number;
  title: string;
  logline: string;
  venueId: string;
  opponentId: string;
  target: number;
  /** 0 = rookie, 1 = pro, 2 = legend (added to player's chosen difficulty) */
  difficulty: number;
  objective: Objective;
  intro: Line[];
  win: Line[];
  lose: Line[];
}

export const STORY_TITLE = "The Rebound";
export const BOOK = "Book One";

export const BOOKS = [
  { number: 1, name: "Book One", title: "The Rebound" },
  { number: 2, name: "Book Two", title: "The Undercity" },
];

export const CHAPTERS: Chapter[] = [
  {
    id: "ch1",
    number: 1,
    title: "Double Zero",
    logline: "Two years after the injury, Kairo walks back onto Pier 9, right into Deuce's livestream.",
    venueId: "pier-9",
    opponentId: "deuce",
    target: 11,
    difficulty: 0,
    objective: { kind: "perfect", count: 1, label: "Hit a jumper with a PERFECT release" },
    intro: [
      { who: "narrator", text: "Two years ago. Port Meridian City Championship. Four seconds left." },
      { who: "announcer", text: "Vance takes it coast to coast. He's favoring that right knee. He goes UP—" },
      { who: "narrator", text: "He went up. His knee didn't come with him." },
      { who: "narrator", text: "Today. Pier 9, Harbor Heights." },
      { who: "nia", text: "Kai. KAI. Put the cargo manifest down and look at this." },
      { who: "kairo", text: "Nia, I've got a double shift." },
      {
        who: "nia",
        text: "The Crown Circuit is back. Five courts, five kings. Beat them all and the last one's on the roof of Meridian Tower.",
      },
      { who: "nia", text: "Winner gets a sponsored spot at the Pro Combine. Real scouts, Kai. A real second chance." },
      { who: "kairo", text: "Nobody's scouting a guy with a knee brace and a forklift license." },
      { who: "nia", text: "They scout buckets. Also, I already signed you up. You're welcome." },
      { who: "kairo", text: "...You did WHAT?" },
      { who: "deuce", text: "Ayo CHAT. Chat! You are NOT gonna believe who just walked onto my pier." },
      {
        who: "deuce",
        text: "Kairo Vance! Harbor Heights' finest! The kid whose knee exploded on live TV! Two point three million views, baby!",
      },
      { who: "kairo", text: "You want the sequel?" },
      { who: "deuce", text: "Ohhh he's got JOKES. First to 11. Loser gets clowned on my stream forever." },
      {
        who: "nia",
        text: "Quick refresher, Kai: move with WASD. Hold J to rise and let go at the top of the meter. K crosses him up, Shift is turbo. Fill your meter and hit SPACE.",
      },
    ],
    win: [
      { who: "deuce", text: "Chat... chat, turn off the stream. TURN IT OFF." },
      { who: "nia", text: "Clip it! Somebody CLIP THAT!" },
      { who: "deuce", text: "Okay. Okay. Respect. You're really back, huh?" },
      {
        who: "deuce",
        text: "Real talk? Next stop is The Cage under the train line. Brick Moreno runs it. He put my cousin through the fence. The actual fence.",
      },
      { who: "kairo", text: "Then I'll use the gate." },
    ],
    lose: [
      { who: "deuce", text: "Chat, spam the L! Two years off and he's STILL hurt, y'all!" },
      { who: "nia", text: "Shake it off, Kai. Run it back." },
    ],
  },
  {
    id: "ch2",
    number: 2,
    title: "Under the Line",
    logline: "The Cage belongs to Brick Moreno, and Brick knows something about that night.",
    venueId: "the-cage",
    opponentId: "brick",
    target: 11,
    difficulty: 0,
    objective: { kind: "dunks", count: 2, label: "Throw down 2 dunks on Brick" },
    intro: [
      {
        who: "narrator",
        text: "The Underline District. A train rolls over the court every four minutes. Brick owns it the rest of the time.",
      },
      { who: "brick", text: "Harbor Heights. You lost?" },
      { who: "kairo", text: "Crown Circuit. I'm next on the list." },
      { who: "brick", text: "Everybody's next on that list. Nobody's gotten past me." },
      {
        who: "brick",
        text: "I saw your knee go on TV. Everybody did. Monarch was courtside that night yelling 'legends don't sit.'",
      },
      { who: "kairo", text: "...You know Monarch?" },
      {
        who: "brick",
        text: "Everybody knows Monarch. Beat me and you might meet him. Lose and you're the next thing I put through that fence.",
      },
      {
        who: "nia",
        text: "Don't settle for jumpers. Take it right at his chest. Turbo + shoot near the rim is a DUNK.",
      },
    ],
    win: [
      { who: "brick", text: "...Hm." },
      { who: "brick", text: "You didn't flinch at the rim. Even with the knee." },
      { who: "kairo", text: "The knee's fine. I had to rehab the fear." },
      {
        who: "brick",
        text: "Silk's in Little Seoul, under the neon. Don't let him make you dance. Everybody dances.",
      },
      { who: "nia", text: "Did Brick just... give us advice?" },
    ],
    lose: [
      { who: "brick", text: "Told you. Nobody scores in my house." },
      { who: "kairo", text: "Then the house is changing owners." },
    ],
  },
  {
    id: "ch3",
    number: 3,
    title: "Smoke & Mirrors",
    logline: "In the neon rain of Little Seoul, Silk dances. And Monarch has been asking questions.",
    venueId: "neon-alley",
    opponentId: "silk",
    target: 11,
    difficulty: 1,
    objective: { kind: "ankles", count: 1, label: "Break Silk's ankles" },
    intro: [
      { who: "narrator", text: "Little Seoul. It's raining neon." },
      { who: "silk", text: "Kairo Vance. You used to play like a storm. All noise." },
      { who: "kairo", text: "And you play like a rumor." },
      { who: "silk", text: "Rumors travel faster than you do." },
      { who: "silk", text: "Monarch came through last month. He asked if you'd shown up yet." },
      { who: "kairo", text: "He asked about me?" },
      { who: "silk", text: "He asked if you were still scared of the rim. Let's find out." },
      {
        who: "nia",
        text: "Silk reads everything. Make him bite: hit your crossover (K) when he's right up on you. If he stumbles, GO.",
      },
    ],
    win: [
      { who: "silk", text: "...Did I just slip?" },
      { who: "nia", text: "No, you just got COOKED!" },
      { who: "silk", text: "Good handles. Maybe better than his." },
      {
        who: "silk",
        text: "Queen runs the bracket at Queensway. She was there that night. Ask her who told you to go up on that knee.",
      },
      { who: "kairo", text: "I already know who." },
      { who: "silk", text: "Do you?" },
    ],
    lose: [{ who: "silk", text: "Smooth. You'll learn." }],
  },
  {
    id: "ch4",
    number: 4,
    title: "The Line Is Hers",
    logline: "Queensway Park in daylight. Queen hits from anywhere, and she knows the truth.",
    venueId: "queensway",
    opponentId: "queen",
    target: 15,
    difficulty: 1,
    objective: { kind: "margin", count: 4, label: "Win by 4 or more" },
    intro: [
      { who: "narrator", text: "Queensway Park. Broad daylight. The whole neighborhood is watching." },
      { who: "queen", text: "Four courts in four weeks. The bracket has never moved this fast." },
      { who: "kairo", text: "You were there that night. Sitting with him." },
      { who: "queen", text: "I was. Marcus saw you limping in warmups. He begged your coach to sit you." },
      { who: "kairo", text: "...What?" },
      {
        who: "queen",
        text: "Your coach said the scouts came to see you. So Marcus yelled 'legends don't sit' to get you through it. You heard what you wanted to hear and went up anyway.",
      },
      {
        who: "queen",
        text: "He's blamed himself for two years. That's why he disappeared. The Crown Circuit is how he's been looking for you.",
      },
      { who: "kairo", text: "Then why make me climb five courts to reach him?" },
      { who: "queen", text: "Because a crown somebody hands you isn't yours. First to 15. Don't let me get hot." },
      { who: "nia", text: "She's a sniper. Stay in her face on the perimeter and jump (J) to contest when she rises." },
    ],
    win: [
      { who: "queen", text: "...Okay, Harbor Heights. Okay." },
      { who: "queen", text: "Roof of Meridian Tower. Midnight. He'll be there." },
      { who: "queen", text: "And Kairo? Win it for you. Not for him, and not for the scouts." },
      { who: "nia", text: "Kai... you good?" },
      { who: "kairo", text: "Yeah. For the first time in two years." },
    ],
    lose: [{ who: "queen", text: "Count it. Come back when your feet are ready." }],
  },
  {
    id: "ch5",
    number: 5,
    title: "Heavy Is the Head",
    logline: "Ninety floors up in a thunderstorm, the student faces the king.",
    venueId: "the-crown",
    opponentId: "monarch",
    target: 21,
    difficulty: 2,
    objective: { kind: "special", count: 1, label: "Hit LIGHTS OUT on Monarch" },
    intro: [
      { who: "narrator", text: "Meridian Tower. Ninety floors up. A storm is rolling in off the harbor." },
      { who: "monarch", text: "Look at you. Double zero." },
      { who: "kairo", text: "You told me to wear it. 'Start from nothing, and you owe nobody.'" },
      { who: "monarch", text: "Then I taught you the worst lesson I ever taught anybody. That night—" },
      { who: "kairo", text: "Queen told me. You tried to sit me, and I didn't listen." },
      { who: "monarch", text: "I should've made you listen. I've been carrying that knee for two years." },
      { who: "kairo", text: "Then put it down. I don't need your apology. I need your best." },
      { who: "monarch", text: "...Heh. There he is." },
      {
        who: "monarch",
        text: "First to 21. No mercy, no gifts. If you want the crown, you take it off my head.",
      },
      { who: "nia", text: "This is it, Kai. Everything you've got. And when that meter fills up..." },
      { who: "kairo", text: "Lights out." },
    ],
    win: [
      { who: "narrator", text: "The storm broke over Port Meridian, and so did the reign." },
      { who: "monarch", text: "...The crown's yours, Static." },
      { who: "kairo", text: "Keep it. I'm not a king. I'm a comeback." },
      {
        who: "monarch",
        text: "Ha! Then let's give them one. The Combine is in three weeks. I'll train you, properly this time.",
      },
      { who: "nia", text: "Uh... guys? Every phone on this roof just buzzed at the same time." },
      {
        who: "narrator",
        text: 'UNKNOWN SENDER: "Nice show, Vance. The Combine is a cage. Find me at the Undercity Invitational." — THE ARCHITECT',
      },
      { who: "kairo", text: "Who's the Architect?" },
      { who: "monarch", text: "...Somebody I hoped I'd never hear from again." },
    ],
    lose: [
      { who: "monarch", text: "Still not ready. Get up." },
      { who: "monarch", text: "Again." },
    ],
  },
  {
    id: "ch6",
    book: 2,
    number: 6,
    title: "Line 0",
    logline: "The Architect's invitation leads under the city, to a subway station that was never finished.",
    venueId: "line-0",
    opponentId: "ricochet",
    target: 15,
    difficulty: 1,
    objective: { kind: "dunks", count: 3, label: "Throw down 3 dunks (try off the glass: U, then J)" },
    intro: [
      { who: "narrator", text: "Three weeks later. Two days before the Pro Combine." },
      {
        who: "nia",
        text: "The address from the Architect's text is a subway entrance that's been bricked up since the eighties.",
      },
      {
        who: "monarch",
        text: "Line 0. They ran out of money before the trains ever did. Somebody finished it anyway.",
      },
      { who: "kairo", text: "You coming down with us?" },
      { who: "monarch", text: "I can't. If he sees me, this turns into something else. Go. Keep your eyes open." },
      {
        who: "narrator",
        text: "Line 0. The Undercity. The platform is packed, and the court has been painted right over the tracks.",
      },
      { who: "ricochet", text: "Ohhh, the Crown kid! Welcome to the basement, superstar." },
      { who: "ricochet", text: "Down here the backboard is your friend. Watch." },
      { who: "kairo", text: "Who runs this place?" },
      {
        who: "ricochet",
        text: "Same guy who runs everything. Beat me and you'll get an elevator ride up. Lose and you ride the stairs home.",
      },
    ],
    win: [
      { who: "ricochet", text: "Okay, okay! You can FLY, Crown kid." },
      {
        who: "ricochet",
        text: "Real talk, though. Everybody down here signed something. Contracts, NDAs, 'development deals'. Nobody gets out clean.",
      },
      { who: "nia", text: "Signed with who?" },
      { who: "ricochet", text: "Kane Performance. The Combine. It's all him." },
    ],
    lose: [{ who: "ricochet", text: "Stairs are that way, superstar!" }],
  },
  {
    id: "ch7",
    book: 2,
    number: 7,
    title: "Tempo",
    logline: "At the Pro Combine, the top-ranked prospect has never made a mistake. The scouts are watching.",
    venueId: "the-combine",
    opponentId: "metronome",
    target: 15,
    difficulty: 1,
    objective: { kind: "perfect", count: 3, label: "Hit 3 PERFECT releases" },
    intro: [
      {
        who: "narrator",
        text: "Kane Performance Center. The Pro Combine. Forty scouts, three hundred prospects, one invitation.",
      },
      { who: "nia", text: "Your name's not on the list. Wait. Somebody added it this morning, in red." },
      {
        who: "metronome",
        text: "You're the streetball kid. 00. Your release is point-one-four seconds late on step-backs.",
      },
      { who: "kairo", text: "You measured my jumper?" },
      { who: "metronome", text: "He did. Mr. Kane has a file on everyone. Yours is thick." },
      { who: "metronome", text: "First to 15. Every scout in the building is watching. Don't be late." },
      { who: "nia", text: "She never misses a beat, Kai. So hit yours: release at the top of the meter, every time." },
    ],
    win: [
      { who: "metronome", text: "...You changed tempo mid-possession. Nobody does that." },
      {
        who: "metronome",
        text: "Listen. Kane doesn't want players, he wants products. He's buying out contracts and burying them in the Undercity until they'll sign anything.",
      },
      { who: "metronome", text: "Titan was a pro. Look at the Spillway. You'll see." },
      { who: "kairo", text: "Why tell me this?" },
      {
        who: "metronome",
        text: "Because you're the first person who beat me, and I'd like to be more than his masterpiece.",
      },
    ],
    lose: [{ who: "metronome", text: "Off-beat. Again." }],
  },
  {
    id: "ch8",
    book: 2,
    number: 8,
    title: "High Water",
    logline: "Storm Drain No. 4 floods when it rains, and it's raining. Titan guards the only way deeper.",
    venueId: "the-spillway",
    opponentId: "titan",
    target: 15,
    difficulty: 1,
    objective: { kind: "ankles", count: 2, label: "Break Titan's ankles twice" },
    intro: [
      { who: "narrator", text: "The Spillway. The water is up to the three-point line and it's still raining." },
      { who: "titan", text: "Go home, little man. Nothing down here but water and bad contracts." },
      { who: "kairo", text: "Metronome said you were a pro." },
      {
        who: "titan",
        text: "Three seasons. Then Kane bought my deal and told the league I was injured. I'm not injured.",
      },
      { who: "titan", text: "Every month he sends me a new contract with smaller numbers. I haven't signed one yet." },
      {
        who: "titan",
        text: "You want the elevator to the top of his tower? It's behind me. Nobody has scored inside on me in a year.",
      },
      {
        who: "nia",
        text: "He's seven-one. Don't challenge him at the rim. Make him move his feet: crossover, crossover, GO.",
      },
    ],
    win: [
      { who: "titan", text: "...Ha. You made a seven-footer dance in a flood." },
      { who: "titan", text: "The elevator key is yours. But be careful. There's one more game before the tower." },
      { who: "titan", text: "Someone who plays exactly like you." },
    ],
    lose: [{ who: "titan", text: "Closed. Come back when it stops raining." }],
  },
  {
    id: "ch9",
    book: 2,
    number: 9,
    title: "Feedback",
    logline:
      "Pier 9 at midnight. A masked player knows every one of Kairo's moves, because he learned them next to him.",
    venueId: "pier-9",
    opponentId: "echo",
    target: 15,
    difficulty: 2,
    objective: { kind: "margin", count: 3, label: "Win by 3 or more" },
    intro: [
      { who: "narrator", text: "Pier 9. Midnight. Right where it all started. Fog is rolling off the water." },
      { who: "nia", text: "Kai... that guy is wearing your number." },
      { who: "echo", text: "Static." },
      { who: "kairo", text: "Who are you?" },
      {
        who: "echo",
        text: "Somebody who was on the court the day you got the scholarship. And in the parking lot when I didn't.",
      },
      { who: "kairo", text: "...Dante?" },
      {
        who: "echo",
        text: "Kane found me the week after. Two years of film on you. Every crossover, every jumper, every dunk. I can do all of it.",
      },
      { who: "echo", text: "Beat me and the tower is yours. Lose and I'm the one who wears 00." },
      { who: "nia", text: "He knows your moves, so don't play like the old you. Mix it up!" },
    ],
    win: [
      { who: "echo", text: "...I had every move you've ever made." },
      { who: "kairo", text: "You had every move I've made. I'm still making new ones." },
      { who: "echo", text: "Dante. Call me Dante." },
      { who: "echo", text: "Kane Tower, 101st floor. He'll be waiting on his own court, and he doesn't lose there." },
      { who: "kairo", text: "Come with us." },
      { who: "echo", text: "Yeah. I think I will." },
    ],
    lose: [{ who: "echo", text: "Lights out, Static." }],
  },
  {
    id: "ch10",
    book: 2,
    number: 10,
    title: "The Architect",
    logline: "The 101st floor of Kane Tower. The man who owns the game plays for everything.",
    venueId: "glass-house",
    opponentId: "architect",
    target: 21,
    difficulty: 2,
    objective: { kind: "special", count: 1, label: "Hit LIGHTS OUT on the Architect" },
    intro: [
      { who: "narrator", text: "Kane Tower. 101st floor. A glass court above the whole city." },
      { who: "architect", text: "Kairo Vance. You've cost me a gatekeeper, a masterpiece, a center and a mirror." },
      {
        who: "architect",
        text: "Sign with Kane Performance and all of it goes away. Shoe deal, draft guarantee, your sister's tuition. One pen stroke.",
      },
      { who: "kairo", text: "And Titan's contract? Metronome's? Dante's?" },
      { who: "architect", text: "Investments. Some of them haven't matured yet." },
      { who: "monarch", text: "They're people, Victor." },
      {
        who: "architect",
        text: "Marcus. Twenty years and you're still sentimental. I discovered you, and when you wouldn't sign, I buried you. It was business.",
      },
      {
        who: "monarch",
        text: "Then let's make it basketball. One game. Kairo wins, and every Undercity contract gets torn up.",
      },
      { who: "architect", text: "And when he loses, he signs. Deal. I still have a jumper, boy. First to 21." },
      { who: "nia", text: "Everything, Kai. For all of them." },
      { who: "kairo", text: "Lights out." },
    ],
    win: [
      { who: "narrator", text: "The final shot hung over the city for a long time. Then it fell." },
      { who: "architect", text: "...A deal is a deal." },
      {
        who: "narrator",
        text: "Every Undercity contract was torn up on the 101st floor. Titan, Metronome, Ricochet and Dante were free agents by sunrise.",
      },
      { who: "metronome", text: "Scouts are calling. Every one of them." },
      {
        who: "monarch",
        text: "Not scouts, kid. A league. The Elite Basketball League just offered you a rookie deal.",
      },
      { who: "kairo", text: "The EBL?" },
      { who: "nia", text: "Kai. You're going PRO." },
    ],
    lose: [{ who: "architect", text: "The pen is on the table whenever you're ready." }],
  },
];

export const EPILOGUE_TEASER = {
  title: "Book Three: Rookie Season",
  text: "The Undercity is free and Kairo is going pro. Play his rookie season in the EBL now, in League mode.",
};

export function bookOf(c: Chapter) {
  return c.book ?? 1;
}

export function getChapter(id: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}
