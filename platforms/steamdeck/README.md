# Steam Deck

    npm run build:steamdeck

Produces `dist-platform/steamdeck/linux-unpacked/`. Upload it as the Linux depot
(SteamOS) and set the Linux launch option to the `ebl2` binary in that folder.

How the Deck version behaves:

- Steam sets `SteamDeck=1` in the environment on a Deck. The desktop shell
  (`desktop/main.mjs`) sees it, starts fullscreen and passes `?platform=steamdeck`
  to the game, so prompts use Deck glyphs even on a shared Linux depot.
- Layout targets 1280×800 (16:10): base text is bumped to 17px and buttons are at
  least 40px tall so everything stays readable on the 7" screen.
- Steam Input: ship the default **Gamepad** template. The game reads the standard
  gamepad mapping (A/B/X/Y, bumpers, triggers, sticks); the trackpads act as mouse
  for menus.

Deck Verified checklist (what the build already covers):

- [x] Default controller configuration covers all functions
- [x] Controller glyphs match the Deck's buttons
- [x] Native 1280×800 support, legible text
- [x] No launcher; boots straight into the game
- [ ] Text entry (player name, baby name): suggestions are provided; also enable
      Steam's on-screen keyboard (Steam + X) in your store config notes
