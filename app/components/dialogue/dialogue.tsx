import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { actorFor } from "~/data/cast";
import type { CutsceneSet, CutsceneStage } from "~/game/cutscene";
import type { AssetId } from "~/data/higgsfield-assets";
import { SPEAKERS, type Effect, type Line, type SpeakerId } from "~/data/story";
import { getAudio } from "~/game/audio";
import { AssetImage } from "../asset-image/asset-image";
import styles from "./dialogue.module.css";

interface Props {
  lines: Line[];
  background?: AssetId;
  backgroundTint?: string;
  title?: string;
  onDone(): void;
  /** Called when the player picks a dialogue choice */
  onChoice?(effect: Effect | undefined, text: string): void;
  /** Who speaks the chosen line (default Kairo) */
  chooser?: SpeakerId;
  /** Rename speakers, e.g. "me" → your player's name */
  names?: Partial<Record<SpeakerId, string>>;
  /** Start at this line (dev screenshots) */
  startAt?: number;
  /** Stage the scene in 3D on this set */
  stage?: { set: CutsceneSet; venueId?: string; lead?: string[]; alias?: Record<string, string> };
  /** Show each line fully at once (screenshots) */
  instant?: boolean;
}

const LEFT = new Set(["kairo", "nia"]);

/** Visual-novel style dialogue with Higgsfield portraits */
export function Dialogue({
  lines: initial,
  background,
  backgroundTint = "#3ad7ff",
  title,
  onDone,
  onChoice,
  chooser = "kairo",
  names,
  startAt = 0,
  stage,
  instant,
}: Props) {
  const [lines, setLines] = useState(initial);
  const [i, setI] = useState(startAt);
  const [chars, setChars] = useState(instant ? Infinity : 0);
  const line = lines[Math.min(i, lines.length - 1)];
  const sp = { ...SPEAKERS[line.who], name: names?.[line.who] ?? SPEAKERS[line.who].name };
  const done = chars >= line.text.length;

  const act = (who: SpeakerId) => {
    const a = actorFor(who);
    return a ? (stage?.alias?.[a] ?? a) : a;
  };

  // 3D staging: everyone who speaks in this scene is on set
  const actors = useMemo(() => {
    const ids: string[] = [...(stage?.lead ?? [])];
    for (const l of initial) {
      const a = act(l.who);
      if (a && !ids.includes(a)) ids.push(a);
    }
    for (const l of initial)
      for (const c of l.choices ?? [])
        for (const r of c.reply ?? []) {
          const a = act(r.who);
          if (a && !ids.includes(a)) ids.push(a);
        }
    const me = act(chooser);
    if (initial.some((l) => l.choices) && me && !ids.includes(me)) ids.push(me);
    return ids.slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, chooser, stage?.lead?.join()]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<CutsceneStage | null>(null);
  useEffect(() => {
    if (!stage) return;
    let cancelled = false;
    import("~/game/cutscene").then(({ CutsceneStage }) => {
      if (cancelled || !canvasRef.current) return;
      stageRef.current = new CutsceneStage(canvasRef.current, { set: stage.set, venueId: stage.venueId, actors });
      stageRef.current.setSpeaker(act(line.who));
      if (import.meta.env.DEV) (window as unknown as { __stage: CutsceneStage }).__stage = stageRef.current;
    });
    return () => {
      cancelled = true;
      stageRef.current?.dispose();
      stageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.set, stage?.venueId, actors.join()]);
  useEffect(() => {
    stageRef.current?.setSpeaker(act(line.who));
  }, [line.who, i]);

  // Most recent left/right speakers stay on screen
  const leftWho = [...lines.slice(0, i + 1)].reverse().find((l) => LEFT.has(l.who))?.who;
  const rightWho = [...lines.slice(0, i + 1)].reverse().find((l) => !LEFT.has(l.who) && SPEAKERS[l.who].portrait)?.who;

  useEffect(() => {
    setChars(instant ? Infinity : 0);
  }, [i, instant]);

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setChars((c) => Math.min(line.text.length, c + 2)), 16);
    return () => clearTimeout(t);
  }, [chars, done, line.text.length]);

  const choosing = done && !!line.choices?.length;
  const choose = (i: number) => {
    const c = line.choices![i];
    getAudio().play("confirm");
    onChoice?.(c.effect, c.text);
    const reply: Line[] = [{ who: chooser, text: c.text }, ...(c.reply ?? [])];
    setLines((ls) => [
      ...ls.slice(0, i0 + 1).map((l, k) => (k === i0 ? { ...l, choices: undefined } : l)),
      ...reply,
      ...ls.slice(i0 + 1),
    ]);
    setI(i0 + 1);
  };
  const i0 = i;

  const advance = useCallback(() => {
    if (!done) {
      setChars(line.text.length);
      return;
    }
    if (line.choices?.length) return;
    getAudio().play("click");
    if (i + 1 >= lines.length) onDone();
    else setI(i + 1);
  }, [done, i, line.text.length, line.choices, lines.length, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (choosing && /^Digit[1-4]$/.test(e.code)) {
        const n = Number(e.code.slice(5)) - 1;
        if (line.choices && n < line.choices.length) choose(n);
        return;
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advance, onDone, choosing]);

  return (
    <div
      className={styles.root}
      data-pad="game"
      onClick={advance}
      style={{ "--tint": backgroundTint } as React.CSSProperties}
    >
      {stage && <canvas ref={canvasRef} className={styles.stage} />}
      <div className={styles.bg} hidden={!!stage}>
        {background && <AssetImage asset={background} alt="" accent={backgroundTint} fallbackLabel=" " />}
      </div>
      {title && <h2 className={styles.title}>{title}</h2>}
      {!stage && leftWho && SPEAKERS[leftWho].portrait && (
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
      {!stage && rightWho && (
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
        <p className={styles.text} data-typed={done}>
          {line.text.slice(0, chars)}
        </p>
        <span className={styles.next}>{done && !choosing ? (i + 1 >= lines.length ? "▶" : "▶") : ""}</span>
      </div>
      {choosing && (
        <div className={styles.choices} data-pad="ui" onClick={(e) => e.stopPropagation()}>
          {line.choices!.map((c, k) => (
            <button
              key={k}
              autoFocus={k === 0}
              onClick={() => choose(k)}
              style={{ "--accent": sp.accent } as React.CSSProperties}
            >
              <kbd>{k + 1}</kbd> {c.text}
            </button>
          ))}
        </div>
      )}
      <button
        className={styles.skip}
        data-pad-menu
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
