import { ATTRS, GROUPS, heightLabel, overallOf, type AttrGroup, type Attrs } from "~/data/attributes";
import { BADGE_CATS, BADGES, badgePotential, maxTier, TIER_COLORS } from "~/data/badges";
import type { MyPlayer } from "~/data/career";
import { getAudio } from "~/game/audio";
import styles from "./potential.module.css";

interface Props {
  me: MyPlayer;
  start: Attrs;
  caps: Attrs;
  onContinue(): void;
  onBack(): void;
}

const ORDER: { label: string; groups: AttrGroup[]; color: string }[] = [
  { label: "Finishing", groups: ["finishing"], color: GROUPS.finishing.color },
  { label: "Shooting", groups: ["shooting"], color: GROUPS.shooting.color },
  { label: "Playmaking", groups: ["playmaking"], color: GROUPS.playmaking.color },
  { label: "Defense/Rebounding", groups: ["defense", "rebounding"], color: GROUPS.defense.color },
  { label: "Physicals", groups: ["physicals"], color: "#b07a3a" },
];

/** MyCareer step 3: where this build can go, attribute by attribute */
export function Potential({ me, start, caps, onContinue, onBack }: Props) {
  const pot = overallOf(caps, me.archetype);
  const weight = Math.round(150 + (me.heightIn - 70) * 5.2 + (me.archetype === "big" ? 25 : 0));
  const wingspan = me.heightIn + (me.archetype === "big" || me.archetype === "lockdown" ? 5 : 3);
  return (
    <main className={styles.root}>
      <section className={styles.list}>
        <div className={styles.cols}>
          <span>Attribute</span>
          <span>Starting</span>
          <span>Potential</span>
        </div>
        {ORDER.map((o) => (
          <div key={o.label} className={styles.group} style={{ "--c": o.color } as React.CSSProperties}>
            <h3>{o.label}</h3>
            {ATTRS.filter((a) => o.groups.includes(a.group)).map((a, i) => (
              <div key={a.id} className={styles.row} data-first={i === 0 && o.label === "Finishing"}>
                <span>{a.label}</span>
                <b>{start[a.id]}</b>
                <div className={styles.bar}>
                  <i style={{ width: `${start[a.id]}%` }} />
                  <em style={{ left: `${caps[a.id]}%` }} />
                  <u style={{ width: `${caps[a.id]}%` }} />
                </div>
                <strong>{caps[a.id]}</strong>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className={styles.right}>
        <header className={styles.banner}>
          <span className={styles.logo}>
            <b>MP</b>×<i>EBL</i>
            <small>BUILDER</small>
          </span>
          <h1>Potential</h1>
          <div className={styles.ovr}>
            <small>OVR</small>
            <strong>{pot}</strong>
            <small>{pot} MAX</small>
          </div>
          <div className={styles.name}>
            <strong>
              {me.name.split(" ")[0]?.[0]}
              {me.name.split(" ")[1]?.[0]}
            </strong>
            <p>
              Height {heightLabel(me.heightIn)} &nbsp; Weight {weight} lbs &nbsp; Wingspan {heightLabel(wingspan)}
            </p>
          </div>
        </header>

        <div className={styles.cards}>
          {BADGE_CATS.map((c) => (
            <article key={c.id} className={styles.card} style={{ "--c": c.color } as React.CSSProperties}>
              <header>
                <strong>{badgePotential(c.id, caps)}</strong>
                <span>
                  Potential
                  <br />
                  Badge Points
                </span>
              </header>
              <p>Available Badges</p>
              <div className={styles.hexes}>
                {BADGES.filter((b) => b.cat === c.id).map((b) => (
                  <span
                    key={b.id}
                    title={b.name}
                    className={styles.hex}
                    style={{ "--t": TIER_COLORS[maxTier(b, caps)] } as React.CSSProperties}
                  >
                    {b.name
                      .split(/[\s&-]+/)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                ))}
              </div>
              <small>{c.label}</small>
            </article>
          ))}
        </div>
        <p className={styles.hint}>
          Unlock Badge Points through gameplay to upgrade the badges in each category. Individual badges become
          available as you meet attribute requirements.
        </p>
        <div className={styles.actions}>
          <button onClick={onBack}>◉ Back</button>
          <button
            className={styles.go}
            onClick={() => {
              getAudio().play("confirm");
              onContinue();
            }}
          >
            Ⓐ Continue
          </button>
        </div>
      </section>
    </main>
  );
}
