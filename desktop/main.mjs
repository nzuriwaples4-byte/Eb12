// Concrete Crown desktop shell (Steam build).
// Serves the production build from a local HTTP server inside Electron and
// opens it in a fullscreen-capable window. Also hosts the online relay so a
// player can host LAN games without any other setup.
import { app, BrowserWindow, Menu, shell } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startServer } from "./serve.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function startRelay() {
  // Hosts online rooms on this machine (port 8787) for LAN play
  try {
    process.env.PORT ??= "8787";
    await import(pathToFileURL(path.join(root, "server", "relay.mjs")).href);
  } catch (e) {
    console.warn("Relay not started:", e.message);
  }
}

async function createWindow() {
  const port = await startServer();
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: "#05070c",
    title: "Concrete Crown",
    autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.type === "keyDown" && (input.key === "F11" || (input.alt && input.key === "Enter")))
      win.setFullScreen(!win.isFullScreen());
  });
  // Links to the outside world open in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  await win.loadURL(`http://127.0.0.1:${port}/`);
  if (process.argv.includes("--fullscreen")) win.setFullScreen(true);
}

app.whenReady().then(async () => {
  await startRelay();
  await createWindow();
});
app.on("window-all-closed", () => app.quit());
