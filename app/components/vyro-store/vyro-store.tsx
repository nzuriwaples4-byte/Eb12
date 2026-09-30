import { useMemo, useState } from "react";
import { GEAR, VYRO, type GearItem, type GearSlot } from "~/data/gear";
import { getAudio } from "~/game/audio";
import { useProgress } from "~/hooks/use-progress";
import styles from "./vyro-store.module.css";

type Tab = "signature" | "footwear" | "apparel" | "jersey" | "street";
const TABS: { id: Tab; label: string }[] = [
  { id: "signature", label: "Waples Signature" },
  { id: "footwear", label: "Footwear" },
  { id: "apparel", label: "Apparel & Gear" },
  { id: "jersey", label: "Elite Circuit" },
  { id: "street", label: "Street Brands" },
];

/** VYRO's crown mark */
export function VyroLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 100 80" aria-hidden>
      <defs>
        <linearGradient id="vyroG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <path d="M4 6 L26 30 L34 8 L50 34 L66 8 L74 30 L96 6 L84 60 L66 44 L50 74 L34 44 L16 60 Z" fill="url(#vyroG)" />
    </svg>
  );
}

/** Side-profile sneaker drawn in the item's colorway */
export function SneakerArt({ colors }: { colors: [string, string, string] }) {
  const [upper, accent, sole] = colors;
  return (
    <svg viewBox="0 0 220 110" className={styles.sneaker} aria-hidden>
      <ellipse cx="112" cy="100" rx="96" ry="6" fill="rgba(139,92,246,0.35)" />
      <path
        d="M14 82 Q12 70 24 66 L70 58 Q96 40 118 26 Q128 20 140 24 L150 30 Q170 34 188 56 Q206 64 206 78 L206 86 L14 86 Z"
        fill={upper}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.5"
      />
      <path d="M60 64 L100 44 L96 54 L140 34 L118 58 L170 46 L128 70 Z" fill={accent} opacity="0.95" />
      <path d="M150 30 Q166 30 176 44" stroke={accent} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M12 84 L208 84 L206 94 Q110 100 14 94 Z" fill={sole} />
      <path d="M22 90 L200 90" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
      <g transform="translate(124 44) scale(0.18)">
        <path
          d="M4 6 L26 30 L34 8 L50 34 L66 8 L74 30 L96 6 L84 60 L66 44 L50 74 L34 44 L16 60 Z"
          fill={accent === upper ? "#8b5cf6" : "#ffffff"}
          opacity="0.9"
        />
      </g>
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M${98 + i * 9} ${46 - i * 5} l10 6`}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function GoodsArt({ item }: { item: GearItem }) {
  const [a, b] = item.swatch;
  return (
    <div className={styles.goods} style={{ "--a": a, "--b": b ?? a } as React.CSSProperties}>
      <VyroLogo size={54} />
      <span>{item.kind}</span>
    </div>
  );
}

interface Props {
  onClose(): void;
}

/** VYRO Athletics flagship: buy and equip VYRO gear with Crowns */
export function VyroStore({ onClose }: Props) {
  const [progress, setProgress] = useProgress();
  const [tab, setTab] = useState<Tab>("signature");
  const [msg, setMsg] = useState("");
  const owned = new Set(progress.owned ?? []);
  const equipped = progress.equipped ?? {};

  const items = useMemo(() => {
    if (tab === "signature") return VYRO.filter((g) => g.line?.startsWith("Waples"));
    if (tab === "footwear") return VYRO.filter((g) => g.slot === "shoes" && !g.line?.startsWith("Waples"));
    if (tab === "apparel") return VYRO.filter((g) => g.slot === "lifestyle");
    if (tab === "jersey") return VYRO.filter((g) => g.slot === "jersey");
    return GEAR.filter((g) => g.brand !== "VYRO Athletics");
  }, [tab]);

  // Group signature shoes by model so each model shows its colorways together
  const groups = useMemo(() => {
    const out = new Map<string, GearItem[]>();
    for (const g of items) {
      const key = tab === "signature" ? g.line! : "all";
      out.set(key, [...(out.get(key) ?? []), g]);
    }
    return [...out.entries()];
  }, [items, tab]);

  const buy = (item: GearItem) => {
    if ((progress.crowns ?? 0) < item.price) {
      setMsg("Not enough Crowns. Win games to earn more.");
      getAudio().play("block");
      return;
    }
    setProgress((p) => ({
      ...p,
      crowns: (p.crowns ?? 0) - item.price,
      owned: [...(p.owned ?? []), item.id],
      equipped: item.slot === "lifestyle" ? p.equipped : { ...(p.equipped ?? {}), [item.slot]: item.id },
    }));
    setMsg(item.slot === "lifestyle" ? `${item.name} is in your closet.` : `Copped the ${item.name}. Equipped.`);
    getAudio().play("cheer", 0.4);
  };

  const equip = (slot: GearSlot, id: string) => {
    setProgress((p) => ({ ...p, equipped: { ...(p.equipped ?? {}), [slot]: id } }));
    getAudio().play("confirm");
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <VyroLogo size={64} />
          <div>
            <h2>
              VYRO <span>Athletics</span>
            </h2>
            <p className={styles.tag}>Built for more · Performance / Style / Legacy</p>
          </div>
          <p className={styles.wallet}>₵ {(progress.crowns ?? 0).toLocaleString()}</p>
          <button className={styles.close} onClick={onClose} aria-label="Close store">
            ✕
          </button>
        </header>
        <nav className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} data-on={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        {msg && <p className={styles.msg}>{msg}</p>}
        <div className={styles.scroll}>
          {groups.map(([line, list]) => (
            <div key={line} className={styles.group}>
              {tab === "signature" && (
                <h3 className={styles.model}>
                  {line} <small>Signature Shoe</small>
                </h3>
              )}
              <div className={styles.grid}>
                {list.map((g) => {
                  const have = owned.has(g.id) || g.price === 0;
                  const on = g.slot !== "lifestyle" && equipped[g.slot] === g.id;
                  return (
                    <article key={g.id} className={styles.card} data-on={on}>
                      {g.shoe ? (
                        <SneakerArt colors={g.shoe} />
                      ) : g.slot === "lifestyle" || g.slot === "jersey" ? (
                        <GoodsArt item={g} />
                      ) : (
                        <div
                          className={styles.swatch}
                          style={{ background: `linear-gradient(135deg, ${g.swatch.join(",")})` }}
                        />
                      )}
                      <strong>{g.colorway ?? g.name}</strong>
                      <small>{g.colorway ? g.line : `${g.brand}${g.kind ? ` · ${g.kind}` : ""}`}</small>
                      <div className={styles.dots}>
                        {g.swatch.map((c, i) => (
                          <i key={i} style={{ background: c }} />
                        ))}
                      </div>
                      {have ? (
                        g.slot === "lifestyle" ? (
                          <button disabled>In your closet</button>
                        ) : (
                          <button disabled={on} onClick={() => equip(g.slot, g.id)}>
                            {on ? "Equipped" : "Equip"}
                          </button>
                        )
                      ) : (
                        <button data-buy onClick={() => buy(g)}>
                          ₵ {g.price.toLocaleString()}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <footer className={styles.foot}>
          <span>More than shoes. It's a movement.</span>
          <span>Stores: Atlanta · New York · Chicago · Los Angeles</span>
        </footer>
      </section>
    </div>
  );
}
