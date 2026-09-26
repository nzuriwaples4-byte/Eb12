import { useEffect, useRef, useState } from "react";
import { getBaller } from "~/data/characters";
import { getVenue } from "~/data/venues";
import type { Game } from "~/game/game";
import { getAudio } from "~/game/audio";
import type { Callout, HudState, MatchConfig, MatchResult } from "~/game/types";
import { readSettings } from "~/hooks/use-settings";
import { AssetImage } from "../asset-image/asset-image";
import styles from "./game-view.module.css";

interface Props {
  config: MatchConfig;
  /** Shown under the scoreboard (story objective) */
  objective?: string;
  onFinish(result: MatchResult): void;
  onQuit(): void;
  /** Rendered over the game after it ends */
  overlay?: React.ReactNode;
  /** Bumping this restarts the match */
  runId?: number;
}

const EMPTY_HUD: HudState = {
  phase: "loading",
  score: [0, 0],
  target: 11,
  shotClock: 14,
  hype: [0, 0],
  turbo: [1, 1],
  possession: 0,
  needClear: false,
  countdown: 0,
  loadingText: "Loading…",
  modelKinds: ["procedural", "procedural"],
};

export function GameView({ config, objective, onFinish, onQuit, overlay, runId = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState>({ ...EMPTY_HUD, target: config.target });
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [paused, setPaused] = useState(false);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const pausedRef = useRef(false);

  const p = getBaller(config.playerId);
  const o = getBaller(config.opponentId);
  const venue = getVenue(config.venueId);

  const togglePause = (v?: boolean) => {
    const next = v ?? !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    gameRef.current?.setPaused(next);
  };

  useEffect(() => {
    let cancelled = false;
    const audio = getAudio();
    audio.ensure();
    const s = readSettings();
    audio.applySettings({ master: s.master, music: s.music, sfx: s.sfx });
    setHud({ ...EMPTY_HUD, target: config.target });
    setCallouts([]);
    import("~/game/game").then(({ Game }) => {
      if (cancelled || !canvasRef.current) return;
      gameRef.current = new Game(
        canvasRef.current,
        config,
        {
          hud: setHud,
          callout: (c) => {
            setCallouts((list) => [...list.slice(-2), c]);
            setTimeout(() => setCallouts((list) => list.filter((x) => x.id !== c.id)), c.size === "lg" ? 2200 : 1500);
          },
          over: (r) => finishRef.current(r),
          pause: () => togglePause(),
        },
        { meter: meterRef.current },
      );
    });
    return () => {
      cancelled = true;
      gameRef.current?.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const hypeFull = hud.hype[0] >= 100;

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} />

      {hud.phase === "loading" && (
        <div className={styles.loading}>
          <div className={styles.vs}>
            <div className={styles.vsSide} style={{ "--accent": p.accent } as React.CSSProperties}>
              <AssetImage asset={p.portrait} alt={p.name} fallbackLabel={p.nickname} accent={p.accent} />
              <strong>{p.nickname}</strong>
            </div>
            <span className={styles.vsText}>VS</span>
            <div className={styles.vsSide} style={{ "--accent": o.accent } as React.CSSProperties}>
              <AssetImage asset={o.portrait} alt={o.name} fallbackLabel={o.nickname} accent={o.accent} />
              <strong>{o.nickname}</strong>
            </div>
          </div>
          <p className={styles.venue}>
            {venue.name} · {venue.district}
          </p>
          <p className={styles.loadingText}>{hud.loadingText}</p>
        </div>
      )}

      {hud.phase !== "loading" && (
        <>
          <header className={styles.scoreboard}>
            <div className={styles.team} style={{ "--accent": p.accent } as React.CSSProperties}>
              <div className={styles.face}>
                <AssetImage
                  asset={p.portrait}
                  alt={p.name}
                  fallbackLabel={p.nickname[0]}
                  accent={p.accent}
                  position="50% 20%"
                />
              </div>
              <span className={styles.name}>{p.nickname}</span>
              <span className={styles.score}>{hud.score[0]}</span>
              {hud.possession === 0 && hud.phase === "live" && <span className={styles.poss} />}
            </div>
            <div className={styles.center}>
              <span className={styles.to}>FIRST TO {hud.target}</span>
              <span className={styles.clock} data-low={hud.shotClock < 5}>
                {Math.max(0, Math.ceil(hud.shotClock))}
              </span>
            </div>
            <div className={styles.team} data-right style={{ "--accent": o.accent } as React.CSSProperties}>
              {hud.possession === 1 && hud.phase === "live" && <span className={styles.poss} />}
              <span className={styles.score}>{hud.score[1]}</span>
              <span className={styles.name}>{o.nickname}</span>
              <div className={styles.face}>
                <AssetImage
                  asset={o.portrait}
                  alt={o.name}
                  fallbackLabel={o.nickname[0]}
                  accent={o.accent}
                  position="50% 20%"
                />
              </div>
            </div>
          </header>
          {objective && <p className={styles.objective}>★ {objective}</p>}
          {hud.needClear && hud.possession === 0 && hud.phase === "live" && (
            <p className={styles.clear}>TAKE IT BACK ↑ clear the arc</p>
          )}

          <footer className={styles.meters}>
            <Meter
              label={hypeFull ? `${p.special.name} — SPACE / RB` : "HYPE"}
              value={hud.hype[0] / 100}
              color={p.special.color}
              full={hypeFull}
            />
            <Meter label="TURBO" value={hud.turbo[0]} color="#ffd24a" small />
            <div className={styles.spacer} />
            <Meter label="TURBO" value={hud.turbo[1]} color="#ffd24a" small right />
            <Meter
              label={hud.hype[1] >= 100 ? `${o.special.name} READY` : "HYPE"}
              value={hud.hype[1] / 100}
              color={o.special.color}
              full={hud.hype[1] >= 100}
              right
            />
          </footer>

          {hud.modelKinds[0] === "higgsfield" && <span className={styles.badge}>3D model: Higgsfield AI</span>}
        </>
      )}

      <div ref={meterRef} className={styles.shotMeter} aria-hidden>
        <div className={styles.meterTrack}>
          <div className={styles.meterZone} />
          <div className={styles.meterFill} />
        </div>
      </div>

      <div className={styles.callouts} aria-live="polite">
        {callouts.map((c) => (
          <div
            key={c.id}
            className={styles.callout}
            data-size={c.size}
            style={{ "--accent": c.color } as React.CSSProperties}
          >
            <span>{c.text}</span>
            {c.sub && <small>{c.sub}</small>}
          </div>
        ))}
      </div>

      {hud.phase !== "loading" && !overlay && (
        <button className={styles.pauseBtn} onClick={() => togglePause(true)} aria-label="Pause">
          ❚❚
        </button>
      )}

      {paused && !overlay && (
        <div className={styles.pause}>
          <h2>Paused</h2>
          <button onClick={() => togglePause(false)} autoFocus>
            Resume
          </button>
          <button onClick={onQuit}>Quit match</button>
          <Controls />
        </div>
      )}

      {overlay && <div className={styles.overlay}>{overlay}</div>}
    </div>
  );
}

function Meter({
  label,
  value,
  color,
  full,
  small,
  right,
}: {
  label: string;
  value: number;
  color: string;
  full?: boolean;
  small?: boolean;
  right?: boolean;
}) {
  return (
    <div
      className={styles.meter}
      data-small={small}
      data-right={right}
      data-full={full}
      style={{ "--accent": color } as React.CSSProperties}
    >
      <span className={styles.meterLabel}>{label}</span>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})` }} />
      </div>
    </div>
  );
}

export function Controls() {
  return (
    <dl className={styles.controls}>
      <dt>Move</dt>
      <dd>WASD / Arrows · Left stick</dd>
      <dt>Shoot (hold, release at the green)</dt>
      <dd>J · A</dd>
      <dt>Dunk</dt>
      <dd>Hold Shift + J near the rim · RT + A</dd>
      <dt>Crossover / Steal</dt>
      <dd>K · X</dd>
      <dt>Trick dribble</dt>
      <dd>L · Y</dd>
      <dt>Off the glass (then J to catch)</dt>
      <dd>U · B</dd>
      <dt>Block / Rebound</dt>
      <dd>J on defense · A</dd>
      <dt>Special move (hype full)</dt>
      <dd>Space · RB</dd>
      <dt>Pause</dt>
      <dd>Esc / P · Start</dd>
    </dl>
  );
}
