# Concrete Crown — Book One: The Rebound

A 1-on-1 arcade streetball game in the spirit of *NBA Ballers: Rebound*, with an original cast, an original city, and a 5-chapter story mode. It runs in the browser with Three.js and is set up to be wrapped for Steam.

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
  - Kairo: *LIGHTS OUT*
  - Deuce: *GO VIRAL*
  - Brick: *WRECKING BALL*
  - Silk: *SMOKE & MIRRORS*
  - Queen: *CROWN JEWEL*
  - Monarch: *REIGN*
- **Five 3D courts.**
  - Pier 9 (harbor sunset)
  - The Cage (under the train tracks, with a train that rolls overhead)
  - Neon Alley (rain and neon signs)
  - Queensway Park (daylight)
  - The Crown (skyscraper rooftop in a thunderstorm)
- **Story mode.** Visual-novel dialogue with AI portraits, a bonus ★ objective in every chapter, and a Book Two teaser at the end.
- **The Crib.** Kairo's house goes from the Harbor Loft to the Crown Penthouse. His bodyguards, the Hollis Twins, stand courtside at his games.
- **Quick Match.** Any unlocked baller, any court, games to 11/15/21, and three difficulty levels.
- **Procedural IK animation.** One animation system drives both the built-in procedural ballers and the Higgsfield rigged GLB.
- **Synthesized audio.** A boom-bap music sequencer, crowd noise, rim/swish/slam sound effects, and no licensed samples, so it's Steam-safe.
- **Keyboard and gamepad.** Rumble is supported. Fonts are bundled, so the game works offline.

## Controls

| Action                   | Keyboard           | Gamepad            |
| ------------------------ | ------------------ | ------------------ |
| Move                     | WASD / Arrows      | Left stick / D-pad |
| Shoot (hold, release in the green) | J        | A                  |
| Dunk                     | Shift + J near rim | RT + A             |
| Crossover / Steal        | K                  | X                  |
| Trick dribble            | L                  | Y                  |
| Off the glass (then J to catch) | U           | B                  |
| Block / Rebound          | J on defense       | A                  |
| Special (HYPE full)      | Space              | RB                 |
| Turbo                    | Shift              | RT / LT            |
| Pause                    | Esc / P            | Start              |

## Running it

```bash
npm install
npm run fetch-assets   # download the Higgsfield art + 3D models into public/ (recommended)
npm run dev            # http://localhost:5173
```

Dev-only tools:

- `/dev/attract?p=kairo&o=monarch&v=the-crown` runs a CPU-vs-CPU match.
- `window.__cc.debugState()` in the console shows the live match state.

## Higgsfield AI assets

Every image and 3D model in the game was generated with Higgsfield. They're listed with their job IDs and prompts in [`app/data/higgsfield-assets.ts`](app/data/higgsfield-assets.ts).

| Asset | Model | Used for |
| --- | --- | --- |
| Kairo A-pose reference | Soul 2 | Source image for the 3D model |
| **Kairo 3D mesh** | SAM 3D (image → textured GLB) | — |
| **Kairo rigged GLB** | Meshy 3D Rigging (humanoid skeleton, 1.93 m) | Kairo in-game, animated live by the IK system |
| 7 character portraits | Soul 2 | Story dialogue, scoreboard, versus screen, select screens |
| Key art (rooftop windmill dunk) | Soul 2 | Title screen, finale backdrop |
| Harbor Loft + Crown Penthouse | Soul 2 | The Crib |
| Bodyguard reference + **bodyguard 3D mesh** | Soul 2 → SAM 3D | The Hollis Twins standing courtside |
| Hollis Twins art | Soul 2 | The Crib |

How assets load: local copy (`public/assets/higgsfield/…`) → Higgsfield CDN → built-in fallback. The fallbacks are procedural 3D ballers for models and a styled placeholder for images, so a missing asset never breaks the game. You can turn the AI models off in **Settings → Higgsfield 3D models**.

**Animations:** Higgsfield's rig library has no basketball clips, so the rigged GLB is animated in code. [`app/game/rig.ts`](app/game/rig.ts) finds the humanoid bones in any rig (Meshy, Mixamo, UE naming). [`app/game/animator.ts`](app/game/animator.ts) authors every move (dribbling, jumpers, dunks, crossovers, falls, celebrations) as IK targets, so the same moves drive any character model you generate.

**Adding more AI models** (credits permitting):

1. Generate a full-body A-pose image.
2. Run `sam_3_3d` (1 credit) or `image_to_3d` on it.
3. Run `3d_rigging` (5 credits) on the result.
4. Add an entry to `higgsfield-assets.ts` and set `model:` on the baller in `app/data/characters.ts`.

This build used 8.68 of your 10 free-plan credits (1.32 left). Higher-quality Meshy image-to-3D with texturing and rigging is ~38 credits per model on a paid plan, if you want every opponent as an AI model.

## Shipping on Steam

The game is a web app, so the usual route is to wrap it with **Electron** (or Tauri) and add **steamworks.js** for achievements and overlay:

1. **Make a static (SPA) build.** Set `ssr: false` in `react-router.config.ts`, then run `npm run build`. The client lands in `build/client/`.
2. **Download all assets locally.** Run `npm run fetch-assets` so nothing needs the internet. Fonts are already bundled.
3. **Wrap it.** Add `electron` and `electron-builder`, and create a main process that opens `build/client/index.html` in a fullscreen `BrowserWindow`. Gamepad support works in Electron out of the box.
4. **Add Steam features.** Add `steamworks.js` and map story objectives (`app/data/story.ts`) to achievements, e.g. *Beat Monarch*, *Break Silk's ankles*, *Perfect release*.
5. **Upload.** Upload the packaged build with SteamPipe (`steamcmd` + your app/depot IDs).

**Before you publish:**

- "NBA" and "NBA Ballers" are trademarks. This game deliberately uses an original name, cast, and league, so keep it that way.
- Check Higgsfield's commercial-use terms for your plan before selling the AI assets.

## Code map

```
app/
  data/          characters, venues, story chapters + dialogue, Higgsfield asset manifest
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
    input.ts       keyboard + gamepad
  components/    GameView (HUD, pause, shot meter), Dialogue, Results, AssetImage, …
  routes/        home, story, story/:chapterId, play, crib, roster, settings
scripts/fetch-assets.mjs
```

## Continuing the story

Book One ends with a message from **THE ARCHITECT** and a tease for *Book Two: The Undercity*. To add chapters, append to `CHAPTERS` in `app/data/story.ts`. Each chapter is a dialogue intro, a match (opponent, venue, target score, difficulty, ★ objective), and win/lose scenes.

---

Built on the Dazl React Router template.
