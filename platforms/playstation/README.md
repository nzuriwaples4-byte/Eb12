# PlayStation 5

    npm run build:playstation

Produces `dist-platform/playstation/` with the production build, the asset
server, the relay and `platform.json`, with `VITE_PLATFORM=playstation` pinned:
prompts are ✕ ○ □ △, L1/R1/L2/R2 and OPTIONS.

Packaging on your dev-kit machine:

1. Wrap the build in the web/application container your PS5 SDK provides and
   load the game URL from it (the same flow as the PC shell in
   `desktop/main.mjs`).
2. The DualSense arrives through the standard Gamepad API mapping; ✕ is
   confirm and ○ is back (the regional default your title is configured for).
3. Use the SDK's submission tools for packaging and TRC checks.

Behaviour already in the game:

- ✕ confirms, ○ goes back, OPTIONS pauses / skips cutscenes
- L1/R1 switch tabs in stores and menus
- Full menu navigation with the D-pad or left stick
- Rumble on dunks and big plays
