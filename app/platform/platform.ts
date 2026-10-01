/**
 * The four EBL 2 versions: PC (keyboard/mouse or any pad), Steam Deck,
 * Xbox and PlayStation. The platform decides button prompts, layout tweaks
 * and defaults. Console and Deck builds pin it at build time (VITE_PLATFORM);
 * otherwise it's detected from the device and the connected controller.
 */

export type Platform = "pc" | "steamdeck" | "xbox" | "playstation";
export type PlatformSetting = "auto" | Platform;

export type Action =
  | "confirm"
  | "back"
  | "interact"
  | "menu"
  | "move"
  | "camera"
  | "sprint"
  | "shoot"
  | "juke"
  | "trick"
  | "lob"
  | "special"
  | "tabPrev"
  | "tabNext";

export interface Glyph {
  /** Text on the button */
  label: string;
  /** Shape: face button, shoulder, stick, key or wide key */
  shape: "face" | "shoulder" | "stick" | "key" | "wide" | "system";
  /** Face color (Xbox / PlayStation) */
  color?: string;
}

export const PLATFORM_INFO: Record<Platform, { name: string; short: string; resolution: string; pad: string }> = {
  pc: { name: "PC (Steam)", short: "PC", resolution: "Any · 1080p–4K", pad: "Keyboard & mouse or any controller" },
  steamdeck: { name: "Steam Deck", short: "Deck", resolution: "1280 × 800 · 16:10", pad: "Built-in controls + trackpads" },
  xbox: { name: "Xbox Series X|S", short: "Xbox", resolution: "4K / 1440p · 60 fps", pad: "Xbox Wireless Controller" },
  playstation: { name: "PlayStation 5", short: "PS5", resolution: "4K / 1440p · 60 fps", pad: "DualSense" },
};

const XBOX: Record<Action, Glyph> = {
  confirm: { label: "A", shape: "face", color: "#3fb34f" },
  back: { label: "B", shape: "face", color: "#e0393e" },
  interact: { label: "A", shape: "face", color: "#3fb34f" },
  menu: { label: "≡", shape: "system" },
  move: { label: "LS", shape: "stick" },
  camera: { label: "RS", shape: "stick" },
  sprint: { label: "RT", shape: "shoulder" },
  shoot: { label: "X", shape: "face", color: "#2f7bd9" },
  juke: { label: "B", shape: "face", color: "#e0393e" },
  trick: { label: "Y", shape: "face", color: "#f2c21b" },
  lob: { label: "A", shape: "face", color: "#3fb34f" },
  special: { label: "RB", shape: "shoulder" },
  tabPrev: { label: "LB", shape: "shoulder" },
  tabNext: { label: "RB", shape: "shoulder" },
};

const PS: Record<Action, Glyph> = {
  confirm: { label: "✕", shape: "face", color: "#7ba7e8" },
  back: { label: "○", shape: "face", color: "#ef6f7a" },
  interact: { label: "✕", shape: "face", color: "#7ba7e8" },
  menu: { label: "OPTIONS", shape: "system" },
  move: { label: "L", shape: "stick" },
  camera: { label: "R", shape: "stick" },
  sprint: { label: "R2", shape: "shoulder" },
  shoot: { label: "□", shape: "face", color: "#e98ccf" },
  juke: { label: "○", shape: "face", color: "#ef6f7a" },
  trick: { label: "△", shape: "face", color: "#5fd0a2" },
  lob: { label: "✕", shape: "face", color: "#7ba7e8" },
  special: { label: "R1", shape: "shoulder" },
  tabPrev: { label: "L1", shape: "shoulder" },
  tabNext: { label: "R1", shape: "shoulder" },
};

// Steam Deck: Xbox layout letters on dark buttons
const DECK: Record<Action, Glyph> = Object.fromEntries(
  Object.entries(XBOX).map(([k, g]) => [
    k,
    {
      ...g,
      color: g.shape === "face" ? "#2a2d33" : undefined,
      label: g.label === "LB" ? "L1" : g.label === "RB" ? "R1" : g.label === "RT" ? "R2" : g.label === "LT" ? "L2" : g.label,
    },
  ]),
) as Record<Action, Glyph>;
DECK.menu = { label: "☰", shape: "system" };

const PC: Record<Action, Glyph> = {
  confirm: { label: "Enter", shape: "wide" },
  back: { label: "Esc", shape: "key" },
  interact: { label: "E", shape: "key" },
  menu: { label: "Esc", shape: "key" },
  move: { label: "WASD", shape: "wide" },
  camera: { label: "Mouse", shape: "wide" },
  sprint: { label: "Shift", shape: "wide" },
  shoot: { label: "J", shape: "key" },
  juke: { label: "K", shape: "key" },
  trick: { label: "L", shape: "key" },
  lob: { label: "U", shape: "key" },
  special: { label: "Space", shape: "wide" },
  tabPrev: { label: "Q", shape: "key" },
  tabNext: { label: "R", shape: "key" },
};

export const GLYPHS: Record<Platform, Record<Action, Glyph>> = { pc: PC, steamdeck: DECK, xbox: XBOX, playstation: PS };

export const ACTION_LABEL: Record<Action, string> = {
  confirm: "Confirm",
  back: "Back",
  interact: "Interact",
  menu: "Pause / menu",
  move: "Move",
  camera: "Camera",
  sprint: "Sprint / turbo",
  shoot: "Shoot",
  juke: "Juke",
  trick: "Trick",
  lob: "Lob / pass",
  special: "Special move",
  tabPrev: "Previous tab",
  tabNext: "Next tab",
};

/** Build-time pin for console and Deck builds */
export const BUILD_PLATFORM = (import.meta.env.VITE_PLATFORM as Platform | undefined) || null;

const BOOT_KEY = "ebl2.platform.boot";

/** Best guess from the device and the controller plugged in */
export function detectPlatform(): Platform {
  if (BUILD_PLATFORM) return BUILD_PLATFORM;
  if (typeof window === "undefined") return "pc";
  try {
    // The desktop shell passes ?platform= (e.g. Steam sets SteamDeck=1 on the Deck)
    const q = new URLSearchParams(window.location.search).get("platform") as Platform | null;
    if (q && q in PLATFORM_INFO) {
      sessionStorage.setItem(BOOT_KEY, q);
      return q;
    }
    const boot = sessionStorage.getItem(BOOT_KEY) as Platform | null;
    if (boot && boot in PLATFORM_INFO) return boot;
  } catch {
    /* storage blocked */
  }
  const ua = navigator.userAgent;
  if (/Xbox/i.test(ua)) return "xbox";
  if (/PlayStation/i.test(ua)) return "playstation";
  if (/SteamOS|Steam Deck/i.test(ua) || (/Linux/.test(ua) && screen.width === 1280 && screen.height === 800))
    return "steamdeck";
  const pad = navigator.getGamepads?.().find(Boolean);
  if (pad) return padPlatform(pad.id) ?? "pc";
  return "pc";
}

/** Which prompts to show for a controller, from its id string */
export function padPlatform(id: string): Platform | null {
  if (/054c|DualSense|DualShock|PlayStation/i.test(id)) return "playstation";
  if (/28de|Steam Deck|Valve/i.test(id)) return "steamdeck";
  if (/045e|Xbox|XInput|STANDARD GAMEPAD/i.test(id)) return "xbox";
  return null;
}
