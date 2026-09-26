import { useEffect, useRef } from "react";
import type { Baller } from "~/data/characters";
import styles from "./showcase-canvas.module.css";

interface Props {
  ballers: Baller[];
  focusId?: string | null;
  className?: string;
}

/** Client-only 3D lineup of ballers (three.js is loaded lazily) */
export function ShowcaseCanvas({ ballers, focusId = null, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const showcaseRef = useRef<import("~/game/showcase").Showcase | null>(null);
  const ids = ballers.map((b) => b.id).join(",");

  useEffect(() => {
    let cancelled = false;
    import("~/game/showcase").then(({ Showcase }) => {
      if (cancelled || !canvasRef.current) return;
      showcaseRef.current = new Showcase(canvasRef.current, ballers, { useHiggsfield: true });
      showcaseRef.current.setFocus(focusId);
    });
    return () => {
      cancelled = true;
      showcaseRef.current?.dispose();
      showcaseRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  useEffect(() => {
    showcaseRef.current?.setFocus(focusId);
  }, [focusId]);

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
