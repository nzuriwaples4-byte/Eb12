import { getBaller } from "~/data/characters";
import type { MatchResult } from "~/game/types";
import styles from "./results.module.css";

interface Props {
  result: MatchResult;
  playerId: string;
  opponentId: string;
  objective?: { label: string; met: boolean };
  actions: React.ReactNode;
}

const ROWS: [string, keyof MatchResult["stats"][0]][] = [
  ["Points", "points"],
  ["FG", "fgm"],
  ["Threes", "threes"],
  ["Dunks", "dunks"],
  ["Ankles broken", "ankles"],
  ["Blocks", "blocks"],
  ["Steals", "steals"],
  ["Perfect releases", "perfect"],
  ["Specials", "specials"],
];

export function Results({ result, playerId, opponentId, objective, actions }: Props) {
  const p = getBaller(playerId);
  const o = getBaller(opponentId);
  const won = result.winner === 0;
  return (
    <section className={styles.card} style={{ "--accent": won ? p.accent : o.accent } as React.CSSProperties}>
      <h2 className={styles.head}>{won ? "W — YOU RUN THIS COURT" : "L — RUN IT BACK"}</h2>
      <p className={styles.score}>
        <span>{p.nickname}</span> {result.score[0]} – {result.score[1]} <span>{o.nickname}</span>
      </p>
      {objective && (
        <p className={styles.objective} data-met={objective.met}>
          {objective.met ? "★ Objective complete" : "☆ Objective missed"}: {objective.label}
        </p>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{p.nickname}</th>
            <th />
            <th>{o.nickname}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, k]) => (
            <tr key={k}>
              <td>{k === "fgm" ? `${result.stats[0].fgm}/${result.stats[0].fga}` : result.stats[0][k]}</td>
              <th>{label}</th>
              <td>{k === "fgm" ? `${result.stats[1].fgm}/${result.stats[1].fga}` : result.stats[1][k]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.actions}>{actions}</div>
    </section>
  );
}
