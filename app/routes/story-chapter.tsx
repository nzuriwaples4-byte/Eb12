import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Dialogue } from "~/components/dialogue/dialogue";
import { GameView } from "~/components/game-view/game-view";
import { MenuButton } from "~/components/menu-button/menu-button";
import { Results } from "~/components/results/results";
import { getBaller } from "~/data/characters";
import type { AssetId } from "~/data/higgsfield-assets";
import { BOOKS, CHAPTERS, EPILOGUE_TEASER, bookOf, getChapter, type Chapter } from "~/data/story";
import { getVenue } from "~/data/venues";
import { OBJECTIVE_STAT, type MatchResult } from "~/game/types";
import { PAYOUT } from "~/data/gear";
import { kairoLook, useProgress } from "~/hooks/use-progress";
import { useSettings } from "~/hooks/use-settings";
import type { Route } from "./+types/story-chapter";
import styles from "./story-chapter.module.css";

export function meta({ params }: Route.MetaArgs) {
  const c = getChapter(params.chapterId);
  return [{ title: c ? `Chapter ${c.number}: ${c.title} — Concrete Crown` : "Story — Concrete Crown" }];
}

type Stage = "intro" | "match" | "win" | "lose" | "end";

function objectiveMet(c: Chapter, r: MatchResult) {
  if (r.winner !== 0) return false;
  if (c.objective.kind === "margin") return r.score[0] - r.score[1] >= c.objective.count;
  return r.stats[0][OBJECTIVE_STAT[c.objective.kind]] >= c.objective.count;
}

const BACKDROPS: Record<string, AssetId> = { ch1: "crib-loft", ch5: "key-art" };

export default function StoryChapter({ params }: Route.ComponentProps) {
  const chapter = getChapter(params.chapterId);
  const navigate = useNavigate();
  const [progress, setProgress] = useProgress();
  const [settings] = useSettings();
  const [stage, setStage] = useState<Stage>("intro");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [runId, setRunId] = useState(0);

  if (!chapter) {
    return (
      <main className={styles.missing}>
        <p>Chapter not found.</p>
        <Link to="/story">Back to story</Link>
      </main>
    );
  }
  const o = getBaller(chapter.opponentId);
  const venue = getVenue(chapter.venueId);
  const idx = CHAPTERS.findIndex((c) => c.id === chapter.id);
  const nextChapter = CHAPTERS[idx + 1];
  const difficulty = Math.max(0, Math.min(2, chapter.difficulty + settings.difficulty - 1));

  const onFinish = (r: MatchResult) => {
    setResult(r);
    if (r.winner === 0) {
      const met = objectiveMet(chapter, r);
      setProgress((p) => ({
        ...p,
        crowns: (p.crowns ?? 0) + PAYOUT.storyWin + (met && !p.stars[chapter.id] ? PAYOUT.storyStar : 0),
        beaten: p.beaten.includes(chapter.id) ? p.beaten : [...p.beaten, chapter.id],
        stars: { ...p.stars, [chapter.id]: p.stars[chapter.id] || met },
        best: { ...p.best, [chapter.id]: r.score },
      }));
    }
  };

  if (stage === "intro") {
    return (
      <Dialogue
        key="intro"
        lines={chapter.intro}
        background={BACKDROPS[chapter.id] ?? o.portrait}
        backgroundTint={venue.accent}
        title={`Chapter ${chapter.number} · ${chapter.title}`}
        onDone={() => setStage("match")}
      />
    );
  }

  if (stage === "win" || stage === "lose") {
    return (
      <Dialogue
        key={stage}
        lines={stage === "win" ? chapter.win : chapter.lose}
        background={stage === "win" && chapter.id === "ch5" ? "crib-penthouse" : o.portrait}
        backgroundTint={venue.accent}
        title={stage === "win" ? "Victory" : "Defeat"}
        onDone={() => {
          if (stage === "lose") {
            setResult(null);
            setRunId((n) => n + 1);
            setStage("match");
          } else if (!nextChapter || bookOf(nextChapter) !== bookOf(chapter)) setStage("end");
          else navigate("/story");
        }}
      />
    );
  }

  if (stage === "end") {
    const book = BOOKS.find((b) => b.number === bookOf(chapter)) ?? BOOKS[0];
    const nextBook = BOOKS.find((b) => b.number === bookOf(chapter) + 1);
    return (
      <main className={styles.end}>
        <p className={styles.kicker}>End of {book.name}</p>
        <h1>{book.title}</h1>
        <p className={styles.unlocked}>
          {book.number === 1
            ? "Unlocked: The Crown Penthouse · Book Two: The Undercity"
            : "Unlocked: EBL League mode · Book Two rivals in Quick Match"}
        </p>
        <div className={styles.teaser}>
          <span>Up next</span>
          <h2>{nextBook ? `${nextBook.name}: ${nextBook.title}` : EPILOGUE_TEASER.title}</h2>
          <p>{nextBook ? "The Architect is waiting under the city." : EPILOGUE_TEASER.text}</p>
        </div>
        <nav className={styles.endNav}>
          {nextChapter ? (
            <MenuButton to={`/story/${nextChapter.id}`} variant="primary">
              Start {nextBook?.name ?? "next chapter"}
            </MenuButton>
          ) : (
            <MenuButton to="/league" variant="primary">
              Go pro: EBL League
            </MenuButton>
          )}
          <MenuButton to="/city">Back to the city</MenuButton>
        </nav>
      </main>
    );
  }

  return (
    <GameView
      runId={runId}
      config={{
        playerId: "kairo",
        opponentId: chapter.opponentId,
        venueId: chapter.venueId,
        target: chapter.target,
        difficulty,
        useHiggsfield: settings.useHiggsfield,
        shadows: settings.shadows,
        cameraShake: settings.cameraShake,
        playerLook: kairoLook(progress) ?? undefined,
      }}
      objective={chapter.objective.label}
      onFinish={onFinish}
      onQuit={() => navigate("/story")}
      overlay={
        result && (
          <Results
            result={result}
            playerId="kairo"
            opponentId={chapter.opponentId}
            objective={{ label: chapter.objective.label, met: objectiveMet(chapter, result) }}
            actions={
              result.winner === 0 ? (
                <>
                  <MenuButton variant="primary" onClick={() => setStage("win")} autoFocus>
                    Continue the story
                  </MenuButton>
                  <MenuButton
                    onClick={() => {
                      setResult(null);
                      setRunId((n) => n + 1);
                    }}
                  >
                    Replay for ★
                  </MenuButton>
                </>
              ) : (
                <>
                  <MenuButton variant="primary" onClick={() => setStage("lose")} autoFocus>
                    Run it back
                  </MenuButton>
                  <MenuButton to="/story">Chapter select</MenuButton>
                </>
              )
            }
          />
        )
      }
    />
  );
}
