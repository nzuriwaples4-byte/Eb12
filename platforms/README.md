# EBL 2 — platform versions

One codebase, four versions. The platform is pinned at build time
(`VITE_PLATFORM`) and decides button prompts, menu navigation defaults and
layout tweaks. In development, pick any platform in **Settings → Platform &
controls** or add `?platform=xbox` (or `pc`, `steamdeck`, `playstation`) to the URL.

| Version | Build | Output | Input | Prompts |
| --- | --- | --- | --- | --- |
| PC (Steam) | `npm run build:pc` | `dist-platform/pc/` | Keyboard & mouse, any controller | Keys, or the plugged-in pad's buttons |
| Steam Deck | `npm run build:steamdeck` | `dist-platform/steamdeck/linux-unpacked/` | Built-in controls via Steam Input | Deck A/B/X/Y, L1/R1, L2/R2 |
| Xbox Series X\|S | `npm run build:xbox` | `dist-platform/xbox/` | Xbox Wireless Controller | A/B/X/Y, LB/RB, LT/RT, ≡ |
| PlayStation 5 | `npm run build:playstation` | `dist-platform/playstation/` | DualSense | ✕ ○ □ △, L1/R1, L2/R2, OPTIONS |

## What every version shares

- **Full controller navigation** on every screen (`app/platform/gamepad-nav.ts`):
  D-pad/left stick moves focus, A/✕ selects, B/○ goes back, LB/RB (L1/R1) switch
  tabs, Start/OPTIONS opens the menu or skips a cutscene.
- **Platform button glyphs** everywhere a prompt appears (`<Glyph action="interact" />`).
- **Rumble** on dunks and big plays where the controller supports it.

## Per-platform notes

- [PC](pc/README.md)
- [Steam Deck](steamdeck/README.md)
- [Xbox](xbox/README.md)
- [PlayStation 5](playstation/README.md)

Console packaging uses each platform holder's SDK and tools, which are under
NDA. The steps here stop where the SDK takes over: run them on the machine
that has your dev kits and SDK installed.
