# PC (Steam)

    npm run build:pc

Produces an Electron folder in `dist-platform/pc/` (`win-unpacked/` on Windows,
`linux-unpacked/` on Linux). Upload it as the Windows depot with SteamPipe and
set the launch option to `EBL 2.exe`.

- Keyboard & mouse by default; plugging in a controller switches prompts to it
  (Xbox, PlayStation or Steam Deck layout, detected from the pad's id).
- `--fullscreen` starts fullscreen; F11 or Alt+Enter toggles it.
