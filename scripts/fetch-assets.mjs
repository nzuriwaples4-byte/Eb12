#!/usr/bin/env node
/**
 * Downloads every Higgsfield-generated asset listed in
 * app/data/higgsfield-assets.ts into public/assets/higgsfield/ so the game
 * (and the Steam build) runs fully offline.
 *
 *   npm run fetch-assets          # download missing files
 *   npm run fetch-assets -- --force
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");
const src = await readFile(join(root, "app/data/higgsfield-assets.ts"), "utf8");
const cdn = src.match(/const CDN = "([^"]+)"/)?.[1];
const entries = [...src.matchAll(/local: "([^"]+)",\s*remote: `\$\{CDN\}([^`]+)`/g)].map((m) => ({
  local: m[1],
  remote: cdn + m[2],
}));

let ok = 0;
for (const { local, remote } of entries) {
  const out = join(root, "public", local);
  if (!force) {
    try {
      await access(out);
      console.log(`✓ ${local} (already downloaded)`);
      ok++;
      continue;
    } catch {}
  }
  try {
    const res = await fetch(remote);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, Buffer.from(await res.arrayBuffer()));
    console.log(`↓ ${local}`);
    ok++;
  } catch (e) {
    console.error(`✗ ${local}: ${e.message}`);
  }
}
console.log(`\n${ok}/${entries.length} Higgsfield assets available locally.`);
