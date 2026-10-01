import { useState } from "react";
import { Link } from "react-router";
import { AssetImage } from "~/components/asset-image/asset-image";
import { getBaller } from "~/data/characters";
import type { AssetId } from "~/data/higgsfield-assets";
import { CHAPTERS } from "~/data/story";
import { useProgress } from "~/hooks/use-progress";
import { useSettings } from "~/hooks/use-settings";
import type { Route } from "./+types/crib";
import styles from "./crib.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "The Crib — Concrete Crown" }];
}

interface Home {
  id: string;
  name: string;
  art: AssetId;
  blurb: string;
  unlock: string;
  unlocked: (beaten: string[]) => boolean;
}

const HOMES: Home[] = [
  {
    id: "loft",
    name: "Harbor Loft",
    art: "crib-loft",
    blurb:
      "One room above a cargo warehouse at the Pier 9 docks: a mattress, a mini hoop on the door, and the knee brace on the crate. It's where the comeback started.",
    unlock: "Starting crib",
    unlocked: () => true,
  },
  {
    id: "penthouse",
    name: "The Crown Penthouse",
    art: "crib-penthouse",
    blurb:
      "The top floor of Meridian Tower, with a private half-court under glass, the sneaker wall lit blue, and the gold crown on the trophy shelf. Monarch left the keys on the free-throw line.",
    unlock: "Beat Monarch in Chapter 5",
    unlocked: (b) => b.includes("ch5"),
  },
];

export default function Crib() {
  const [progress] = useProgress();
  const [settings] = useSettings();
  const beaten = settings.unlockAll ? CHAPTERS.map((c) => c.id) : progress.beaten;
  const [homeId, setHomeId] = useState(HOMES.filter((h) => h.unlocked(beaten)).at(-1)!.id);
  const home = HOMES.find((h) => h.id === homeId)!;
  const guardsUnlocked = beaten.includes("ch2");
  return (
    <main className={styles.page}>
      <div className={styles.art}>
        <AssetImage asset={home.art} alt={home.name} fallbackLabel=" " accent="#3ad7ff" />
      </div>
      <div className={styles.shade} />
      <header className={styles.header}>
        <Link to="/" className={styles.back} data-pad-back>
          ← Menu
        </Link>
        <h1>The Crib</h1>
        <p className={styles.owner}>Kairo "Static" Vance</p>
      </header>

      <nav className={styles.tabs}>
        {HOMES.map((h) => {
          const open = h.unlocked(beaten);
          return (
            <button key={h.id} data-active={h.id === homeId} disabled={!open} onClick={() => setHomeId(h.id)}>
              {h.name}
              <small>{open ? "Unlocked" : `🔒 ${h.unlock}`}</small>
            </button>
          );
        })}
      </nav>

      <section className={styles.panels}>
        <article className={styles.panel}>
          <h2>{home.name}</h2>
          <p>{home.blurb}</p>
        </article>

        <article className={styles.panel} data-locked={!guardsUnlocked}>
          <div className={styles.guardArt}>
            <AssetImage asset="bodyguards-twins" alt="The Hollis Twins" fallbackLabel="H×2" accent="#3ad7ff" />
          </div>
          <h2>Security: The Hollis Twins</h2>
          <p>
            Marcus and Moses Hollis are 6'8" identical twins in matching blue ties. They used to work the door at the
            Underline District, until Brick's crew started coming after the Harbor Heights kid. Now they stand courtside
            at every one of Kairo's games, and nobody has figured out which twin is which.
          </p>
          <p className={styles.note}>
            {guardsUnlocked
              ? "In-game: both twins stand courtside at Kairo's matches (Higgsfield 3D model)."
              : "🔒 Unlock by beating Brick in Chapter 2."}
          </p>
        </article>

        <article className={styles.panel}>
          <h2>Trophy shelf</h2>
          <ul className={styles.trophies}>
            {CHAPTERS.map((c) => {
              const o = getBaller(c.opponentId);
              const won = beaten.includes(c.id);
              return (
                <li key={c.id} data-won={won} style={{ "--accent": o.accent } as React.CSSProperties}>
                  <span>{won ? "🏆" : "·"}</span>
                  {o.nickname}
                  {progress.stars[c.id] && <em>★</em>}
                </li>
              );
            })}
          </ul>
          <p className={styles.note}>
            Quick match record {progress.wins}–{progress.losses}
          </p>
        </article>
      </section>
    </main>
  );
}
