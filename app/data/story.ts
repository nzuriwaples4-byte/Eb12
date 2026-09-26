import type { AssetId } from "./higgsfield-assets";

export type SpeakerId = "kairo" | "nia" | "deuce" | "brick" | "silk" | "queen" | "monarch" | "narrator" | "announcer";

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
  narrator: { name: "", accent: "#c9d3e8" },
  announcer: { name: "Announcer", accent: "#ff5a5a" },
};

export interface Line {
  who: SpeakerId;
  text: string;
}

export type ObjectiveKind = "perfect" | "dunks" | "ankles" | "margin" | "special" | "blocks" | "threes";

export interface Objective {
  kind: ObjectiveKind;
  count: number;
  label: string;
}

export interface Chapter {
  id: string;
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
];

export const EPILOGUE_TEASER = {
  title: "Book Two: The Undercity",
  text: "Kairo took the crown, and now someone wants to take everything else. The Crown Circuit was only the beginning.",
};

export function getChapter(id: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}
