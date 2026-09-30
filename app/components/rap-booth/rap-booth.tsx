import { useEffect, useRef, useState } from "react";
import type { Song } from "~/data/rap";
import styles from "./rap-booth.module.css";

interface Props {
  song: Song;
  artist: string;
  onDone(grade: number): void;
  /** Dev/screenshots: freeze mid-take with this many bars already spit */
  demo?: number;
}

type Hit = "perfect" | "good" | "miss" | null;

const COUNT_IN = 4;
const PERFECT = 0.09;
const GOOD = 0.18;
/** Seconds of lookahead shown on the track */
const WINDOW = 2.4;

/**
 * Recording booth: a synthesized beat plays and each bar lands on a beat.
 * Hit Space / tap on the beat to spit the line. Accuracy is the grade.
 */
export function RapBooth({ song, artist, onDone, demo }: Props) {
  const spb = 60 / song.bpm;
  const beats = song.bars.map((_, i) => (COUNT_IN + i) * spb);
  const [hits, setHits] = useState<Hit[]>(() =>
    song.bars.map((_, i) => (demo !== undefined && i < demo ? (i % 5 === 3 ? "good" : "perfect") : null)),
  );
  const [now, setNow] = useState(demo !== undefined ? beats[demo] - 0.45 : -1);
  const [flash, setFlash] = useState<Hit>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const t0 = useRef(0);
  const hitsRef = useRef(hits);
  hitsRef.current = hits;
  const started = now >= 0;
  const end = beats[beats.length - 1] + spb * 2;
  const finished = started && now > end;

  const start = () => {
    if (ctxRef.current) return;
    const ac = new AudioContext();
    ctxRef.current = ac;
    t0.current = ac.currentTime + 0.15;
    scheduleBeat(ac, t0.current, spb, COUNT_IN + song.bars.length + 2);
  };

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const ac = ctxRef.current;
      if (ac) {
        const t = ac.currentTime - t0.current;
        setNow(t);
        // Anything that sailed past the window is a miss
        const h = hitsRef.current;
        if (beats.some((b, i) => h[i] === null && t > b + GOOD)) {
          setHits((prev) => prev.map((x, i) => (x === null && t > beats[i] + GOOD ? "miss" : x)));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => void ctxRef.current?.close(), []);

  const press = () => {
    if (!ctxRef.current) return start();
    const t = ctxRef.current.currentTime - t0.current;
    const h = hitsRef.current;
    let best = -1;
    for (let i = 0; i < beats.length; i++) {
      if (h[i] !== null) continue;
      if (Math.abs(t - beats[i]) <= GOOD && (best < 0 || Math.abs(t - beats[i]) < Math.abs(t - beats[best]))) best = i;
    }
    if (best < 0) return;
    const grade: Hit = Math.abs(t - beats[best]) <= PERFECT ? "perfect" : "good";
    setHits((prev) => prev.map((x, i) => (i === best ? grade : x)));
    setFlash(grade);
    vocal(ctxRef.current, grade === "perfect");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter" || e.code === "KeyJ") {
        e.preventDefault();
        if (!finished) press();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 180);
    return () => clearTimeout(t);
  }, [flash, hits]);

  const perfect = hits.filter((h) => h === "perfect").length;
  const good = hits.filter((h) => h === "good").length;
  const grade = (perfect + good * 0.6) / song.bars.length;
  const letter = grade >= 0.95 ? "S" : grade >= 0.8 ? "A" : grade >= 0.6 ? "B" : grade >= 0.4 ? "C" : "D";
  const count = started && now < COUNT_IN * spb ? COUNT_IN - Math.floor(now / spb) : 0;

  return (
    <div className={styles.root} onPointerDown={() => !finished && press()}>
      <div className={styles.glow} data-flash={flash ?? undefined} />
      <header className={styles.head}>
        <span className={styles.rec}>● REC</span>
        <div>
          <p className={styles.kicker}>{artist}</p>
          <h1>{song.title}</h1>
        </div>
        <span className={styles.bpm}>{song.bpm} BPM</span>
      </header>

      <div className={styles.track}>
        <div className={styles.target} />
        {beats.map((b, i) => {
          const dx = (b - now) / WINDOW;
          if (!started || dx < -0.15 || dx > 1) return null;
          return (
            <span
              key={i}
              className={styles.note}
              data-hit={hits[i] ?? undefined}
              style={{ left: `calc(12% + ${dx * 84}%)` }}
            />
          );
        })}
      </div>

      <p className={styles.lyrics}>
        {song.bars.map((w, i) => (
          <span
            key={i}
            data-hit={hits[i] ?? undefined}
            data-next={started && hits[i] === null && hits.slice(0, i).every((h) => h !== null)}
          >
            {w}{" "}
          </span>
        ))}
      </p>

      {!started && (
        <p className={styles.prompt}>Press Space or tap on every beat to spit each line. Press to start the beat.</p>
      )}
      {count > 0 && <p className={styles.count}>{count}</p>}

      {finished && (
        <div className={styles.result} onPointerDown={(e) => e.stopPropagation()}>
          <strong>{letter}</strong>
          <p>
            {perfect} perfect · {good} good · {song.bars.length - perfect - good} missed · {Math.round(grade * 100)}%
          </p>
          <button autoFocus onClick={() => onDone(grade)}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- synth */

function scheduleBeat(ac: AudioContext, t0: number, spb: number, n: number) {
  const out = ac.createGain();
  out.gain.value = 0.5;
  out.connect(ac.destination);
  const noise = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const bassline = [43, 43, 46, 41];
  for (let i = 0; i < n; i++) {
    const t = t0 + i * spb;
    // Kick
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(i < 4 ? 0.5 : 1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.32);
    // Snare on 2 and 4, hats on the offbeat
    for (const [off, len, vol, hp] of [[0.5, 0.04, 0.25, 7000], ...(i % 2 === 1 ? [[0, 0.18, 0.6, 1500]] : [])] as [
      number,
      number,
      number,
      number,
    ][]) {
      const s = ac.createBufferSource();
      s.buffer = noise;
      const f = ac.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = hp;
      const sg = ac.createGain();
      const st = t + off * spb;
      sg.gain.setValueAtTime(vol, st);
      sg.gain.exponentialRampToValueAtTime(0.001, st + len);
      s.connect(f).connect(sg).connect(out);
      s.start(st);
      s.stop(st + len + 0.02);
    }
    // Sub bass
    if (i >= 4) {
      const b = ac.createOscillator();
      const bg = ac.createGain();
      b.type = "triangle";
      b.frequency.value = 440 * Math.pow(2, (bassline[Math.floor(i / 4) % 4] - 69) / 12);
      bg.gain.setValueAtTime(0.35, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + spb * 0.9);
      b.connect(bg).connect(out);
      b.start(t);
      b.stop(t + spb);
    }
  }
}

/** A short "vocal" blip so hits feel like syllables */
function vocal(ac: AudioContext, perfect: boolean) {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const f = ac.createBiquadFilter();
  const g = ac.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(perfect ? 220 : 180, t);
  o.frequency.exponentialRampToValueAtTime(perfect ? 160 : 120, t + 0.12);
  f.type = "bandpass";
  f.frequency.value = 900;
  f.Q.value = 4;
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(f).connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + 0.16);
}
