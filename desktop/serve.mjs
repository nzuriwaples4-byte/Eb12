// Serves the production build (static client files + React Router SSR) on
// a local port. Used by the Electron shell; runnable on its own for testing:
//   node desktop/serve.mjs
import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequestListener } from "@react-router/node";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "build", "client");

const MIME = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

/** Serve a file from build/client if it exists, else hand the request to React Router */
function staticFile(req, res) {
  const url = new URL(req.url ?? "/", "http://local");
  const file = path.join(clientDir, decodeURIComponent(url.pathname));
  if (!file.startsWith(clientDir) || !existsSync(file) || !statSync(file).isFile()) return false;
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": url.pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file).pipe(res);
  return true;
}

export async function startServer(port = 0) {
  const build = await import(pathToFileURL(path.join(root, "build", "server", "index.js")).href);
  const handle = createRequestListener({ build, mode: "production" });
  const server = http.createServer((req, res) => {
    if (!staticFile(req, res)) handle(req, res);
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return server.address().port;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = await startServer(Number(process.env.PORT ?? 3210));
  console.log(`Concrete Crown running at http://127.0.0.1:${port}/`);
}
