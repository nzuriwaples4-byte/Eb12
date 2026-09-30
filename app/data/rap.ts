import type { SceneCtx } from "./career";
import type { Line } from "./story";

/**
 * "Mic Check": the rapper side quest. Record in Nova's studio, answer Zay's
 * diss track, drop a mixtape, and headline a show at the Crown. Each step
 * is a scene + a rhythm take in the booth.
 */

export interface Song {
  title: string;
  bpm: number;
  /** One chunk per beat you hit */
  bars: string[];
}

export interface RapStep {
  id: string;
  title: string;
  venueId: string;
  song: Song;
  intro(c: SceneCtx): Line[];
  /** grade: 0..1 accuracy of the take */
  after(c: SceneCtx, grade: number): Line[];
}

export const RAP_QUEST: RapStep[] = [
  {
    id: "studio",
    title: "Studio Session",
    venueId: "neon-alley",
    song: {
      title: "Harbor Heights",
      bpm: 88,
      bars: [
        "Came up",
        "off the",
        "pier, nine",
        "concrete,",
        "Mama",
        "on the",
        "late shift,",
        "feet beat.",
        "Now I",
        "got the",
        "whole block",
        "on repeat,",
        "every",
        "bucket",
        "pay the",
        "rent, see.",
      ],
    },
    intro: (c) => [
      {
        who: "narrator",
        text: "A basement studio off Neon Alley. Purple lights, a drum machine, and a couch older than you.",
      },
      {
        who: "producer",
        text: `Nova. I make beats. Your teammate says ${c.me.name.split(" ")[0]} raps in the locker room and it's... not terrible.`,
      },
      { who: "producer", text: "Booth's open. Hit every word on the beat. Don't rush it. Nobody likes a rusher." },
    ],
    after: (_c, g) =>
      g >= 0.8
        ? [
            { who: "producer", text: "Okay. OKAY. That's a single. I'm uploading it tonight." },
            { who: "imani", text: "Is that... you? On the radio? Why is it actually good?" },
          ]
        : [
            {
              who: "producer",
              text: "Rough, but there's something there. We'll clean it up in the mix. Uploading it anyway.",
            },
          ],
  },
  {
    id: "diss",
    title: "Diss Track",
    venueId: "neon-alley",
    song: {
      title: "Dishes",
      bpm: 94,
      bars: [
        "Zay talk",
        "at the",
        "dinner",
        "table,",
        "lost to",
        "me twice,",
        "now he",
        "mad, though.",
        "Still I",
        "love the",
        "fam, that's",
        "fair play,",
        "wash the",
        "dishes",
        "Sunday,",
        "all day.",
      ],
    },
    intro: () => [
      {
        who: "narrator",
        text: "Your phone explodes. Zay Carter just dropped a song called 'Overrated'. It has your name in the first line.",
      },
      { who: "dre", text: "Stick to basketball. Actually, stick to losing to me. You're used to it." },
      { who: "imani", text: "I am NOT getting in the middle of this. ...Make it good though." },
      { who: "producer", text: "Oh, we're answering. I've got the perfect beat. It's mean. Let's go." },
    ],
    after: (_c, g) =>
      g >= 0.8
        ? [
            {
              who: "narrator",
              text: "'Dishes' hits a million plays in two days. The whole league is quoting it at shootaround.",
            },
            { who: "dre", text: "...The Sunday dinner line was cold. Truce? Mom says we're both banned from the aux." },
          ]
        : [
            { who: "narrator", text: "'Dishes' does fine. Zay's track does better. The comments are brutal." },
            { who: "dre", text: "Stick to hoops, brother-in-law. Love you though." },
          ],
  },
  {
    id: "mixtape",
    title: "The Mixtape",
    venueId: "queensway",
    song: {
      title: "Rookie Card",
      bpm: 90,
      bars: [
        "Draft night,",
        "Mama",
        "crying",
        "front row,",
        "Jaailyah",
        "got the",
        "lens and she",
        "won't let go.",
        "Rookie",
        "card, man,",
        "watch the",
        "price climb,",
        "every",
        "game night",
        "I'm on",
        "time.",
      ],
    },
    intro: (c) => [
      {
        who: "agent",
        text: "A label wants a full mixtape. Twelve tracks. I negotiated you keeping your masters, you're welcome.",
      },
      {
        who: "producer",
        text: `Title track's about you, ${c.me.name.split(" ")[0]}. Where you came from. One take. Make it count.`,
      },
    ],
    after: (_c, g) =>
      g >= 0.8
        ? [
            {
              who: "agent",
              text: "Number three on the charts. The label wants a tour. The team wants you to never mention the tour again.",
            },
            { who: "imani", text: "You put me in the title track. In front of the whole world. ...Play it again." },
          ]
        : [
            {
              who: "agent",
              text: "Solid debut. Not a smash, but the fans love it. Endorsement money is up either way.",
            },
          ],
  },
  {
    id: "concert",
    title: "Live at the Crown",
    venueId: "the-crown",
    song: {
      title: "Concrete Crown",
      bpm: 100,
      bars: [
        "Hands up",
        "for the",
        "Harbor,",
        "put the",
        "lights on,",
        "every",
        "court I",
        "touch I",
        "might own.",
        "Crown on,",
        "crowd loud,",
        "Zay in",
        "the front",
        "row, now",
        "say it",
        "LOUD!",
      ],
    },
    intro: () => [
      {
        who: "narrator",
        text: "The Crown rooftop. Five thousand people, a stage over the court, and the city lit up behind you.",
      },
      {
        who: "producer",
        text: "Sold out. Headliner. Don't look down, don't look at your mom, don't miss the first bar.",
      },
      { who: "dre", text: "Front row. If you fall off the stage I'm filming it." },
    ],
    after: (_c, g) =>
      g >= 0.8
        ? [
            {
              who: "narrator",
              text: "The crowd sings the hook back so loud it drowns out the beat. You're not just a hooper anymore.",
            },
            { who: "imani", text: "I shot the whole thing. This is going on a billboard." },
          ]
        : [
            {
              who: "narrator",
              text: "You fumble a verse, but the crowd carries you home. Nobody's forgetting this night.",
            },
          ],
  },
];
