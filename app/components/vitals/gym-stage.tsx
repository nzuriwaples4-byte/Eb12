import { useEffect, useRef } from "react";
import type { CutsceneStage } from "~/game/cutscene";

/** Your player standing alone in the Harbor Heights practice gym */
export function GymStage({ actorKey }: { actorKey: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stage: CutsceneStage | null = null;
    let cancelled = false;
    import("~/game/cutscene").then(({ CutsceneStage }) => {
      if (cancelled || !ref.current) return;
      stage = new CutsceneStage(ref.current, { set: "court", venueId: "hs-gym", actors: ["me"] });
      stage.setSpeaker(null);
    });
    return () => {
      cancelled = true;
      stage?.dispose();
    };
  }, [actorKey]);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}
