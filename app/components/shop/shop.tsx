import { useState } from "react";
import { GEAR, type GearSlot } from "~/data/gear";
import { getAudio } from "~/game/audio";
import { useProgress } from "~/hooks/use-progress";
import styles from "./shop.module.css";

const TABS: { slot: GearSlot; label: string }[] = [
  { slot: "shoes", label: "Shoes" },
  { slot: "jersey", label: "Jerseys" },
  { slot: "headband", label: "Headbands" },
  { slot: "sleeve", label: "Sleeves" },
  { slot: "chain", label: "Jewelry" },
];

interface Props {
  onClose(): void;
}

/** KICKS & GEAR: buy and equip gear for Kairo with Crowns */
export function Shop({ onClose }: Props) {
  const [progress, setProgress] = useProgress();
  const [tab, setTab] = useState<GearSlot>("shoes");
  const [msg, setMsg] = useState("");
  const owned = new Set(progress.owned ?? []);
  const equipped = progress.equipped ?? {};
  const optional = tab === "headband" || tab === "sleeve" || tab === "chain";

  const buy = (id: string, price: number) => {
    if ((progress.crowns ?? 0) < price) {
      setMsg("Not enough Crowns. Win games in Story, Quick Match or the EBL to earn more.");
      getAudio().play("block");
      return;
    }
    const item = GEAR.find((g) => g.id === id)!;
    setProgress((p) => ({
      ...p,
      crowns: (p.crowns ?? 0) - price,
      owned: [...(p.owned ?? []), id],
      equipped: { ...(p.equipped ?? {}), [item.slot]: id },
    }));
    setMsg(`Bought ${item.name}. It's equipped.`);
    getAudio().play("cheer", 0.4);
  };

  const equip = (slot: GearSlot, id: string | undefined) => {
    setProgress((p) => ({ ...p, equipped: { ...(p.equipped ?? {}), [slot]: id } }));
    getAudio().play("confirm");
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Meridian City</p>
            <h2>Kicks &amp; Gear</h2>
          </div>
          <p className={styles.wallet}>₵ {(progress.crowns ?? 0).toLocaleString()}</p>
          <button className={styles.close} onClick={onClose} aria-label="Close shop">
            ✕
          </button>
        </header>
        <nav className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.slot} data-active={tab === t.slot} onClick={() => setTab(t.slot)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className={styles.grid}>
          {optional && (
            <article className={styles.card} data-equipped={!equipped[tab]}>
              <div
                className={styles.swatch}
                style={{ background: "repeating-linear-gradient(45deg,#222 0 8px,#2c2c34 8px 16px)" }}
              />
              <h3>None</h3>
              <p className={styles.brand}>Take it off</p>
              <button onClick={() => equip(tab, undefined)} disabled={!equipped[tab]}>
                {equipped[tab] ? "Equip" : "Equipped"}
              </button>
            </article>
          )}
          {GEAR.filter((g) => g.slot === tab).map((g) => {
            const has = owned.has(g.id) || g.price === 0;
            const on = equipped[g.slot] === g.id;
            return (
              <article key={g.id} className={styles.card} data-equipped={on}>
                <div className={styles.swatch}>
                  {g.swatch.map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                </div>
                <h3>{g.name}</h3>
                <p className={styles.brand}>{g.brand}</p>
                {has ? (
                  <button onClick={() => equip(g.slot, g.id)} disabled={on}>
                    {on ? "Equipped" : "Equip"}
                  </button>
                ) : (
                  <button className={styles.buy} onClick={() => buy(g.id, g.price)}>
                    Buy ₵ {g.price}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <p className={styles.msg}>
          {msg || "Gear shows on Kairo in the city and in every match. Custom gear uses the built-in 3D body."}
        </p>
      </section>
    </div>
  );
}
