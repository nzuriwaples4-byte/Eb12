import { useCallback, useEffect, useState } from "react";
import type { AssetId } from "~/data/higgsfield-assets";
import { SPEAKERS, type Line } from "~/data/story";
import { getAudio } from "~/game/audio";
import { AssetImage } from "../asset-image/asset-image";
import styles from "./dialogue.module.css";

interface Props {
  lines: Line[];
  background?: AssetId;
  backgroundTint?: string;
  title?: string;
  onDone(): void;
}

const LEFT = new Set(["kairo", "nia"]);

/** Visual-novel style dialogue with Higgsfield portraits */
export function Dialogue({ lines, background, backgroundTint = "#3ad7ff", title, onDone }: Props) {
  const [i, setI] = useState(0);
  const [chars, setChars] = useState(0);
  const line = lines[Math.min(i, lines.length - 1)];
  const sp = SPEAKERS[line.who];
  const done = chars >= line.text.length;

  // Most recent left/right speakers stay on screen
  const leftWho = [...lines.slice(0, i + 1)].reverse().find((l) => LEFT.has(l.who))?.who;
  const rightWho = [...lines.slice(0, i + 1)].reverse().find((l) => !LEFT.has(l.who) && SPEAKERS[l.who].portrait)?.who;

  useEffect(() => {
    setChars(0);
  }, [i]);

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setChars((c) => Math.min(line.text.length, c + 2)), 16);
    return () => clearTimeout(t);
  }, [chars, done, line.text.length]);

  const advance = useCallback(() => {
    if (!done) {
      setChars(line.text.length);
      return;
    }
    getAudio().play("click");
    if (i + 1 >= lines.length) onDone();
    else setI(i + 1);
  }, [done, i, line.text.length, lines.length, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["Space", "Enter", "KeyJ", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
        advance();
      }
      if (e.code === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    // Gamepad A to advance
    let raf = 0;
    let prev = false;
    const poll = () => {
      const pad = navigator.getGamepads?.().find(Boolean);
      const a = !!pad?.buttons[0]?.pressed;
      if (a && !prev) advance();
      prev = a;
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
    };
  }, [advance, onDone]);

  return (
    <div className={styles.root} onClick={advance} style={{ "--tint": backgroundTint } as React.CSSProperties}>
      <div className={styles.bg}>
        {background && <AssetImage asset={background} alt="" accent={backgroundTint} fallbackLabel=" " />}
      </div>
      {title && <h2 className={styles.title}>{title}</h2>}
      {leftWho && SPEAKERS[leftWho].portrait && (
        <div className={styles.portrait} data-side="left" data-active={line.who === leftWho}>
          <AssetImage
            asset={SPEAKERS[leftWho].portrait}
            alt={SPEAKERS[leftWho].name}
            fallbackLabel={SPEAKERS[leftWho].name}
            accent={SPEAKERS[leftWho].accent}
            position="50% 15%"
          />
        </div>
      )}
      {rightWho && (
        <div className={styles.portrait} data-side="right" data-active={line.who === rightWho}>
          <AssetImage
            asset={SPEAKERS[rightWho].portrait}
            alt={SPEAKERS[rightWho].name}
            fallbackLabel={SPEAKERS[rightWho].name}
            accent={SPEAKERS[rightWho].accent}
            position="50% 15%"
          />
        </div>
      )}
      <div className={styles.box} data-narrator={!sp.name} style={{ "--accent": sp.accent } as React.CSSProperties}>
        {sp.name && <span className={styles.speaker}>{sp.name}</span>}
        <p className={styles.text}>{line.text.slice(0, chars)}</p>
        <span className={styles.next}>{done ? (i + 1 >= lines.length ? "▶ PLAY" : "▶") : ""}</span>
      </div>
      <button
        className={styles.skip}
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        Skip ⏭
      </button>
      <span className={styles.progress}>
        {i + 1}/{lines.length}
      </span>
    </div>
  );
}
