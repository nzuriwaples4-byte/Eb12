import { createContext, useContext, useEffect, useState } from "react";
import { useSettings } from "~/hooks/use-settings";
import { BUILD_PLATFORM, detectPlatform, padPlatform, type Platform } from "./platform";

/**
 * The active platform: a build pin wins, then the Settings choice, then
 * auto-detect (which follows the last controller plugged in).
 */
export function usePlatform(): Platform {
  const [settings] = useSettings();
  const [auto, setAuto] = useState<Platform>("pc");
  useEffect(() => {
    setAuto(detectPlatform());
    const onPad = (e: GamepadEvent) => {
      if (BUILD_PLATFORM) return;
      const p = padPlatform(e.gamepad.id);
      if (p) setAuto((cur) => (cur === "steamdeck" ? cur : p));
    };
    window.addEventListener("gamepadconnected", onPad);
    return () => window.removeEventListener("gamepadconnected", onPad);
  }, []);
  if (BUILD_PLATFORM) return BUILD_PLATFORM;
  return settings.platform && settings.platform !== "auto" ? settings.platform : auto;
}

export const PlatformContext = createContext<Platform>("pc");

/** Read the active platform anywhere below the root */
export function usePlatformCtx() {
  return useContext(PlatformContext);
}
