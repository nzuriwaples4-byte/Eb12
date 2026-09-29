import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AssetImage } from "~/components/asset-image/asset-image";
import { GameView } from "~/components/game-view/game-view";
import { MenuButton } from "~/components/menu-button/menu-button";
import { Results } from "~/components/results/results";
import { BALLERS, getBaller, overall } from "~/data/characters";
import { CHAPTERS } from "~/data/story";
import { VENUES } from "~/data/venues";
import type { MatchResult } from "~/game/types";
import { PAYOUT } from "~/data/gear";
import { kairoLook, unlockedBallers, useProgress } from "~/hooks/use-progress";
import { useSettings } from "~/hooks/use-settings";
import type { Route } from "./+types/play";
import styles from "./play.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Quick Match — Concrete Crown" }];
}

const TARGETS = [11, 15, 21];
const DIFFS = ["Rookie", "Pro", "Legend"];

export default function Play() {
  const [progress, setProgress] = useProgress();
  const [settings] = useSettings();
  const navigate = useNavigate();
  const unlocked = settings.unlockAll ? new Set(BALLERS.map((b) => b.id)) : unlockedBallers(progress, CHAPTERS);
  const [params] = useSearchParams();
  const [me, setMe] = useState("kairo");
  const [opp, setOpp] = useState(params.get("opp") ?? "deuce");
  const [venue, setVenue] = useState(params.get("venue") ?? VENUES[0].id);
  const [target, setTarget] = useState(11);
  const [diff, setDiff] = useState(params.get("diff") ? Number(params.get("diff")) : settings.difficulty);
  const [playing, setPlaying] = useState(params.get("auto") === "1");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [runId, setRunId] = useState(0);

  if (playing) {
    return (
      <GameView
        runId={runId}
        config={{
          playerId: me,
          opponentId: opp,
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
              opponentId={opp}
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
      <section className={styles.cols}>
        <div>
          <h2 style={{ color: mine.accent }}>You · {mine.nickname}</h2>
          {pick(BALLERS, me, setMe, true)}
        </div>
        <div>
          <h2 style={{ color: theirs.accent }}>CPU · {theirs.nickname}</h2>
          {pick(BALLERS, opp, setOpp, false)}
        </div>
      </section>
      <section className={styles.options}>
        <div>
          <h3>Court</h3>
          <div className={styles.chips}>
            {VENUES.map((v) => (
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
