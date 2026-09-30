#!/usr/bin/env node
/**
 * Captures Steam store screenshots (1920x1080) of every cutscene and the
 * main screens. Run the dev server first (npm run dev), and ideally
 * `npm run fetch-assets` so the Higgsfield portraits/art are local.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   npm run screenshots            # → steam-screenshots/*.png
 *   npm run screenshots -- --only=career
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const OUT = "steam-screenshots";
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

// [file, path, waitMs]
const STORY = [];
const picks = {
  ch1: [[11, "intro"], [0, "win"]],
  ch2: [[4, "intro"], [1, "win"]],
  ch3: [[6, "intro"], [2, "win"]],
  ch4: [[5, "intro"], [2, "win"]],
  ch5: [[5, "intro"], [2, "win"]],
  ch6: [[7, "intro"], [2, "win"]],
  ch7: [[2, "intro"], [2, "win"]],
  ch8: [[3, "intro"], [0, "win"]],
  ch9: [[5, "intro"], [1, "win"]],
  ch10: [[6, "intro"], [6, "win"]],
};
for (const [ch, list] of Object.entries(picks))
  for (const [at, part] of list) STORY.push([`story-${ch}-${part}-${at}`, `/dev/scene?ch=${ch}&part=${part}&at=${at}`, 2600]);

const CAREER = [
  ["career-00-signing-day", "/dev/scene?s=schools&wins=2", 1500],
  ["career-01-highschool", "/dev/scene?s=hsIntro&at=5&title=Senior%20Year%20%C2%B7%20Harbor%20Heights%20High", 2600],
  ["career-02-rival-dre", "/dev/scene?s=hsIntro&at=9&title=Senior%20Year%20%C2%B7%20Harbor%20Heights%20High", 2600],
  ["career-03-dre-text", "/dev/scene?s=hsWin&g=1&at=3&title=Postgame", 2600],
  ["career-04-city-champs", "/dev/scene?s=hsWin&g=2&at=1&title=City%20Championship", 2600],
  ["career-05-college-imani", "/dev/scene?s=collegeIntro&at=4&title=Freshman%20Year%20%C2%B7%20Coastal%20Tech", 2600],
  ["career-06-dre-conference", "/dev/scene?s=collegeAfter&g=3&at=1&title=Conference%20Championship", 2600],
  ["career-07-draft-dre", "/dev/scene?s=draft&at=4&title=EBL%20Draft%20Night", 2600],
  ["career-08-draft-pick", "/dev/scene?s=draft&at=6&title=EBL%20Draft%20Night", 2600],
  ["career-09-draft-reporter", "/dev/scene?s=draft&at=8&title=EBL%20Draft%20Night", 2600],
  ["career-10-rookie", "/dev/scene?s=proIntro&at=2&title=Rookie%20Season", 2600],
  ["career-11-coffee-date", "/dev/scene?s=date0&at=1&title=Date%20with%20Imani", 2600],
  ["career-12-rooftop-date", "/dev/scene?s=date2&at=1&title=Date%20with%20Imani", 2600],
  ["career-13-sunday-dinner", "/dev/scene?s=brother&at=3&title=Sunday%20Dinner%20at%20the%20Coles%27", 2600],
  ["career-14-press", "/dev/scene?s=press1&at=1&title=Press%20Conference", 2600],
  ["career-15-kane", "/dev/scene?s=kane&at=1&title=Front%20Row", 2600],
  ["career-16-official", "/dev/scene?s=official&at=1&title=Pier%209", 2600],
  ["career-17-champions", "/dev/scene?s=champion&at=1&title=Champions", 2600],
  ["career-18-rap-studio", "/dev/scene?s=rapIntro0&at=1&title=Side%20Quest%20%C2%B7%20Studio%20Session", 2600],
  ["career-19-rap-booth", "/dev/scene?s=rap&step=1&demo=9", 1500],
  ["career-20-rap-diss", "/dev/scene?s=rapIntro1&at=1&title=Side%20Quest%20%C2%B7%20Diss%20Track", 2600],
  ["career-21-rap-concert", "/dev/scene?s=rapIntro3&at=2&title=Side%20Quest%20%C2%B7%20Live%20at%20the%20Crown", 2600],
];

const SCREENS = [
  ["screen-title", "/", 4000],
  ["screen-builder", "/dev/builder", 3000],
  ["screen-roster", "/roster", 7000],
  ["screen-story", "/story", 3000],
  ["screen-crib", "/crib", 3000],
  ["screen-quick-match", "/play", 3000],
];

const GAME = [
  ["game-crown-dunk", "/dev/attract?p=kairo&o=monarch&v=the-crown&t=99", "dunk"],
  ["game-crown-special", "/dev/attract?p=kairo&o=monarch&v=the-crown&t=99", "special"],
  ["game-neon-ankles", "/dev/attract?p=kairo&o=silk&v=neon-alley&t=99", "ankles"],
  ["game-cage", "/dev/attract?p=kairo&o=brick&v=the-cage&t=99", "live"],
  ["game-arena", "/dev/attract?p=kairo&o=ebl-gca&v=arena-gca&t=99", "shoot"],
  ["game-glass-house", "/dev/attract?p=kairo&o=architect&v=glass-house&t=99", "live"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await mkdir(OUT, { recursive: true });

const shoot = async ([file, path, wait]) => {
  await page.goto(BASE + path, { waitUntil: "load", timeout: 120000 });
  // Cutscenes: wait for the 3D stage and for the typewriter to finish
  await page.waitForFunction(() => { const t = document.querySelector("[data-typed]"); return !t || t.dataset.typed === "true"; }, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.evaluate(() => window.__stage?.settle());
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${file}.png` });
  console.log("✓", file);
};

if (!only || only === "story") for (const s of STORY) await shoot(s);
if (!only || only === "career") for (const s of CAREER) await shoot(s);
if (!only || only === "screens") for (const s of SCREENS) await shoot(s);
if (!only || only === "game")
  for (const [file, path, moment] of GAME) {
    await page.goto(BASE + path, { waitUntil: "load" });
    await page.waitForFunction(() => window.__cc, null, { timeout: 60000 });
    await page.evaluate((m) => {
      const g = window.__cc;
      const mt = g.match;
      const act = (p, t, a, b) => p.action && p.action.type === t && p.action.t >= a && p.action.t <= b;
      const test = () => {
        const [a, b] = mt.players;
        if (m === "live") return mt.phase === "live" && mt.handler && mt.handler.pos.z < 8;
        if (m === "shoot") return [a, b].some((p) => act(p, "shoot", 0.42, 0.5));
        if (m === "dunk") return [a, b].some((p) => act(p, "dunk", 0.6, 0.7));
        if (m === "ankles") return [a, b].some((p) => act(p, "stumble", 0.4, 0.6));
        if (m === "special") return mt.phase === "special" && mt.specialOf?.action?.t > 1.5;
      };
      for (let i = 0; i < 60 * 400 && !test(); i++) g.step(1 / 60);
      g.paused = true;
    }, moment);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${file}.png` });
    console.log("✓", file);
  }
await browser.close();
