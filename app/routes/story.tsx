import { Link } from "react-router";
import { AssetImage } from "~/components/asset-image/asset-image";
import { getBaller } from "~/data/characters";
import { BOOKS, CHAPTERS, EPILOGUE_TEASER, bookOf } from "~/data/story";
import { getVenue } from "~/data/venues";
import { useProgress } from "~/hooks/use-progress";
import { useSettings } from "~/hooks/use-settings";
import type { Route } from "./+types/story";
import styles from "./story.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Story Mode — Concrete Crown" }];
}

export default function Story() {
  const [progress] = useProgress();
  const [settings] = useSettings();
  const allDone = CHAPTERS.every((c) => progress.beaten.includes(c.id));
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          ← Menu
        </Link>
        <div>
          <p className={styles.book}>Story Mode</p>
          <h1>Kairo's Story</h1>
        </div>
        <p className={styles.stars}>
          ★ {Object.values(progress.stars).filter(Boolean).length}/{CHAPTERS.length}
        </p>
      </header>
      <ol className={styles.list}>
        {CHAPTERS.map((c, i) => {
          const o = getBaller(c.opponentId);
          const v = getVenue(c.venueId);
          const unlocked = settings.unlockAll || i === 0 || progress.beaten.includes(CHAPTERS[i - 1].id);
          const beaten = progress.beaten.includes(c.id);
          const inner = (
            <>
              <div className={styles.portrait}>
                <AssetImage
                  asset={o.portrait}
                  alt={o.name}
                  fallbackLabel={o.nickname}
                  accent={o.accent}
                  position="50% 20%"
                />
              </div>
              <div className={styles.info}>
                <span className={styles.num}>Chapter {c.number}</span>
                <h2>{c.title}</h2>
                <p className={styles.meta}>
                  vs {o.nickname} · {v.name} · First to {c.target}
                </p>
                <p className={styles.logline}>{unlocked ? c.logline : "Locked: win the previous chapter."}</p>
                <p className={styles.obj}>
                  {progress.stars[c.id] ? "★" : "☆"} {c.objective.label}
                </p>
              </div>
              {beaten && <span className={styles.done}>BEATEN</span>}
              {!unlocked && <span className={styles.lock}>🔒</span>}
            </>
          );
          return (
            <li key={c.id} style={{ "--accent": o.accent } as React.CSSProperties} data-locked={!unlocked}>
              {(i === 0 || bookOf(CHAPTERS[i - 1]) !== bookOf(c)) && (
                <h2 className={styles.bookHead}>
                  {BOOKS.find((b) => b.number === bookOf(c))?.name}:{" "}
                  <span>{BOOKS.find((b) => b.number === bookOf(c))?.title}</span>
                </h2>
              )}
              {unlocked ? (
                <Link to={`/story/${c.id}`} className={styles.card}>
                  {inner}
                </Link>
              ) : (
                <div className={styles.card}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
      {allDone && (
        <aside className={styles.teaser}>
          <span>Coming next</span>
          <h2>{EPILOGUE_TEASER.title}</h2>
          <p>{EPILOGUE_TEASER.text}</p>
        </aside>
      )}
    </main>
  );
}
