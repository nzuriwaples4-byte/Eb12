import { useState } from "react";
import type { Attrs } from "~/data/attributes";
import { BADGE_CATS, BADGES, maxTier, TIER_COLORS, TIER_COST, TIER_NAMES, type BadgeCat } from "~/data/badges";
import { getAudio } from "~/game/audio";
import styles from "./badge-builder.module.css";

interface Props {
  attrs: Attrs;
  bp: Record<BadgeCat, number>;
  badges: Record<string, number>;
  onClose(): void;
  onConfirm(badges: Record<string, number>, bp: Record<BadgeCat, number>): void;
}

/** Spend Badge Points to raise badge tiers (capped by your attributes) */
export function BadgeBuilder({ attrs, bp: bp0, badges: b0, onClose, onConfirm }: Props) {
  const [badges, setBadges] = useState<Record<string, number>>({ ...b0 });
  const [bp, setBp] = useState({ ...bp0 });
  const [cat, setCat] = useState<BadgeCat>("finishing");
  const up = (id: string) => {
    const b = BADGES.find((x) => x.id === id)!;
    const cur = badges[id] ?? 0;
    const cost = TIER_COST[cur + 1];
    if (cur >= maxTier(b, attrs) || bp[b.cat] < cost) {
      getAudio().play("block");
      return;
    }
    getAudio().play("click");
    setBadges((x) => ({ ...x, [id]: cur + 1 }));
    setBp((x) => ({ ...x, [b.cat]: x[b.cat] - cost }));
  };
  const down = (id: string) => {
    const b = BADGES.find((x) => x.id === id)!;
    const cur = badges[id] ?? 0;
    if (cur <= (b0[id] ?? 0)) return;
    getAudio().play("click");
    setBadges((x) => ({ ...x, [id]: cur - 1 }));
    setBp((x) => ({ ...x, [b.cat]: x[b.cat] + TIER_COST[cur] }));
  };
  const c = BADGE_CATS.find((x) => x.id === cat)!;
  return (
    <main className={styles.root}>
      <header className={styles.head}>
        <h1>Badges</h1>
        <nav>
          {BADGE_CATS.map((x) => (
            <button
              key={x.id}
              data-on={cat === x.id}
              style={{ "--c": x.color } as React.CSSProperties}
              onClick={() => setCat(x.id)}
            >
              {x.label}
              <b>{bp[x.id]} BP</b>
            </button>
          ))}
        </nav>
      </header>
      <section className={styles.grid} style={{ "--c": c.color } as React.CSSProperties}>
        {BADGES.filter((b) => b.cat === cat).map((b) => {
          const t = badges[b.id] ?? 0;
          const max = maxTier(b, attrs);
          const next = b.tiers[t];
          return (
            <article key={b.id} className={styles.card} style={{ "--t": TIER_COLORS[t] } as React.CSSProperties}>
              <span className={styles.hex}>{TIER_NAMES[t] === "—" ? "·" : TIER_NAMES[t][0]}</span>
              <div>
                <strong>{b.name}</strong>
                <em>{TIER_NAMES[t]}</em>
                <p>{b.desc}</p>
                <div className={styles.pips}>
                  {[1, 2, 3, 4].map((i) => (
                    <i
                      key={i}
                      data-on={i <= t}
                      data-locked={i > max}
                      style={{ "--p": TIER_COLORS[i] } as React.CSSProperties}
                    />
                  ))}
                </div>
                <small>
                  {t >= 4
                    ? "Maxed"
                    : t >= max
                      ? `Needs ${next} ${b.attr.replace(/([A-Z])/g, " $1").toLowerCase()} for ${TIER_NAMES[t + 1]}`
                      : `${TIER_NAMES[t + 1]}: ${TIER_COST[t + 1]} BP`}
                </small>
              </div>
              <div className={styles.btns}>
                <button onClick={() => down(b.id)}>−</button>
                <button onClick={() => up(b.id)} disabled={t >= max || bp[b.cat] < TIER_COST[t + 1]}>
                  +
                </button>
              </div>
            </article>
          );
        })}
      </section>
      <footer className={styles.foot}>
        <button onClick={onClose}>◉ Cancel</button>
        <button
          className={styles.go}
          onClick={() => {
            getAudio().play("confirm");
            onConfirm(badges, bp);
          }}
        >
          Ⓐ Confirm badges
        </button>
      </footer>
    </main>
  );
}
