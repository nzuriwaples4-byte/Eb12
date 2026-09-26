import { useState } from "react";
import { Link } from "react-router";
import { BALLERS, overall } from "~/data/characters";
import { ShowcaseCanvas } from "~/components/showcase-canvas/showcase-canvas";
import type { Route } from "./+types/roster";
import styles from "./roster.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Roster — Concrete Crown" }];
}

export default function Roster() {
  const [focus, setFocus] = useState<string | null>(null);
  const active = BALLERS.find((b) => b.id === focus);
  return (
    <main className={styles.page}>
      <ShowcaseCanvas ballers={BALLERS} focusId={focus} className={styles.stage} />
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          ← Menu
        </Link>
        <h1 className={styles.title}>The Crown Circuit</h1>
      </header>
      <nav className={styles.cards}>
        {BALLERS.map((b) => (
          <button
            key={b.id}
            className={styles.card}
            style={{ "--accent": b.accent } as React.CSSProperties}
            data-active={b.id === focus}
            onMouseEnter={() => setFocus(b.id)}
            onFocus={() => setFocus(b.id)}
            onClick={() => setFocus(b.id === focus ? null : b.id)}
          >
            <span className={styles.nick}>{b.nickname}</span>
            <span className={styles.ovr}>{overall(b)}</span>
          </button>
        ))}
      </nav>
      {active && (
        <aside className={styles.bio} style={{ "--accent": active.accent } as React.CSSProperties}>
          <h2>
            {active.name} <em>“{active.nickname}”</em>
          </h2>
          <p className={styles.meta}>
            {active.heightLabel} · {active.from}
          </p>
          <p>{active.bio}</p>
          <p className={styles.special}>
            Special: <strong>{active.special.name}</strong>. {active.special.description}
          </p>
        </aside>
      )}
    </main>
  );
}
