import { cityFor } from "~/data/cities";
import { listings, type HomeListing, type OwnedHome } from "~/data/homes";
import styles from "./real-estate.module.css";

/** A little drawing of each kind of home, tinted with the city's accent */
export function HouseArt({ tier, accent }: { tier: number; accent: string }) {
  return (
    <svg viewBox="0 0 240 140" className={styles.art} aria-hidden>
      <rect x="0" y="118" width="240" height="22" fill="#4e7a3e" />
      {tier === 1 && (
        <g>
          <rect x="80" y="10" width="80" height="110" fill="#9fb6cc" />
          {Array.from({ length: 6 }, (_, r) =>
            Array.from({ length: 4 }, (_, c) => (
              <rect key={`${r}-${c}`} x={86 + c * 18} y={16 + r * 17} width="14" height="11" fill={r === 3 && c === 2 ? "#ffd98a" : "#dbe8f4"} />
            )),
          )}
          <rect x="112" y="104" width="16" height="16" fill={accent} />
        </g>
      )}
      {tier === 2 && (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={40 + i * 54} y="44" width="52" height="76" fill={["#b5654a", "#c98a5a", "#a65a44"][i]} />
              <rect x={48 + i * 54} y="56" width="14" height="16" fill="#f4efe6" />
              <rect x={70 + i * 54} y="56" width="14" height="16" fill="#f4efe6" />
              <rect x={58 + i * 54} y="92" width="16" height="28" fill={i === 1 ? accent : "#3a2a22"} />
            </g>
          ))}
          <rect x="36" y="38" width="170" height="8" fill="#3a2f2a" />
        </g>
      )}
      {tier === 3 && (
        <g>
          <polygon points="50,62 120,22 190,62" fill="#5a4038" />
          <rect x="60" y="60" width="120" height="60" fill="#f1e6d2" />
          <rect x="74" y="72" width="22" height="18" fill="#9fc6e6" />
          <rect x="144" y="72" width="22" height="18" fill="#9fc6e6" />
          <rect x="110" y="88" width="20" height="32" fill={accent} />
          <rect x="190" y="84" width="40" height="36" fill="#e3d6c0" />
          <rect x="196" y="92" width="28" height="28" fill="#9a9a9a" />
          <rect x="206" y="56" width="3" height="30" fill="#333" />
          <rect x="198" y="52" width="18" height="10" fill="#fff" stroke="#c33" strokeWidth="1.5" />
        </g>
      )}
      {tier === 4 && (
        <g>
          <rect x="30" y="50" width="180" height="70" fill="#f4efe6" />
          <polygon points="20,52 120,24 220,52" fill="#3f3a36" />
          {[48, 78, 162, 192].map((x) => (
            <rect key={x} x={x} y="62" width="4" height="58" fill="#e0d6c4" />
          ))}
          {[40, 66, 160, 186].map((x) => (
            <rect key={x} x={x} y="70" width="16" height="22" fill="#9fc6e6" />
          ))}
          <rect x="104" y="80" width="32" height="40" fill={accent} />
          <ellipse cx="120" cy="132" rx="60" ry="6" fill="#4fb6e0" />
        </g>
      )}
      {tier === 5 && (
        <g>
          <rect x="14" y="56" width="132" height="64" fill="#f4efe6" />
          <rect x="146" y="70" width="84" height="50" fill="#e3dbcd" />
          <polygon points="6,58 80,30 154,58" fill="#2f2b28" />
          <rect x="140" y="64" width="96" height="8" fill="#2f2b28" />
          {[26, 52, 98, 120].map((x) => (
            <rect key={x} x={x} y="68" width="16" height="22" fill="#9fc6e6" />
          ))}
          <rect x="70" y="84" width="22" height="36" fill={accent} />
          <rect x="156" y="80" width="64" height="30" fill="#c08a52" />
          <circle cx="188" cy="95" r="7" fill="none" stroke="#fff" strokeWidth="1.5" />
          <text x="188" y="78" fontSize="8" textAnchor="middle" fill="#2f2b28" fontWeight="800">
            INDOOR COURT
          </text>
          <rect x="0" y="114" width="240" height="6" fill="#2f2b28" />
        </g>
      )}
    </svg>
  );
}

interface Props {
  teamId: string;
  owned: OwnedHome | null | undefined;
  crowns: number;
  onBuy(l: HomeListing): void;
  onClose(): void;
}

/** Real estate in your team's city */
export function RealEstate({ teamId, owned, crowns, onBuy, onClose }: Props) {
  const city = cityFor(teamId);
  return (
    <div className={styles.root} style={{ "--accent": city.accent } as React.CSSProperties}>
      <header className={styles.head}>
        <div>
          <p>
            {city.city}, {city.state} · Real estate
          </p>
          <h1>Find your home</h1>
          <span>You live here until you retire. Kids need bedrooms: one spare room per kid, up to three.</span>
        </div>
        <div className={styles.wallet}>₵ {crowns.toLocaleString()}</div>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div className={styles.grid}>
        {listings(teamId).map((l) => {
          const mine = owned?.teamId === teamId && owned.tier === l.tier;
          const below = !!owned && owned.teamId === teamId && owned.tier > l.tier;
          const afford = crowns >= l.price;
          return (
            <article key={l.tier} className={styles.card} data-mine={mine}>
              <HouseArt tier={l.tier} accent={city.accent} />
              <div className={styles.info}>
                <small>{l.neighborhood}</small>
                <strong>{l.name}</strong>
                <p>{l.blurb}</p>
                <ul>
                  <li>{l.beds} bd</li>
                  <li>{l.baths} ba</li>
                  <li>{l.beds - 1 > 0 ? `Room for ${Math.min(3, l.beds - 1)} kid${l.beds - 1 === 1 ? "" : "s"}` : "No kids' room"}</li>
                </ul>
              </div>
              {mine ? (
                <button disabled className={styles.home}>
                  ★ Your home
                </button>
              ) : (
                <button disabled={!afford || below} onClick={() => onBuy(l)}>
                  {below ? "Downgrade? No." : `₵ ${l.price.toLocaleString()}`}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
