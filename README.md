# Concrete Crown — Book One: The Rebound

A 1-on-1 arcade streetball game in the spirit of _NBA Ballers: Rebound_, with an original cast, an original city, a 10-chapter story mode, a walkable city, an EBL career mode and online play. It runs on Three.js and ships as a desktop app for Steam (Electron).

> **The hero:** Kairo **"Static"** Vance, #00. He was the #1 prospect in Port Meridian until his knee gave out on a dunk in the city title game. Two years later he's loading cargo at the harbor by night, and his little sister Nia has signed him up for the underground **Crown Circuit**: five courts, five kings, and the last one is his old mentor.

## Features

- **Real 1-on-1 streetball rules.** Twos and threes, loser's ball, check at the top of the key, take-it-back (clear the arc) after a change of possession, and a 14-second shot clock.
- **Arcade moves.**
  - Timing-based jump shots with a perfect-release window.
  - Layups and dunks (regular, windmill, tomahawk).
  - Crossovers that break ankles, including knocking defenders to the floor.
  - Trick dribbles (between the legs, behind the back, spin, around the world).
  - Self alley-oops off the backboard.
  - Steals, blocks, and rebounds.
- **HYPE meter and signature specials.** Every baller has their own special:
  - Kairo: _LIGHTS OUT_
  - Deuce: _GO VIRAL_
  - Brick: _WRECKING BALL_
  - Silk: _SMOKE & MIRRORS_
  - Queen: _CROWN JEWEL_
  - Monarch: _REIGN_
- **Five 3D courts.**
  - Pier 9 (harbor sunset)
  - The Cage (under the train tracks, with a train that rolls overhead)
  - Neon Alley (rain and neon signs)
  - Queensway Park (daylight)
  - The Crown (skyscraper rooftop in a thunderstorm)
- **Story mode.** Two books, ten chapters. Visual-novel dialogue staged as 3D cutscenes, with a bonus ★ objective in every chapter.
- **EBL Career.** Build your own player and go from high school to the pros:
  - A 2K-style Signature Blueprint creator and attribute builder (21 attributes, archetype and height caps, SP upgrades).
  - Senior year at Harbor Heights High, National Signing Day with ten colleges (offers depend on your wins), a freshman season, the EBL Draft, and a rookie season with playoffs against 12 generated EBL teams.
  - **Imani**, the photographer you meet in high school, becomes your girlfriend through your dialogue choices and dates.
  - **Dre Cole**, her big brother, is your rival at every level. You face off at center court before the City Championship and the conference final, then meet again on draft night and at Sunday dinner.
  - Weekly life choices: practice, dates, endorsements, press conferences, rest.
  - **Side quest: Mic Check.** Become a rapper. Record in Nova's studio (a rhythm minigame over a synthesized beat), answer Dre's diss track, drop a mixtape, and headline the Crown.
- **Meridian City.** A walkable New York–style grid with traffic, shops for gear and shoes, street courts and the EBL arena.
- **The Crib.** Kairo's house goes from the Harbor Loft to the Crown Penthouse. His bodyguards, the Hollis Twins, stand courtside at his games.
- **Quick Match.** Any unlocked baller, any court, games to 11/15/21, and three difficulty levels.
- **Multiplayer.**
  - **Local Versus:** two players on one screen (split keyboard or two gamepads).
  - **Tag Team co-op:** two players share a side against the CPU and tag in at every check ball.
  - **Online 1v1:** play with a 4-letter room code. The host's game runs the match and the guest streams inputs and follows 30 Hz snapshots.
- **Procedural IK animation.** One animation system drives both the built-in procedural ballers and the Higgsfield rigged GLB.
- **Synthesized audio.** A boom-bap music sequencer, crowd noise, rim/swish/slam sound effects, and no licensed samples, so it's Steam-safe.
- **Keyboard and gamepad.** Rumble is supported. Fonts are bundled, so the game works offline.

## Controls

| Action                             | Keyboard           | Gamepad            |
| ---------------------------------- | ------------------ | ------------------ |
| Move                               | WASD / Arrows      | Left stick / D-pad |
| Shoot (hold, release in the green) | J                  | A                  |
| Dunk                               | Shift + J near rim | RT + A             |
| Crossover / Steal                  | K                  | X                  |
| Trick dribble                      | L                  | Y                  |
| Off the glass (then J to catch)    | U                  | B                  |
| Block / Rebound                    | J on defense       | A                  |
| Special (HYPE full)                | Space              | RB                 |
| Turbo                              | Shift              | RT / LT            |
| Pause                              | Esc / P            | Start              |

Two players on one keyboard: **P1** uses WASD · J/K/L/U · Space · Left Shift (gamepad 1). **P2** uses Arrows · `.` shoot · `,` juke · `/` trick · `;` lob · Enter special · Right Shift turbo (gamepad 2).

## Running it

```bash
npm install
npm run fetch-assets   # download the Higgsfield art + 3D models into public/ (recommended)
npm run dev            # http://localhost:5173
```

Online play needs the relay server running somewhere both players can reach:

```bash
npm run relay          # ws://0.0.0.0:8787 — the desktop app starts one automatically
```

On the same Wi-Fi, the guest enters `ws://HOST-IP:8787` under **Online server**. Over the internet, deploy `server/relay.mjs` to any small Node host and point both players at it (or bake it in with `VITE_RELAY_URL=wss://…` at build time).

Dev-only tools:

- `/dev/attract?p=kairo&o=monarch&v=the-crown` runs a CPU-vs-CPU match.
- `window.__cc.debugState()` in the console shows the live match state.
- `/dev/scene?s=hsPregame&at=3` renders any career cutscene; `/dev/scene?s=schools` shows the signing-day board.
- `npm run screenshots` captures 1920×1080 Steam screenshots of every cutscene, screen and match moment into `steam-screenshots/` (needs the dev server running).

## Higgsfield AI assets

Every image and 3D model in the game was generated with Higgsfield. They're listed with their job IDs and prompts in [`app/data/higgsfield-assets.ts`](app/data/higgsfield-assets.ts).

| Asset                                       | Model                                        | Used for                                                  |
| ------------------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Kairo A-pose reference                      | Soul 2                                       | Source image for the 3D model                             |
| **Kairo 3D mesh**                           | SAM 3D (image → textured GLB)                | —                                                         |
| **Kairo rigged GLB**                        | Meshy 3D Rigging (humanoid skeleton, 1.93 m) | Kairo in-game, animated live by the IK system             |
| 7 character portraits                       | Soul 2                                       | Story dialogue, scoreboard, versus screen, select screens |
| Key art (rooftop windmill dunk)             | Soul 2                                       | Title screen, finale backdrop                             |
| Harbor Loft + Crown Penthouse               | Soul 2                                       | The Crib                                                  |
| Bodyguard reference + **bodyguard 3D mesh** | Soul 2 → SAM 3D                              | The Hollis Twins standing courtside                       |
| Hollis Twins art                            | Soul 2                                       | The Crib                                                  |

How assets load: local copy (`public/assets/higgsfield/…`) → Higgsfield CDN → built-in fallback. The fallbacks are procedural 3D ballers for models and a styled placeholder for images, so a missing asset never breaks the game. You can turn the AI models off in **Settings → Higgsfield 3D models**.

**Animations:** Higgsfield's rig library has no basketball clips, so the rigged GLB is animated in code. [`app/game/rig.ts`](app/game/rig.ts) finds the humanoid bones in any rig (Meshy, Mixamo, UE naming). [`app/game/animator.ts`](app/game/animator.ts) authors every move (dribbling, jumpers, dunks, crossovers, falls, celebrations) as IK targets, so the same moves drive any character model you generate.

**Adding more AI models** (credits permitting):

1. Generate a full-body A-pose image.
2. Run `sam_3_3d` (1 credit) or `image_to_3d` on it.
3. Run `3d_rigging` (5 credits) on the result.
4. Add an entry to `higgsfield-assets.ts` and set `model:` on the baller in `app/data/characters.ts`.

This build used 8.68 of your 10 free-plan credits (1.32 left). Higher-quality Meshy image-to-3D with texturing and rigging is ~38 credits per model on a paid plan, if you want every opponent as an AI model.

## Shipping on Steam

The desktop build is set up already (Electron + electron-builder):

```bash
npm install
npm run fetch-assets    # bundle the Higgsfield art + 3D models so the game works offline
npm run desktop         # build and launch the desktop app (F11 / Alt+Enter = fullscreen)
npm run desktop:dist    # package it into dist-desktop/ (win-unpacked, linux-unpacked, mac)
```

- `desktop/main.mjs` is the Electron shell. It serves the production build from a local port (`desktop/serve.mjs`) and starts the online relay for LAN games.
- Build each platform on that platform, or in CI (for example a Windows runner for the `.exe`).

To publish on Steam:

1. Join Steamworks (a $100 app credit per game), create the app, and fill in the store page. `npm run screenshots` makes the 1920×1080 shots.
2. Create a depot per platform and upload the folder from `dist-desktop/` (for example `win-unpacked/`) with SteamPipe (`steamcmd` + your app build script). Set the launch option to `Concrete Crown.exe`.
3. Optional: add `steamworks.js` to `desktop/main.mjs` for achievements, the overlay and Steam networking. Map story ★ objectives (`app/data/story.ts`) and career milestones (drafted, champion, "Mic Check" complete) to achievements.
4. Test on a clean machine (no dev tools installed) with a gamepad before you submit for review.

**Before you publish:**

- "NBA" and "NBA Ballers" are trademarks. This game deliberately uses an original name, cast, and league, so keep it that way.
- Check Higgsfield's commercial-use terms for your plan before selling the AI assets.

## Code map

```
app/
  data/          characters, venues, story chapters + dialogue, Higgsfield asset manifest,
                 career (HS → college → draft → EBL, scenes), attributes, EBL teams, cast, rap side quest, gear
  game/          engine (no React)
    game.ts        renderer, loop, camera, effects, HUD bridge
    match.ts       rules: possession, clearing, shot clock, shots, blocks, steals, specials
    ai.ts          CPU brain (produces the same Intents as a human)
    player.ts      per-player state + animation composition
    animator.ts    procedural basketball moves as IK targets
    rig.ts         rig-agnostic IK poser + humanoid bone discovery for GLBs
    body.ts        procedural baller builder + Higgsfield GLB loader
    court.ts       the five venues
    ball.ts        ball physics (rim torus, backboard, net)
    audio.ts       synthesized SFX + music sequencer
    input.ts       keyboard + gamepad (single or split P1/P2 schemes)
    net.ts         online link, snapshots, dead reckoning
    cutscene.ts    3D-staged dialogue scenes (court, draft stage, face-off)
    city.ts        walkable city hub (city-world.ts builds the NYC-style grid)
  components/    GameView (HUD, pause, shot meter), Dialogue, Blueprint, AttributeBuilder,
                 SchoolSelect, RapBooth, Results, AssetImage, …
  routes/        home, story, story/:chapterId, career, city, play, online, crib, roster, settings
server/relay.mjs    online room relay (npm run relay)
desktop/            Electron shell for the Steam build
scripts/            fetch-assets.mjs, steam-screenshots.mjs
```

## Continuing the story

Book Two (chapters 6–10) continues after THE ARCHITECT's message. To add chapters, append to `CHAPTERS` in `app/data/story.ts`. Each chapter is a dialogue intro, a match (opponent, venue, target score, difficulty, ★ objective), and win/lose scenes.

---

Built on the Dazl React Router template.
