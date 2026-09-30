import { useMemo, useState } from "react";
import { Link } from "react-router";
import { GameView } from "~/components/game-view/game-view";
import { MenuButton } from "~/components/menu-button/menu-button";
import { getBaller } from "~/data/characters";
import { EBL_TEAMS, getTeam } from "~/data/ebl";
import type { MatchResult } from "~/game/types";
import { useSettings } from "~/hooks/use-settings";
import {
  askingSalary,
  autoDraft,
  CAP,
  canSign,
  coachCandidates,
  estimatedAttendance,
  evaluateTrade,
  executeTrade,
  finishFreeAgency,
  fullName,
  hireCoach,
  MIN_SALARY,
  newLeague,
  onTheClock,
  payroll,
  perGame,
  PLAYOFF_TEAMS,
  releasePlayer,
  ROSTER_MAX,
  ROUND_NAMES,
  setTicketPrice,
  signPlayer,
  simPlayoffDay,
  simPlayoffs,
  simWeek,
  simWeeks,
  sortedRoster,
  standings,
  strength,
  TAX_LINE,
  userDraft,
  userGame,
  userSeries,
  type League,
  type OPlayer,
} from "~/owner/league";
import { useLeague } from "~/owner/use-league";
import type { Route } from "./+types/owner";
import styles from "./owner.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Owner Mode — EBL 2" }];
}

type Tab = "home" | "roster" | "trades" | "market" | "standings" | "finances" | "history";
const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Front Office" },
  { id: "roster", label: "Roster" },
  { id: "trades", label: "Trades" },
  { id: "market", label: "Draft & Free Agency" },
  { id: "standings", label: "League" },
  { id: "finances", label: "Business" },
  { id: "history", label: "History" },
];

const money = (m: number) => `$${m.toFixed(1)}M`;

export default function Owner() {
  const [{ league }, setStore] = useLeague();
  const set = (l: League | null) => setStore(() => ({ league: l }));
  const [tab, setTab] = useState<Tab>("home");
  const [playing, setPlaying] = useState<null | { home: string; away: string; playoff: boolean }>(null);
  const [settings] = useSettings();

  if (!league) return <PickTeam onPick={(id) => set(newLeague(id))} />;

  const l = league;
  const me = l.teams[l.userTeam];

  if (playing) {
    const myStar = sortedRoster(l, l.userTeam).find((p) => p.baller) ?? sortedRoster(l, l.userTeam)[0];
    const oppId = playing.home === l.userTeam ? playing.away : playing.home;
    const theirStar = sortedRoster(l, oppId).find((p) => p.baller);
    return (
      <GameView
        config={{
          playerId: myStar.baller ?? "kairo",
          opponentId: theirStar?.baller ?? getTeam(oppId).starId,
          venueId: getTeam(playing.home).venueId,
          target: 21,
          difficulty: settings.difficulty,
          useHiggsfield: settings.useHiggsfield,
          shadows: settings.shadows,
          cameraShake: settings.cameraShake,
        }}
        objective={`Star showdown decides the game: ${me.name} vs ${l.teams[oppId].name}`}
        onFinish={(r: MatchResult) => {
          // The 1-on-1 score becomes the team score
          const mine = 92 + r.score[0] * 1.3 + Math.round(Math.random() * 6);
          const theirs = 92 + r.score[1] * 1.3 + Math.round(Math.random() * 6);
          const [a, b] = [Math.round(mine), Math.round(theirs)];
          const fixed: [number, number] = a === b ? (r.winner === 0 ? [a + 2, b] : [a, b + 2]) : [a, b];
          const score: [number, number] = playing.home === l.userTeam ? fixed : [fixed[1], fixed[0]];
          set(playing.playoff ? simPlayoffDay(l, score) : simWeek(l, score));
          setPlaying(null);
        }}
        onQuit={() => setPlaying(null)}
      />
    );
  }

  return (
    <main className={styles.page} style={{ "--team": me.primary, "--team2": me.secondary } as React.CSSProperties}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          ← Menu
        </Link>
        <div>
          <p className={styles.kicker}>
            Owner Mode · Season {l.season} · {phaseLabel(l)}
          </p>
          <h1>
            {me.city} <span>{me.name}</span>
          </h1>
          <p className={styles.meta}>
            {me.w}-{me.l} · Payroll {money(payroll(l, me.id))} / cap {money(CAP)} · Cash {money(me.cash)} · Fans{" "}
            {Math.round(me.fans)}
          </p>
        </div>
        <div className={styles.ovr}>
          <strong>{Math.round(strength(l, me.id))}</strong>
          <span>TEAM</span>
        </div>
      </header>

      <nav className={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.id} data-on={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "home" && <Home l={l} set={set} play={setPlaying} goto={setTab} />}
      {tab === "roster" && <Roster l={l} set={set} />}
      {tab === "trades" && <Trades l={l} set={set} />}
      {tab === "market" && <Market l={l} set={set} />}
      {tab === "standings" && <LeagueTab l={l} />}
      {tab === "finances" && <Business l={l} set={set} />}
      {tab === "history" && <History l={l} reset={() => confirm("Start over with a new franchise?") && set(null)} />}
    </main>
  );
}

function phaseLabel(l: League) {
  if (l.phase === "regular") return `Week ${Math.min(l.week + 1, l.schedule.length)} of ${l.schedule.length}`;
  if (l.phase === "playoffs") return `Playoffs · ${ROUND_NAMES[l.playoff?.round ?? 0]}`;
  if (l.phase === "draft") return "EBL Draft";
  return "Free Agency";
}

/* ---------------------------------------------------------------- pick */

function PickTeam({ onPick }: { onPick(id: string): void }) {
  const [sel, setSel] = useState(EBL_TEAMS[0].id);
  const t = getTeam(sel);
  return (
    <main className={styles.page} style={{ "--team": t.primary } as React.CSSProperties}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          ← Menu
        </Link>
        <div>
          <p className={styles.kicker}>EBL 2 · Owner Mode</p>
          <h1>Buy a franchise</h1>
          <p className={styles.meta}>
            Run every part of the team: trades, the draft, free agency, the coach, ticket prices. Sim the season or play
            the big games yourself.
          </p>
        </div>
      </header>
      <section className={styles.teamGrid}>
        {[...EBL_TEAMS]
          .sort((a, b) => b.rating - a.rating)
          .map((team) => (
            <button
              key={team.id}
              data-on={sel === team.id}
              style={{ "--c": team.primary, "--c2": team.secondary } as React.CSSProperties}
              onClick={() => setSel(team.id)}
            >
              <span className={styles.abbr}>{team.abbr}</span>
              <strong>
                {team.city} {team.name}
              </strong>
              <small>
                {team.rating >= 85 ? "Contender" : team.rating >= 72 ? "Playoff team" : "Rebuild"} · Star:{" "}
                {getBaller(team.starId).name}
              </small>
            </button>
          ))}
      </section>
      <div>
        <MenuButton variant="primary" onClick={() => onPick(sel)}>
          Take over the {t.city} {t.name} ▶
        </MenuButton>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- home */

function Home({
  l,
  set,
  play,
  goto,
}: {
  l: League;
  set(l: League): void;
  play(g: { home: string; away: string; playoff: boolean }): void;
  goto(t: Tab): void;
}) {
  const me = l.teams[l.userTeam];
  const game = userGame(l);
  const series = userSeries(l);
  const clock = onTheClock(l);
  const table = standings(l);
  const rank = table.findIndex((t) => t.id === me.id) + 1;
  return (
    <section className={styles.grid}>
      <article className={styles.card} data-main>
        {l.phase === "regular" && game && (
          <>
            <h2>Next game</h2>
            <p className={styles.big}>
              {game[0] === me.id ? "vs" : "@"} {l.teams[game[0] === me.id ? game[1] : game[0]].city}{" "}
              {l.teams[game[0] === me.id ? game[1] : game[0]].name}
            </p>
            <p className={styles.small}>
              #{rank} in the EBL · Top {PLAYOFF_TEAMS} make the playoffs · Owner goal: {l.goals.wins}+ wins
            </p>
            <div className={styles.row}>
              <MenuButton variant="primary" onClick={() => set(simWeek(l))} autoFocus>
                Sim week
              </MenuButton>
              <MenuButton onClick={() => play({ home: game[0], away: game[1], playoff: false })}>
                Play the star showdown
              </MenuButton>
              <MenuButton onClick={() => set(simWeeks(l, 5))}>Sim 5 weeks</MenuButton>
              <MenuButton onClick={() => set(simWeeks(l, 99))}>Sim to playoffs</MenuButton>
            </div>
          </>
        )}
        {l.phase === "playoffs" && (
          <>
            <h2>{ROUND_NAMES[l.playoff!.round]}</h2>
            {series ? (
              <p className={styles.big}>
                vs {l.teams[series.a === me.id ? series.b : series.a].name} ·{" "}
                {series.a === me.id ? `${series.wa}-${series.wb}` : `${series.wb}-${series.wa}`}
              </p>
            ) : (
              <p className={styles.big}>You're watching from the owner's box.</p>
            )}
            <div className={styles.row}>
              <MenuButton variant="primary" onClick={() => set(simPlayoffDay(l))}>
                Sim game day
              </MenuButton>
              {series && (
                <MenuButton
                  onClick={() => {
                    const g = series.wa + series.wb;
                    const aHome = g % 2 === 0 || g === 4;
                    play({ home: aHome ? series.a : series.b, away: aHome ? series.b : series.a, playoff: true });
                  }}
                >
                  Play the star showdown
                </MenuButton>
              )}
              <MenuButton onClick={() => set(simPlayoffs(l))}>Sim the rest</MenuButton>
            </div>
          </>
        )}
        {l.phase === "draft" && clock && (
          <>
            <h2>EBL Draft</h2>
            <p className={styles.big}>
              Pick {clock.pick}: {l.teams[clock.team].name} {clock.team === me.id ? "(you're on the clock!)" : ""}
            </p>
            <div className={styles.row}>
              {clock.team === me.id ? (
                <MenuButton variant="primary" onClick={() => goto("market")}>
                  Make your pick
                </MenuButton>
              ) : (
                <MenuButton variant="primary" onClick={() => set(autoDraft(l))}>
                  Sim to your pick
                </MenuButton>
              )}
              <MenuButton onClick={() => set(autoDraft(l, true))}>Auto-draft everything</MenuButton>
            </div>
          </>
        )}
        {l.phase === "freeagency" && (
          <>
            <h2>Free agency</h2>
            <p className={styles.big}>
              {me.roster.length}/{ROSTER_MAX} players · {money(CAP - payroll(l, me.id))} cap space
            </p>
            <div className={styles.row}>
              <MenuButton variant="primary" onClick={() => goto("market")}>
                Sign players
              </MenuButton>
              <MenuButton onClick={() => set(finishFreeAgency(l))}>Start season {l.season + 1} ▶</MenuButton>
            </div>
          </>
        )}
      </article>
      <article className={styles.card}>
        <h2>Owner goals</h2>
        <p>
          Wins: <b>{me.w}</b> / {l.goals.wins}
        </p>
        <p>
          Profit:{" "}
          <b className={me.revenue - me.expenses >= 0 ? styles.pos : styles.neg}>{money(me.revenue - me.expenses)}</b>
        </p>
        <p>
          Coach: <b>{me.coach.name}</b> ({me.coach.rating})
        </p>
      </article>
      <article className={styles.card} data-wide>
        <h2>News</h2>
        <ul className={styles.news}>
          {l.news.slice(0, 12).map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}

/* ---------------------------------------------------------------- roster */

function PlayerRow({ l, p, children }: { l: League; p: OPlayer; children?: React.ReactNode }) {
  return (
    <tr data-hurt={p.injury > 0}>
      <td>
        {fullName(p)}
        {p.baller && " ★"}
        {p.injury > 0 && ` 🩹${p.injury}`}
      </td>
      <td>{p.pos}</td>
      <td>{p.age}</td>
      <td>
        <b>{p.ovr}</b>
      </td>
      <td>{p.pot}</td>
      <td>{money(p.contract.salary)}</td>
      <td>{p.contract.years}</td>
      <td>{perGame(p, "pts")}</td>
      <td>{perGame(p, "reb")}</td>
      <td>{perGame(p, "ast")}</td>
      {children && <td>{children}</td>}
    </tr>
  );
  void l;
}

const HEAD = ["Player", "Pos", "Age", "OVR", "POT", "Salary", "Yrs", "PPG", "RPG", "APG"];

function Roster({ l, set }: { l: League; set(l: League): void }) {
  const roster = sortedRoster(l, l.userTeam);
  return (
    <section className={styles.card}>
      <h2>
        Roster ({roster.length}/{ROSTER_MAX}) · Payroll {money(payroll(l, l.userTeam))}
        {payroll(l, l.userTeam) > TAX_LINE && <span className={styles.neg}> · LUXURY TAX</span>}
      </h2>
      <table className={styles.table}>
        <thead>
          <tr>
            {HEAD.map((h) => (
              <th key={h}>{h}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {roster.map((p) => (
            <PlayerRow key={p.id} l={l} p={p}>
              <button
                className={styles.small}
                onClick={() => confirm(`Release ${fullName(p)}?`) && set(releasePlayer(l, p.id))}
                disabled={roster.length <= 8}
              >
                Release
              </button>
            </PlayerRow>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ---------------------------------------------------------------- trades */

function Trades({ l, set }: { l: League; set(l: League): void }) {
  const others = Object.values(l.teams).filter((t) => t.id !== l.userTeam);
  const [partner, setPartner] = useState(others[0].id);
  const [give, setGive] = useState<number[]>([]);
  const [get, setGet] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const ev = useMemo(() => evaluateTrade(l, partner, give, get), [l, partner, give, get]);
  const toggle = (list: number[], setList: (x: number[]) => void, id: number) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const side = (teamId: string, sel: number[], setSel: (x: number[]) => void) => (
    <table className={styles.table}>
      <tbody>
        {sortedRoster(l, teamId).map((p) => (
          <tr
            key={p.id}
            data-sel={sel.includes(p.id)}
            onClick={() => toggle(sel, setSel, p.id)}
            className={styles.pickRow}
          >
            <td>
              <input type="checkbox" readOnly checked={sel.includes(p.id)} /> {fullName(p)}
              {p.baller && " ★"}
            </td>
            <td>{p.pos}</td>
            <td>{p.age}</td>
            <td>
              <b>{p.ovr}</b>/{p.pot}
            </td>
            <td>
              {money(p.contract.salary)} × {p.contract.years}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const disabled = l.phase === "playoffs" || l.phase === "draft";
  return (
    <section className={styles.grid2}>
      <article className={styles.card}>
        <h2>You give</h2>
        {side(l.userTeam, give, setGive)}
      </article>
      <article className={styles.card}>
        <h2>
          You get from{" "}
          <select
            value={partner}
            onChange={(e) => {
              setPartner(e.target.value);
              setGet([]);
              setMsg("");
            }}
          >
            {others.map((t) => (
              <option key={t.id} value={t.id}>
                {t.city} {t.name}
              </option>
            ))}
          </select>
        </h2>
        {side(partner, get, setGet)}
      </article>
      <article className={styles.card} data-wide>
        <p className={ev.ok ? styles.pos : styles.small}>
          {disabled ? "The trade window is closed during the playoffs and the draft." : ev.msg}
        </p>
        <MenuButton
          variant="primary"
          disabled={!ev.ok || disabled}
          onClick={() => {
            set(executeTrade(l, partner, give, get));
            setGive([]);
            setGet([]);
            setMsg("Trade complete!");
          }}
        >
          Propose trade
        </MenuButton>
        {msg && <p className={styles.pos}>{msg}</p>}
      </article>
    </section>
  );
}

/* ---------------------------------------------------------------- market */

function Market({ l, set }: { l: League; set(l: League): void }) {
  const [msg, setMsg] = useState("");
  const clock = onTheClock(l);
  if (l.phase === "draft") {
    const prospects = l.draftClass.map((id) => l.players[id]);
    const mine = clock?.team === l.userTeam;
    return (
      <section className={styles.card}>
        <h2>
          Draft board{" "}
          {mine ? `· You're on the clock (pick ${clock!.pick})` : `· ${l.teams[clock!.team].name} are picking`}
        </h2>
        {!mine && (
          <MenuButton variant="primary" onClick={() => set(autoDraft(l))}>
            Sim to your pick
          </MenuButton>
        )}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Prospect</th>
              <th>Pos</th>
              <th>Age</th>
              <th>OVR</th>
              <th>POT</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => (
              <tr key={p.id}>
                <td>{fullName(p)}</td>
                <td>{p.pos}</td>
                <td>{p.age}</td>
                <td>{p.ovr}</td>
                <td>
                  <b>{p.pot}</b>
                </td>
                <td>
                  <button disabled={!mine} onClick={() => set(userDraft(l, p.id))}>
                    Draft
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }
  const expiring = sortedRoster(l, l.userTeam).filter((p) => p.contract.years === 0);
  const fas = l.freeAgents.map((id) => l.players[id]).sort((a, b) => b.ovr - a.ovr);
  const offer = (p: OPlayer, mult: number, years: number) => {
    const salary = Math.max(MIN_SALARY, Math.round(askingSalary(p) * mult * 10) / 10);
    const r = signPlayer(l, p.id, salary, years);
    setMsg(r.msg);
    if (r.ok) set(r.league);
  };
  const offerCell = (p: OPlayer) => {
    const can = canSign(l, askingSalary(p), p.id);
    return (
      <span className={styles.offer}>
        {l.phase !== "freeagency" && p.teamId === l.userTeam ? (
          <em className={styles.small}>Re-sign in the offseason</em>
        ) : (
          <>
            <button onClick={() => offer(p, 0.9, 2)}>Lowball</button>
            <button onClick={() => offer(p, 1, 3)} disabled={!can.ok && askingSalary(p) > MIN_SALARY}>
              Ask · 3 yrs
            </button>
            <button onClick={() => offer(p, 1.15, 4)} disabled={!can.ok && askingSalary(p) > MIN_SALARY}>
              Max effort · 4 yrs
            </button>
            {!can.ok && <button onClick={() => offer(p, MIN_SALARY / askingSalary(p), 1)}>Minimum</button>}
          </>
        )}
      </span>
    );
  };
  return (
    <section className={styles.col}>
      {msg && <p className={styles.toast}>{msg}</p>}
      {l.phase === "freeagency" && expiring.length > 0 && (
        <article className={styles.card}>
          <h2>Your expiring contracts</h2>
          <table className={styles.table}>
            <tbody>
              {expiring.map((p) => (
                <tr key={p.id}>
                  <td>{fullName(p)}</td>
                  <td>{p.pos}</td>
                  <td>{p.age}</td>
                  <td>
                    <b>{p.ovr}</b>/{p.pot}
                  </td>
                  <td>asks {money(askingSalary(p))}</td>
                  <td>{offerCell(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
      <article className={styles.card}>
        <h2>
          Free agents · {money(Math.max(0, CAP - payroll(l, l.userTeam)))} cap space ·{" "}
          {l.phase === "freeagency" ? "offseason market" : "in-season (minimums and cap space only)"}
        </h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th>Age</th>
              <th>OVR/POT</th>
              <th>Asking</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fas.slice(0, 40).map((p) => (
              <tr key={p.id}>
                <td>{fullName(p)}</td>
                <td>{p.pos}</td>
                <td>{p.age}</td>
                <td>
                  <b>{p.ovr}</b>/{p.pot}
                </td>
                <td>{money(askingSalary(p))}</td>
                <td>{offerCell(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

/* ---------------------------------------------------------------- league */

function LeagueTab({ l }: { l: League }) {
  const table = standings(l);
  const leaders = Object.values(l.players)
    .filter((p) => p.teamId && p.stats.gp >= 3)
    .sort((a, b) => perGame(b, "pts") - perGame(a, "pts"))
    .slice(0, 10);
  return (
    <section className={styles.grid2}>
      <article className={styles.card}>
        <h2>Standings</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>Diff</th>
              <th>OVR</th>
            </tr>
          </thead>
          <tbody>
            {table.map((t, i) => (
              <tr key={t.id} data-me={t.id === l.userTeam} data-cut={i === PLAYOFF_TEAMS - 1}>
                <td>{i + 1}</td>
                <td>
                  <span className={styles.dot} style={{ background: t.primary }} /> {t.city} {t.name}
                </td>
                <td>{t.w}</td>
                <td>{t.l}</td>
                <td>{t.pf - t.pa}</td>
                <td>{Math.round(strength(l, t.id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {l.playoff && (
          <>
            <h3>{ROUND_NAMES[l.playoff.round]}</h3>
            {l.playoff.series.map((s) => (
              <p key={s.a + s.b}>
                {l.teams[s.a].name} {s.wa} – {s.wb} {l.teams[s.b].name}
              </p>
            ))}
          </>
        )}
      </article>
      <article className={styles.card}>
        <h2>Scoring leaders</h2>
        <table className={styles.table}>
          <tbody>
            {leaders.map((p, i) => (
              <tr key={p.id} data-me={p.teamId === l.userTeam}>
                <td>{i + 1}</td>
                <td>
                  {fullName(p)} <span className={styles.small}>{l.teams[p.teamId!].abbr}</span>
                </td>
                <td>
                  <b>{perGame(p, "pts")}</b> ppg
                </td>
                <td>{perGame(p, "reb")} rpg</td>
                <td>{perGame(p, "ast")} apg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

/* ---------------------------------------------------------------- business */

function Business({ l, set }: { l: League; set(l: League): void }) {
  const me = l.teams[l.userTeam];
  const pay = payroll(l, me.id);
  const offseason = l.phase === "freeagency" || l.phase === "draft";
  return (
    <section className={styles.grid2}>
      <article className={styles.card}>
        <h2>Tickets</h2>
        <p className={styles.big}>${me.ticket}</p>
        <input
          type="range"
          min={20}
          max={300}
          value={me.ticket}
          onChange={(e) => set(setTicketPrice(l, Number(e.target.value)))}
          aria-label="Ticket price"
        />
        <p className={styles.small}>
          Expected crowd: {estimatedAttendance(me).toLocaleString()} / 18,500. Higher prices earn more per seat until
          fans stop coming. Winning raises what they'll pay.
        </p>
      </article>
      <article className={styles.card}>
        <h2>Books · Season {l.season}</h2>
        <p>
          Revenue <b className={styles.pos}>{money(me.revenue)}</b> · Expenses{" "}
          <b className={styles.neg}>{money(me.expenses)}</b>
        </p>
        <p>
          Payroll {money(pay)} · Cap {money(CAP)} · Tax line {money(TAX_LINE)}
          {pay > TAX_LINE && <b className={styles.neg}> · paying {money((pay - TAX_LINE) * 1.5)} luxury tax</b>}
        </p>
        <p>
          Cash on hand <b>{money(me.cash)}</b>
        </p>
      </article>
      <article className={styles.card} data-wide>
        <h2>
          Head coach: {me.coach.name} ({me.coach.rating}) · {money(me.coach.salary)}/yr
        </h2>
        <p className={styles.small}>
          Better coaches win more games and develop young players faster.{" "}
          {offseason ? "" : "Coaching changes happen in the offseason."}
        </p>
        <div className={styles.row}>
          {coachCandidates(l).map((c) => (
            <button key={c.name} className={styles.coach} disabled={!offseason} onClick={() => set(hireCoach(l, c))}>
              <strong>{c.name}</strong>
              <span>
                {c.rating} rating · {money(c.salary)}/yr
              </span>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

/* ---------------------------------------------------------------- history */

function History({ l, reset }: { l: League; reset(): void }) {
  return (
    <section className={styles.card}>
      <h2>Franchise history</h2>
      {l.history.length === 0 ? (
        <p className={styles.small}>Finish a season to start writing history.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Season</th>
              <th>Record</th>
              <th>Result</th>
              <th>Champion</th>
              <th>MVP</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {l.history.map((h) => (
              <tr key={h.season}>
                <td>{h.season}</td>
                <td>{h.userRecord}</td>
                <td>{h.userResult}</td>
                <td>{l.teams[h.champion].name}</td>
                <td>{h.mvp}</td>
                <td className={h.profit >= 0 ? styles.pos : styles.neg}>{money(h.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className={styles.row}>
        <MenuButton onClick={reset}>Sell the team (new franchise)</MenuButton>
      </div>
    </section>
  );
}
