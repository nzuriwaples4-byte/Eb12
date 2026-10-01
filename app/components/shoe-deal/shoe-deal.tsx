import "@fontsource/caveat/600.css";
import { useState } from "react";
import { SneakerArt, VantaLogo, VyroLogo } from "~/components/vyro-store/vyro-store";
import { BRANDS, TIER_LABEL, type BrandId, type ShoeDeal } from "~/data/deals";
import { getAudio } from "~/game/audio";
import styles from "./shoe-deal.module.css";

interface Props {
  offers: ShoeDeal[];
  athlete: { name: string; number: string; team: string };
  season: number;
  /** Dev: show this contract already signed */
  signed?: BrandId;
  onSign(deal: ShoeDeal): void;
  onDecline(): void;
}

const REP: Record<BrandId, string> = {
  vyro: "D. Castell · VP, VYRO Basketball",
  vanta: "R. Okafor · Head of VANTA Hoops",
};

const money = (n: number) => `₵${n.toLocaleString()}`;

/** Two endorsement contracts on the table: VYRO Athletics and VANTA. Sign one. */
export function ShoeDealContracts({ offers, athlete, season, signed: preSigned, onSign, onDecline }: Props) {
  const [signed, setSigned] = useState<BrandId | null>(preSigned ?? null);
  const deal = offers.find((o) => o.brand === signed);

  const sign = (d: ShoeDeal) => {
    if (signed) return;
    setSigned(d.brand);
    getAudio().play("cheer", 0.5);
  };

  return (
    <div className={styles.root} data-signed={signed ?? undefined}>
      <header className={styles.head}>
        <p>
          Season {season} · Agent: Tasha Reyes · Two offers on the table
        </p>
        <h1>The Shoe Deal</h1>
        <span>Read the terms. Sign one. Wear it every night.</span>
      </header>

      <div className={styles.table}>
        {offers.map((o) => {
          const b = BRANDS[o.brand];
          const mine = signed === o.brand;
          return (
            <article
              key={o.brand}
              className={styles.paper}
              data-brand={o.brand}
              data-state={signed ? (mine ? "signed" : "passed") : "open"}
            >
              <div className={styles.band}>
                {o.brand === "vanta" ? <VantaLogo size={56} /> : <VyroLogo size={56} />}
                <div>
                  <strong>{o.brand === "vanta" ? "VANTA" : "VYRO Athletics"}</strong>
                  <small>{b.tagline}</small>
                </div>
                <em>{TIER_LABEL[o.tier]}</em>
              </div>

              <div className={styles.body}>
                <h2>Endorsement Agreement</h2>
                <p className={styles.parties}>
                  This agreement is made between <b>{b.name}</b> (“Brand”) and <b>{athlete.name}</b> (“Athlete”), #
                  {athlete.number}, {athlete.team}.
                </p>

                <div className={styles.shoe}>
                  <SneakerArt colors={o.shoeColors} mark={o.brand} />
                  <div>
                    <small>{o.shoe ? "Your signature shoe" : "Player Edition"}</small>
                    <strong>{o.shoe ?? (o.brand === "vanta" ? "VANTA 01" : "Waples 1")}</strong>
                  </div>
                </div>

                <dl className={styles.terms}>
                  <div>
                    <dt>Signing bonus</dt>
                    <dd>{money(o.bonus)}</dd>
                  </div>
                  <div>
                    <dt>Per game</dt>
                    <dd>{money(o.perGame)}</dd>
                  </div>
                  <div>
                    <dt>Length</dt>
                    <dd>{o.years >= 99 ? "Lifetime" : `${o.years} seasons`}</dd>
                  </div>
                  <div>
                    <dt>Royalty</dt>
                    <dd>{o.royalty ? `${o.royalty}% of sales` : "—"}</dd>
                  </div>
                </dl>

                <ul className={styles.perks}>
                  {o.perks.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>

                <div className={styles.sigs}>
                  <div>
                    <span className={styles.ink} data-on={mine}>
                      {athlete.name}
                    </span>
                    <small>Athlete · Season {season}</small>
                  </div>
                  <div>
                    <span className={styles.ink} data-on>
                      {REP[o.brand].split(" · ")[0]}
                    </span>
                    <small>{REP[o.brand].split(" · ")[1]}</small>
                  </div>
                </div>
              </div>

              {mine && <div className={styles.stamp}>Signed</div>}
              {!signed && (
                <button className={styles.sign} onClick={() => sign(o)}>
                  Sign with {b.short}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <footer className={styles.foot}>
        {deal ? (
          <>
            <p>
              Welcome to {BRANDS[deal.brand].name}. {money(deal.bonus)} hits your account today
              {deal.shoe ? `, and the ${deal.shoe} drops this season.` : "."}
            </p>
            <button className={styles.go} onClick={() => onSign(deal)} autoFocus>
              Continue ▸
            </button>
          </>
        ) : (
          <button className={styles.decline} onClick={onDecline}>
            Stay unsigned for now
          </button>
        )}
      </footer>
    </div>
  );
}
