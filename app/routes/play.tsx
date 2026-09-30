import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AssetImage } from "~/components/asset-image/asset-image";
import { GameView } from "~/components/game-view/game-view";
import { MenuButton } from "~/components/menu-button/menu-button";
import { Results } from "~/components/results/results";
import { BALLERS, getBaller, overall } from "~/data/characters";
import { CHAPTERS } from "~/data/story";
import { STREET_VENUES } from "~/data/venues";
import type { GameMode, MatchResult } from "~/game/types";
import { PAYOUT } from "~/data/gear";
import { kairoLook, unlockedBallers, useProgress } from "~/hooks/use-progress";
import { useSettings } from "~/hooks/use-settings";
import type { Route } from "./+types/play";
import styles from "./play.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Quick Match — Concrete Crown" }];
}

const TARGETS = [11, 15, 21];
const MODES: { id: GameMode; label: string; blurb: string }[] = [
  { id: "solo", label: "Solo", blurb: "You vs the CPU" },
  { id: "versus", label: "Local Versus", blurb: "Two players, one screen" },
  { id: "tag", label: "Tag Team Co-op", blurb: "You + a friend vs the CPU. Tag in at every check ball." },
];
const DIFFS = ["Rookie", "Pro", "Legend"];

export default function Play() {
  const [progress, setProgress] = useProgress();
  const [settings] = useSettings();
  const navigate = useNavigate();
  const unlocked = settings.unlockAll ? new Set(BALLERS.map((b) => b.id)) : unlockedBallers(progress, CHAPTERS);
  const [params] = useSearchParams();
  const [me, setMe] = useState("kairo");
  const [opp, setOpp] = useState(params.get("opp") ?? "deuce");
  const [venue, setVenue] = useState(params.get("venue") ?? STREET_VENUES[0].id);
  const [target, setTarget] = useState(11);
  const [diff, setDiff] = useState(params.get("diff") ? Number(params.get("diff")) : settings.difficulty);
  const [playing, setPlaying] = useState(params.get("auto") === "1");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [runId, setRunId] = useState(0);
  const [mode, setMode] = useState<GameMode>((params.get("mode") as GameMode) ?? "solo");
  const [p2, setP2] = useState("silk");
  const cpuOpp = mode === "versus" ? p2 : opp;

  if (playing) {
    return (
      <GameView
        runId={runId}
        config={{
          playerId: me,
          opponentId: cpuOpp,
          mode,
          partnerId: mode === "tag" ? p2 : undefined,
          venueId: venue,
          target,
          difficulty: diff,
          useHiggsfield: settings.useHiggsfield,
          shadows: settings.shadows,
          cameraShake: settings.cameraShake,
          playerLook: me === "kairo" ? (kairoLook(progress) ?? undefined) : undefined,
        }}
        onFinish={(r) => {
          setResult(r);
          setProgress((p) => ({
            ...p,
            wins: p.wins + (r.winner === 0 ? 1 : 0),
            losses: p.losses + (r.winner === 1 ? 1 : 0),
          }));
        }}
        onQuit={() => {
          if (params.get("from") === "city") navigate("/city");
          setPlaying(false);
          setResult(null);
        }}
        overlay={
          result && (
            <Results
              result={result}
              playerId={me}
              opponentId={cpuOpp}
              actions={
                <>
                  <MenuButton
                    variant="primary"
                    autoFocus
                    onClick={() => {
                      setResult(null);
                      setRunId((n) => n + 1);
                    }}
                  >
                    Rematch
                  </MenuButton>
                  <MenuButton
                    onClick={() => {
                      setPlaying(false);
                      setResult(null);
                    }}
                  >
                    Change matchup
                  </MenuButton>
                  <MenuButton onClick={() => navigate(params.get("from") === "city" ? "/city" : "/")}>
                    {params.get("from") === "city" ? "Back to the city" : "Main menu"}
                  </MenuButton>
                </>
              }
            />
          )
        }
      />
    );
  }

  const pick = (list: typeof BALLERS, value: string, set: (id: string) => void, lockMine: boolean) => (
    <div className={styles.grid}>
      {list.map((b) => {
        const locked = lockMine && !unlocked.has(b.id);
        return (
          <button
            key={b.id}
            className={styles.baller}
            data-selected={value === b.id}
            disabled={locked}
            style={{ "--accent": b.accent } as React.CSSProperties}
            onClick={() => set(b.id)}
          >
            <div className={styles.face}>
              <AssetImage
                asset={b.portrait}
                alt={b.name}
                fallbackLabel={b.nickname}
                accent={b.accent}
                position="50% 20%"
              />
            </div>
            <span className={styles.nick}>{locked ? "LOCKED" : b.nickname}</span>
            <span className={styles.ovr}>{locked ? "Beat in story" : `OVR ${overall(b)}`}</span>
          </button>
        );
      })}
    </div>
  );

  const mine = getBaller(me);
  const theirs = getBaller(opp);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          ← Menu
        </Link>
        <h1>Quick Match</h1>
        <span className={styles.record}>
          Record {progress.wins}–{progress.losses}
        </span>
      </header>
      <section className={styles.modes}>
        {MODES.map((m) => (
          <button key={m.id} data-selected={mode === m.id} onClick={() => setMode(m.id)}>
            <strong>{m.label}</strong>
            <small>{m.blurb}</small>
          </button>
        ))}
        <Link to="/online" className={styles.onlineLink}>
          <strong>Online ↗</strong>
          <small>Play a friend over the internet</small>
        </Link>
      </section>
      {mode !== "solo" && (
        <p className={styles.controls}>
          <b>P1</b> WASD · J shoot · K juke · L trick · U lob · Space special · L-Shift turbo · gamepad 1 &nbsp;|&nbsp;{" "}
          <b>P2</b> Arrows · . shoot · , juke · / trick · ; lob · Enter special · R-Shift turbo · gamepad 2
        </p>
      )}
      <section className={styles.cols}>
        <div>
          <h2 style={{ color: mine.accent }}>
            {mode === "solo" ? "You" : "Player 1"} · {mine.nickname}
          </h2>
          {pick(BALLERS, me, setMe, true)}
        </div>
        {mode === "solo" ? (
          <div>
            <h2 style={{ color: theirs.accent }}>CPU · {theirs.nickname}</h2>
            {pick(BALLERS, opp, setOpp, false)}
          </div>
        ) : (
          <div>
            <h2 style={{ color: getBaller(p2).accent }}>
              Player 2{mode === "tag" ? " (tag partner)" : ""} · {getBaller(p2).nickname}
            </h2>
            {pick(BALLERS, p2, setP2, true)}
          </div>
        )}
      </section>
      {mode === "tag" && (
        <section className={styles.cols}>
          <div>
            <h2 style={{ color: theirs.accent }}>CPU opponent · {theirs.nickname}</h2>
            {pick(BALLERS, opp, setOpp, false)}
          </div>
        </section>
      )}
      <section className={styles.options}>
        <div>
          <h3>Court</h3>
          <div className={styles.chips}>
            {STREET_VENUES.map((v) => (
              <button
                key={v.id}
                data-selected={venue === v.id}
                onClick={() => setVenue(v.id)}
                style={{ "--accent": v.accent } as React.CSSProperties}
              >
                {v.name}
                <small>{v.timeOfDay}</small>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3>Game to</h3>
          <div className={styles.chips}>
            {TARGETS.map((t) => (
              <button key={t} data-selected={target === t} onClick={() => setTarget(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3>Difficulty</h3>
          <div className={styles.chips}>
            {DIFFS.map((d, i) => (
              <button key={d} data-selected={diff === i} onClick={() => setDiff(i)}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.go}>
          <MenuButton variant="primary" onClick={() => setPlaying(true)}>
            Ball Up ▶
          </MenuButton>
        </div>
      </section>
    </main>
  );
}
