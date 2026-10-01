#!/usr/bin/env node
/**
 * Builds one of the four EBL 2 versions. The platform is pinned at build
 * time (VITE_PLATFORM), which fixes button prompts and layout defaults.
 *
 *   npm run build:pc           Windows/Linux desktop folder for Steam (electron-builder)
 *   npm run build:steamdeck    Linux x64 folder for the Steam Deck depot
 *   npm run build:xbox         Web build + server for the Xbox shell (see platforms/xbox)
 *   npm run build:playstation  Web build + server for the PS5 shell (see platforms/playstation)
 *
 * Console packaging itself (GDK / PS5 SDK) happens on your dev-kit machine;
 * see platforms/README.md.
 */
import { spawnSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";

const PLATFORMS = {
  pc: { name: "PC (Steam)", resolution: "any", input: "keyboard-mouse+gamepad" },
  steamdeck: { name: "Steam Deck", resolution: "1280x800", input: "steam-input" },
  xbox: { name: "Xbox Series X|S", resolution: "3840x2160", input: "xbox-controller" },
  playstation: { name: "PlayStation 5", resolution: "3840x2160", input: "dualsense" },
};

const platform = process.argv[2];
if (!PLATFORMS[platform]) {
  console.error(`Usage: build-platform.mjs <${Object.keys(PLATFORMS).join("|")}>`);
  process.exit(1);
}

const run = (cmd, args, env = {}) => {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run("npx", ["react-router", "build"], { VITE_PLATFORM: platform });

const out = `dist-platform/${platform}`;
await rm(out, { recursive: true, force: true });
await mkdir(`${out}/desktop`, { recursive: true });

if (platform === "pc" || platform === "steamdeck") {
  // Electron shell around the build; the Deck gets a Linux x64 folder
  const target = platform === "steamdeck" ? ["--linux", "--x64"] : [];
  run("npx", ["electron-builder", "--dir", ...target, "-c.directories.output=" + out]);
} else {
  // Consoles: the server build + client assets for the platform shell to host
  await cp("build", `${out}/build`, { recursive: true });
  await cp("server", `${out}/server`, { recursive: true });
  await cp("desktop/serve.mjs", `${out}/desktop/serve.mjs`);
  await cp(`platforms/${platform}`, `${out}/platform`, { recursive: true });
}

await writeFile(
  `${out}/platform.json`,
  JSON.stringify({ game: "EBL 2", platform, ...PLATFORMS[platform], built: new Date().toISOString() }, null, 2),
);
console.log(`\n${PLATFORMS[platform].name} build ready in ${out}/`);
