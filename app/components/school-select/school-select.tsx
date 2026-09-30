import { useState } from "react";
import type { College } from "~/data/career";
import { getAudio } from "~/game/audio";
import styles from "./school-select.module.css";

interface Props {
  colleges: College[];
  hsWins: number;
  /** School the rival is leaning toward (shown as a tag) */
  rivalId?: string;
  onSign(college: College): void;
}

/** Signing Day board: two columns of school banners, pick where you'll play */
export function SchoolSelect({ colleges, hsWins, rivalId, onSign }: Props) {
  const firstOpen = colleges.find((c) => hsWins >= c.needWins) ?? colleges[0];
  const [focus, setFocus] = useState(firstOpen.id);
  const sel = colleges.find((c) => c.id === focus)!;
  const offered = hsWins >= sel.needWins;
  const half = Math.ceil(colleges.length / 2);
  const cols = [colleges.slice(0, half), colleges.slice(half)];

  return (
    <div className={styles.root}>
      <div className={styles.floor} aria-hidden />
      <h1 className={styles.header}>Choose which school you would like to attend</h1>
      <div className={styles.board}>
        {cols.map((list, k) => (
          <div key={k} className={styles.column}>
            {list.map((col) => {
              const open = hsWins >= col.needWins;
              return (
                <button
                  key={col.id}
                  className={styles.tile}
                  data-focus={col.id === focus}
                  data-locked={!open}
                  style={{ "--p": col.primary, "--s": col.secondary } as React.CSSProperties}
                  onMouseEnter={() => setFocus(col.id)}
                  onFocus={() => setFocus(col.id)}
                  onClick={() => {
                    setFocus(col.id);
                    getAudio().play("confirm");
                  }}
                >
                  <span className={styles.city}>
                    {col.city} · {col.state}
                  </span>
                  <span className={styles.mascot}>{col.mascot}</span>
                  <span className={styles.logo}>{col.short}</span>
                  {!open && <span className={styles.stamp}>No offer</span>}
                  {col.id === rivalId && <span className={styles.rival}>Zay Carter's pick</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className={styles.detail} style={{ "--p": sel.primary } as React.CSSProperties}>
        <div>
          <strong>{sel.name}</strong>
          <p>
            {offered
              ? `“${sel.pitch}”`
              : `No scholarship offer. They wanted ${sel.needWins} big wins in high school; you had ${hsWins}.`}
          </p>
        </div>
        <button className={styles.sign} disabled={!offered} onClick={() => onSign(sel)}>
          Sign with {sel.short}
        </button>
      </div>
    </div>
  );
}
