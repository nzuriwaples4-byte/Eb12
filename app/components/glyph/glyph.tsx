import { GLYPHS, type Action, type Platform } from "~/platform/platform";
import { usePlatformCtx } from "~/platform/use-platform";
import styles from "./glyph.module.css";

/** A button prompt in the active platform's style: E, Ⓐ, ✕, R2… */
export function Glyph({ action, platform }: { action: Action; platform?: Platform }) {
  const ctx = usePlatformCtx();
  const p = platform ?? ctx;
  const g = GLYPHS[p][action];
  return (
    <span
      className={styles.glyph}
      data-shape={g.shape}
      data-platform={p}
      style={g.color ? ({ "--c": g.color } as React.CSSProperties) : undefined}
      aria-label={g.label}
    >
      {g.label}
    </span>
  );
}

/** "Ⓐ Interact · Ⓑ Back" style hint row */
export function Hints({ items, platform }: { items: [Action, string][]; platform?: Platform }) {
  return (
    <span className={styles.hints}>
      {items.map(([a, text]) => (
        <span key={a + text}>
          <Glyph action={a} platform={platform} /> {text}
        </span>
      ))}
    </span>
  );
}
