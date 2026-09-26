import { Link } from "react-router";
import { Controls } from "~/components/game-view/game-view";
import { getAudio } from "~/game/audio";
import { useProgress } from "~/hooks/use-progress";
import { useSettings, type Settings as S } from "~/hooks/use-settings";
import type { Route } from "./+types/settings";
import styles from "./settings.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Settings — Concrete Crown" }];
}

export default function Settings() {
  const [s, update] = useSettings();
  const [, setProgress] = useProgress();
  const set = <K extends keyof S>(k: K, v: S[K]) => {
    update((prev) => ({ ...prev, [k]: v }));
    const a = getAudio();
    a.ensure();
    const next = { ...s, [k]: v };
    a.applySettings({ master: next.master, music: next.music, sfx: next.sfx });
    a.play("click");
  };
  const slider = (k: "master" | "music" | "sfx", label: string) => (
    <label className={styles.row}>
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={s[k]} onChange={(e) => set(k, Number(e.target.value))} />
      <output>{Math.round(s[k] * 100)}</output>
    </label>
  );
  const toggle = (k: "shadows" | "cameraShake" | "useHiggsfield" | "unlockAll", label: string, hint?: string) => (
    <label className={styles.row}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={s[k]} onChange={(e) => set(k, e.target.checked)} />
    </label>
  );
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          ← Menu
        </Link>
        <h1>Settings</h1>
      </header>
      <div className={styles.cols}>
        <section className={styles.group}>
          <h2>Audio</h2>
          {slider("master", "Master")}
          {slider("music", "Music")}
          {slider("sfx", "Effects")}
          <h2>Gameplay</h2>
          <label className={styles.row}>
            <span>Difficulty</span>
            <select value={s.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))}>
              <option value={0}>Rookie</option>
              <option value={1}>Pro</option>
              <option value={2}>Legend</option>
            </select>
          </label>
          {toggle("cameraShake", "Camera shake")}
          <h2>Graphics</h2>
          {toggle("shadows", "Shadows")}
          {toggle("useHiggsfield", "Higgsfield 3D models", "Use AI-generated rigged models when available")}
          <h2>Progress</h2>
          {toggle("unlockAll", "Unlock everything", "All chapters, ballers and cribs")}
          <button
            className={styles.danger}
            onClick={() => {
              if (confirm("Reset all story progress?"))
                setProgress(() => ({ beaten: [], stars: {}, best: {}, wins: 0, losses: 0, seenIntro: false }));
            }}
          >
            Reset progress
          </button>
        </section>
        <section className={styles.group}>
          <h2>Controls</h2>
          <Controls />
          <h2>How to play</h2>
          <ul className={styles.tips}>
            <li>1-on-1, first to the target score. Twos and threes, and specials are worth 3.</li>
            <li>After a make, the other player gets the ball (loser's ball) with a check at the top of the key.</li>
            <li>After a steal or defensive rebound, take it back behind the arc before you can score.</li>
            <li>Hold shoot to rise and let go in the green zone for a perfect release.</li>
            <li>Cross your defender up (K) when they're close. Get the timing right and their ankles go.</li>
            <li>Flashy plays fill your HYPE meter. When it's full, hit your special move.</li>
            <li>Throw it off the glass (U), then press J by the rim to catch it and throw it down.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
