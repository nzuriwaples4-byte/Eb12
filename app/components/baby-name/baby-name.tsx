import "@fontsource/caveat/600.css";
import { useState } from "react";
import { BOY_NAMES, GIRL_NAMES } from "~/data/homes";
import styles from "./baby-name.module.css";

interface Props {
  girl: boolean;
  /** Surname for the birth announcement */
  last: string;
  taken: string[];
  onDone(name: string): void;
}

/** Name your newborn: a birth announcement card with suggestions */
export function BabyName({ girl, last, taken, onDone }: Props) {
  const pool = (girl ? GIRL_NAMES : BOY_NAMES).filter((n) => !taken.includes(n));
  const [name, setName] = useState(pool[0] ?? (girl ? "Nyla" : "Jaylen"));
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 14);
  return (
    <div className={styles.root} data-girl={girl}>
      <article className={styles.card}>
        <p className={styles.kicker}>It's a {girl ? "girl" : "boy"}!</p>
        <h1>Welcome to the world</h1>
        <div className={styles.name}>
          {clean || "…"} {last}
        </div>
        <p className={styles.meta}>7 lb 4 oz · born in the offseason · already has a VYRO and a VANTA box waiting</p>
        <label className={styles.field}>
          <span>Name</span>
          <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className={styles.ideas}>
          {pool.map((n) => (
            <button key={n} data-on={n === clean} onClick={() => setName(n)}>
              {n}
            </button>
          ))}
        </div>
        <button className={styles.go} disabled={!clean} onClick={() => onDone(clean)}>
          Welcome home, {clean || "baby"} ▸
        </button>
      </article>
    </div>
  );
}
