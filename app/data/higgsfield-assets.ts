/**
 * Every AI-generated asset in the game was made with Higgsfield AI.
 *
 * Each entry has:
 *  - `local`: where `npm run fetch-assets` saves the file (served from /public).
 *    The Steam build should always ship these local copies.
 *  - `remote`: the Higgsfield CDN URL the game falls back to when the local
 *    copy has not been downloaded yet.
 *  - `job`: the Higgsfield job id, so the asset can be found / regenerated.
 *
 * `scripts/fetch-assets.mjs` reads this file, so keep the shape simple.
 */
export interface HiggsfieldAsset {
  id: string;
  kind: "image" | "model";
  local: string;
  remote: string;
  job: string;
  model: string;
  prompt: string;
}

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3F2FAtwzEAA9ttm2nUYnwZwowzA";

export const HIGGSFIELD_ASSETS = {
  "kairo-apose": {
    id: "kairo-apose",
    kind: "image",
    local: "/assets/higgsfield/kairo-apose.png",
    remote: `${CDN}/hf_20260926_000153_1ac16c32-c28e-401c-98d2-27aae1ff5af9.png`,
    job: "1ac16c32-c28e-401c-98d2-27aae1ff5af9",
    model: "soul_2",
    prompt: "Full-body A-pose reference of Kairo 'Static' Vance (source image for the 3D model).",
  },
  "kairo-mesh": {
    id: "kairo-mesh",
    kind: "model",
    local: "/assets/higgsfield/kairo-mesh.glb",
    remote: `${CDN}/hf_20260926_000308_3fe36f16-9a96-48df-8c39-cc7151c02dc1.glb`,
    job: "3fe36f16-9a96-48df-8c39-cc7151c02dc1",
    model: "sam_3_3d",
    prompt: "Image-to-3D textured mesh lifted from kairo-apose.",
  },
  "kairo-rigged": {
    id: "kairo-rigged",
    kind: "model",
    local: "/assets/higgsfield/kairo-rigged.glb",
    remote: `${CDN}/hf_20260926_000402_95f3e3d6-f543-40d4-aa3a-dd71cc76961f.glb`,
    job: "95f3e3d6-f543-40d4-aa3a-dd71cc76961f",
    model: "3d_rigging",
    prompt: "Humanoid auto-rig of kairo-mesh (height 1.93m). Animated in-engine by the procedural IK animator.",
  },
  "kairo-portrait": {
    id: "kairo-portrait",
    kind: "image",
    local: "/assets/higgsfield/kairo-portrait.png",
    remote: `${CDN}/hf_20260926_000633_ce880752-5153-4944-85ee-86e175567c09.png`,
    job: "ce880752-5153-4944-85ee-86e175567c09",
    model: "soul_2",
    prompt: "Waist-up portrait of Kairo spinning a ball, electric-blue rim light.",
  },
  "nia-portrait": {
    id: "nia-portrait",
    kind: "image",
    local: "/assets/higgsfield/nia-portrait.png",
    remote: `${CDN}/hf_20260926_000338_8cbb80b6-4692-41b4-8fa3-d9d04c227c57.png`,
    job: "8cbb80b6-4692-41b4-8fa3-d9d04c227c57",
    model: "soul_2",
    prompt: "Nia Vance, box braids, mustard hoodie, clipboard, harbor court at sunset.",
  },
  "deuce-portrait": {
    id: "deuce-portrait",
    kind: "image",
    local: "/assets/higgsfield/deuce-portrait.png",
    remote: `${CDN}/hf_20260926_000338_8e69230c-2cbe-45a6-afbe-83928e198a25.png`,
    job: "8e69230c-2cbe-45a6-afbe-83928e198a25",
    model: "soul_2",
    prompt: "Deuce, backwards snapback, orange #2 jersey, livestreaming on his phone.",
  },
  "brick-portrait": {
    id: "brick-portrait",
    kind: "image",
    local: "/assets/higgsfield/brick-portrait.png",
    remote: `${CDN}/hf_20260926_000708_f3275440-20d1-48fe-bed2-ad05392ab208.png`,
    job: "f3275440-20d1-48fe-bed2-ad05392ab208",
    model: "soul_2",
    prompt: "Brick Moreno, 6'9\" enforcer, red #44, cage court under the train tracks.",
  },
  "silk-portrait": {
    id: "silk-portrait",
    kind: "image",
    local: "/assets/higgsfield/silk-portrait.png",
    remote: `${CDN}/hf_20260926_000338_a5c119f2-b564-4bdc-8ea9-cf1f988adb9a.png`,
    job: "a5c119f2-b564-4bdc-8ea9-cf1f988adb9a",
    model: "soul_2",
    prompt: "Silk Park, silver middle-part, violet #11, neon alley court in the rain.",
  },
  "queen-portrait": {
    id: "queen-portrait",
    kind: "image",
    local: "/assets/higgsfield/queen-portrait.png",
    remote: `${CDN}/hf_20260926_000338_8945dea7-150e-46b6-80d6-1e053328d50b.png`,
    job: "8945dea7-150e-46b6-80d6-1e053328d50b",
    model: "soul_2",
    prompt: "Queen Okoro, afro puff with gold cuffs, emerald #3, park court in daylight.",
  },
  "monarch-portrait": {
    id: "monarch-portrait",
    kind: "image",
    local: "/assets/higgsfield/monarch-portrait.png",
    remote: `${CDN}/hf_20260926_000338_37d91b5a-04d7-4591-a614-727b2b904b39.png`,
    job: "37d91b5a-04d7-4591-a614-727b2b904b39",
    model: "soul_2",
    prompt: "Monarch Marcus Vale, gold headband, black & gold #1, stormy rooftop skyline.",
  },
  "ricochet-portrait": {
    id: "ricochet-portrait",
    kind: "image",
    local: "/assets/higgsfield/ricochet-portrait.png",
    remote: `${CDN}/hf_20260929_225818_a8dd1e02-03ac-4738-9229-6688b0184d5f.png`,
    job: "a8dd1e02-03ac-4738-9229-6688b0184d5f",
    model: "soul_2",
    prompt: "Ricochet, lime #7, abandoned subway station court.",
  },
  "metronome-portrait": {
    id: "metronome-portrait",
    kind: "image",
    local: "/assets/higgsfield/metronome-portrait.png",
    remote: `${CDN}/hf_20260929_225934_156cd18c-a79c-47b9-92c5-da5e86391366.png`,
    job: "156cd18c-a79c-47b9-92c5-da5e86391366",
    model: "soul_2",
    prompt: "Metronome, white/navy combine jersey #9, pro training gym.",
  },
  "titan-portrait": {
    id: "titan-portrait",
    kind: "image",
    local: "/assets/higgsfield/titan-portrait.png",
    remote: `${CDN}/hf_20260929_230526_a7cdab91-5bb6-4c26-be77-67ced1eef694.png`,
    job: "a7cdab91-5bb6-4c26-be77-67ced1eef694",
    model: "soul_2",
    prompt: "Titan, 7-foot-1 teal #55, flooded drainage tunnel.",
  },
  "echo-portrait": {
    id: "echo-portrait",
    kind: "image",
    local: "/assets/higgsfield/echo-portrait.png",
    remote: `${CDN}/hf_20260929_225818_aa843f12-c654-45b9-b208-df9bbe524933.png`,
    job: "aa843f12-c654-45b9-b208-df9bbe524933",
    model: "soul_2",
    prompt: "Echo, white half-face mask, silver #00, foggy pier at midnight.",
  },
  "architect-portrait": {
    id: "architect-portrait",
    kind: "image",
    local: "/assets/higgsfield/architect-portrait.png",
    remote: `${CDN}/hf_20260929_225818_9fb153c7-70ab-43f2-a891-4adfd142edca.png`,
    job: "9fb153c7-70ab-43f2-a891-4adfd142edca",
    model: "soul_2",
    prompt: "The Architect, blazer and turtleneck, glass penthouse arena.",
  },
  "city-aerial": {
    id: "city-aerial",
    kind: "image",
    local: "/assets/higgsfield/city-aerial.png",
    remote: `${CDN}/hf_20260929_225818_703d92b6-2fc2-4c20-a5ad-1db3e03509db.png`,
    job: "703d92b6-2fc2-4c20-a5ad-1db3e03509db",
    model: "soul_2",
    prompt: "Aerial golden-hour view of Meridian City's downtown court plaza.",
  },
  "imani-portrait": {
    id: "imani-portrait",
    kind: "image",
    local: "/assets/higgsfield/imani-portrait.png",
    remote: `${CDN}/hf_20260929_233007_5a27b2e7-e489-4c88-8cb6-f1cb93d318a6.png`,
    job: "5a27b2e7-e489-4c88-8cb6-f1cb93d318a6",
    model: "soul_2",
    prompt: "Imani Brooks, sports photographer, curly puff, denim jacket, camera, courtside.",
  },
  "key-art": {
    id: "key-art",
    kind: "image",
    local: "/assets/higgsfield/key-art.png",
    remote: `${CDN}/hf_20260926_001452_5420f7b6-1642-449c-8860-dc8cd4fd6622.png`,
    job: "5420f7b6-1642-449c-8860-dc8cd4fd6622",
    model: "soul_2",
    prompt: "Kairo mid-air windmill dunk on a rooftop court in a thunderstorm.",
  },
  "kairo-studio": {
    id: "kairo-studio",
    kind: "image",
    local: "/assets/higgsfield/kairo-studio.png",
    remote: `${CDN}/hf_20260926_000338_3ae34c3a-2942-40ab-a3c3-0c397666c279.png`,
    job: "3ae34c3a-2942-40ab-a3c3-0c397666c279",
    model: "soul_2",
    prompt: "Wide studio shot of Kairo in his #00 kit.",
  },
  "crib-loft": {
    id: "crib-loft",
    kind: "image",
    local: "/assets/higgsfield/crib-loft.png",
    remote: `${CDN}/hf_20260926_001452_7957a6a0-0734-4697-af65-67d92a4840cd.png`,
    job: "7957a6a0-0734-4697-af65-67d92a4840cd",
    model: "soul_2",
    prompt: "Kairo's starting crib: a gritty loft above a harbor warehouse at night.",
  },
  "crib-penthouse": {
    id: "crib-penthouse",
    kind: "image",
    local: "/assets/higgsfield/crib-penthouse.png",
    remote: `${CDN}/hf_20260926_001452_9f776a70-2e0a-4eb5-bc06-bf2442d8b2e5.png`,
    job: "9f776a70-2e0a-4eb5-bc06-bf2442d8b2e5",
    model: "soul_2",
    prompt: "The Crown Penthouse: skyscraper penthouse with a private indoor half-court.",
  },
  "bodyguard-full": {
    id: "bodyguard-full",
    kind: "image",
    local: "/assets/higgsfield/bodyguard-full.png",
    remote: `${CDN}/hf_20260926_001452_7d63fc4b-331b-4c1d-b3c0-3fb372b96678.png`,
    job: "7d63fc4b-331b-4c1d-b3c0-3fb372b96678",
    model: "soul_2",
    prompt: "Full-body bodyguard reference (source image for the 3D bodyguard).",
  },
  "bodyguard-mesh": {
    id: "bodyguard-mesh",
    kind: "model",
    local: "/assets/higgsfield/bodyguard-mesh.glb",
    remote: `${CDN}/hf_20260926_131249_39689ec6-527f-4546-b7c8-96b6214c422a.glb`,
    job: "39689ec6-527f-4546-b7c8-96b6214c422a",
    model: "sam_3_3d",
    prompt: "Textured 3D bodyguard lifted from bodyguard-full. Stands courtside in Kairo's matches.",
  },
  "bodyguards-twins": {
    id: "bodyguards-twins",
    kind: "image",
    local: "/assets/higgsfield/bodyguards-twins.png",
    remote: `${CDN}/hf_20260926_131252_508a5e3d-7437-41b0-a024-027bc0aeea97.png`,
    job: "508a5e3d-7437-41b0-a024-027bc0aeea97",
    model: "soul_2",
    prompt: "The Hollis Twins, Kairo's identical bodyguards, at the entrance of a neon court.",
  },
} satisfies Record<string, HiggsfieldAsset>;

export type AssetId = keyof typeof HIGGSFIELD_ASSETS;

/** Candidate URLs for an asset, best first. */
export function assetSources(id: AssetId): string[] {
  const a = HIGGSFIELD_ASSETS[id];
  return [a.local, a.remote];
}
