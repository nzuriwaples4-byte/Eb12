# Xbox Series X|S

    npm run build:xbox

Produces `dist-platform/xbox/` with the production build, the asset server
(`desktop/serve.mjs`), the online relay and `platform.json`. The build has
`VITE_PLATFORM=xbox` pinned, so prompts are always A/B/X/Y and menus are fully
controller-driven.

Packaging on your dev-kit machine:

1. Host the game in your Xbox title's web container (a WebView-based shell in
   your GDK/UWP project). Point it at the bundled server's URL (or at your
   deployed EBL 2 server), the same way `desktop/main.mjs` does on PC.
2. Map the controller through the standard Gamepad API (the container exposes
   it); no remapping is needed, as the game uses the standard layout.
3. Run your title through the certification tools in the GDK.

Cert-relevant behaviour already in the game:

- A confirms, B backs out, ≡ (Menu) pauses / skips cutscenes
- Every screen is reachable without a mouse or keyboard
- Text entry offers suggestions (use the system keyboard for custom text)
