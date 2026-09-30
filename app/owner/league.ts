import { EBL_TEAMS, roundRobin } from "~/data/ebl";
import { getBaller } from "~/data/characters";

/**
 * EBL 2 Owner Mode: a MyNBA-style franchise simulation. Pure data + rules,
 * no React. Every mutating function takes a league and returns a new one.
 */

export type Pos = "PG" | "SG" | "SF" | "PF" | "C";
export const POSITIONS: Pos[] = ["PG", "SG", "SF", "PF", "C"];

export interface Contract {
  /** Millions per season */
  salary: number;
  /** Seasons remaining including this one */
  years: number;
}

export interface SeasonStats {
  gp: number;
  pts: number;
  reb: number;
  ast: number;
}

export interface OPlayer {
  id: number;
  first: string;
  last: string;
  pos: Pos;
  age: number;
  ovr: number;
  pot: number;
  contract: Contract;
  teamId: string | null;
  stats: SeasonStats;
  /** Games left injured */
  injury: number;
  /** Baller id when this player can be played in the 1-on-1 engine */
  baller?: string;
  /** Drafted this offseason (rookie scale) */
  draftYear?: number;
  /** Career awards, e.g. "MVP 3" */
  awards: string[];
}

export interface Coach {
  name: string;
  /** 40-99 */
  rating: number;
  salary: number;
}

export interface OTeam {
  id: string;
  city: string;
  name: string;
  abbr: string;
  primary: string;
  secondary: string;
  roster: number[];
  coach: Coach;
  /** Owner's cash on hand, millions */
  cash: number;
  /** Average ticket price, dollars */
  ticket: number;
  /** 0-100: how much the city cares */
  fans: number;
  w: number;
  l: number;
  pf: number;
  pa: number;
  /** Season revenue/expenses so far, millions */
  revenue: number;
  expenses: number;
}

export interface GameResult {
  week: number;
  home: string;
  away: string;
  hs: number;
  as: number;
  /** Top scorer line for the recap */
  star?: string;
  played?: boolean;
}

export interface Series {
  a: string;
  b: string;
  wa: number;
  wb: number;
}

export type Phase = "regular" | "playoffs" | "draft" | "freeagency";

export interface SeasonSummary {
  season: number;
  champion: string;
  mvp: string;
  userRecord: string;
  userResult: string;
  profit: number;
}

export interface League {
  version: 1;
  seed: number;
  season: number;
  week: number;
  phase: Phase;
  userTeam: string;
  teams: Record<string, OTeam>;
  players: Record<number, OPlayer>;
  nextId: number;
  schedule: [string, string][][];
  results: GameResult[];
  playoff: { round: number; series: Series[] } | null;
  draftClass: number[];
  draftOrder: string[];
  freeAgents: number[];
  news: string[];
  history: SeasonSummary[];
  /** Owner goals for this season */
  goals: { wins: number; profit: number };
}

export const CAP = 125;
export const TAX_LINE = 145;
export const ROSTER_MAX = 15;
export const ROSTER_MIN = 10;
export const MIN_SALARY = 1.1;
export const MAX_SALARY = 48;
export const WEEKS_BETWEEN = 2; // double round robin
export const PLAYOFF_TEAMS = 8;
const ARENA_CAPACITY = 18500;
const TV_PER_GAME = 3.4;

/* ------------------------------------------------------------ random */

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}
let R = rng(Date.now() & 0xffff);
const rand = (a = 0, b = 1) => a + R() * (b - a);
const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T>(xs: T[]) => xs[Math.floor(R() * xs.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

const FIRST = [
  "Jalen",
  "Marcus",
  "Tariq",
  "Devon",
  "Andre",
  "Malik",
  "Isaiah",
  "Cam",
  "Theo",
  "Rashad",
  "Luka",
  "Omar",
  "Bryce",
  "Xavier",
  "Nico",
  "Kofi",
  "Zion",
  "Elias",
  "Jaylen",
  "Reggie",
  "Darius",
  "Kellan",
  "Amari",
  "Tobias",
  "Quincy",
  "Dante",
  "Emeka",
  "Rico",
  "Sione",
  "Keon",
  "Jonah",
  "Mateo",
  "Hakeem",
  "Silas",
  "Idris",
  "Ronan",
  "Cyrus",
  "Deshawn",
];
const LAST = [
  "Holloway",
  "Okafor",
  "Brandt",
  "Castillo",
  "Whitaker",
  "Nakamura",
  "Mensah",
  "Delacroix",
  "Pryor",
  "Santos",
  "Abernathy",
  "Kovac",
  "Rhodes",
  "Figueroa",
  "Adebayo",
  "Lindqvist",
  "Merritt",
  "Oduya",
  "Tran",
  "Beaumont",
  "Achebe",
  "Valdez",
  "Sorensen",
  "Kimura",
  "Oyelaran",
  "Petrov",
  "Ruiz",
  "Blackwood",
  "Fairweather",
  "Nwosu",
  "Haddad",
  "Marchetti",
  "Kaplan",
  "Ellison",
  "Moreau",
  "Asante",
  "Takahashi",
  "Grant",
];
const COACH_NAMES = [
  "Dell Harlan",
  "Rita Voss",
  "Marcus Bell",
  "Ike Okafor",
  "Sam Whitlock",
  "Nadia Cruz",
  "Buck Tanner",
  "Leon Park",
  "Gloria Mendez",
  "Hank Pruitt",
  "Yuri Belov",
  "Tess Calloway",
  "Ray Okoye",
  "Ben Stroud",
  "Ava Lindgren",
];

/* ------------------------------------------------------------ money */

/** What a player expects to earn per season (millions) */
export function askingSalary(p: OPlayer): number {
  const v = p.ovr + Math.max(0, p.pot - p.ovr) * (p.age < 25 ? 0.35 : 0) - Math.max(0, p.age - 31) * 1.5;
  const m = v < 60 ? MIN_SALARY : v < 70 ? 1.1 + (v - 60) * 0.9 : v < 80 ? 10 + (v - 70) * 1.6 : 26 + (v - 80) * 2.4;
  return round1(clamp(m, MIN_SALARY, MAX_SALARY));
}

export function payroll(l: League, teamId: string) {
  return round1(l.teams[teamId].roster.reduce((s, id) => s + l.players[id].contract.salary, 0));
}

/** Trade value (how much an AI GM wants him) */
export function tradeValue(p: OPlayer): number {
  const talent = Math.pow(Math.max(0, p.ovr - 55), 1.7);
  const upside = p.age < 25 ? Math.pow(Math.max(0, p.pot - p.ovr), 1.3) * 1.2 : 0;
  const agePenalty = Math.max(0, p.age - 30) * 6;
  const contract = (askingSalary(p) - p.contract.salary) * 1.2 * Math.min(3, p.contract.years);
  return Math.max(1, talent + upside - agePenalty + contract);
}

/* ------------------------------------------------------------ creation */

function makePlayer(l: League, pos: Pos, ovr: number, age: number, teamId: string | null): OPlayer {
  const pot = clamp(Math.round(ovr + (age < 25 ? rand(3, 16) * ((25 - age) / 6) : rand(0, 2))), ovr, 99);
  const p: OPlayer = {
    id: l.nextId++,
    first: pick(FIRST),
    last: pick(LAST),
    pos,
    age,
    ovr: Math.round(ovr),
    pot,
    contract: { salary: 0, years: 0 },
    teamId,
    stats: { gp: 0, pts: 0, reb: 0, ast: 0 },
    injury: 0,
    awards: [],
  };
  p.contract = { salary: round1(askingSalary(p) * rand(0.85, 1.1)), years: randi(1, 4) };
  l.players[p.id] = p;
  return p;
}

function makeCoach(): Coach {
  const rating = randi(55, 88);
  return { name: pick(COACH_NAMES), rating, salary: round1(2 + (rating - 55) * 0.2) };
}

/** A fresh 12-team league seeded from the EBL franchises */
export function newLeague(userTeam: string, seed = Math.floor(Math.random() * 1e9)): League {
  R = rng(seed);
  const l: League = {
    version: 1,
    seed,
    season: 1,
    week: 0,
    phase: "regular",
    userTeam,
    teams: {},
    players: {},
    nextId: 1,
    schedule: [],
    results: [],
    playoff: null,
    draftClass: [],
    draftOrder: [],
    freeAgents: [],
    news: [],
    history: [],
    goals: { wins: 12, profit: 0 },
  };
  for (const t of EBL_TEAMS) {
    const team: OTeam = {
      id: t.id,
      city: t.city,
      name: t.name,
      abbr: t.abbr,
      primary: t.primary,
      secondary: t.secondary,
      roster: [],
      coach: makeCoach(),
      cash: 60,
      ticket: 85,
      fans: clamp(Math.round(t.rating - 10 + rand(-5, 5)), 30, 90),
      w: 0,
      l: 0,
      pf: 0,
      pa: 0,
      revenue: 0,
      expenses: 0,
    };
    l.teams[t.id] = team;
    // The franchise star is the EBL 1 star, playable in the 1-on-1 engine
    const starBaller = getBaller(t.starId);
    // EBL 1 ratings span 58-92; squeeze them so every team can compete
    const eff = 72 + (t.rating - 75) * 0.3;
    const star = makePlayer(l, pick(["PG", "SG", "SF"]), clamp(eff + 9 + rand(-2, 2), 76, 93), randi(23, 30), t.id);
    const [first, ...rest] = starBaller.name.split(" ");
    star.first = first;
    star.last = rest.join(" ") || starBaller.nickname;
    star.baller = starBaller.id;
    team.roster.push(star.id);
    const base = eff + 2;
    const positions: Pos[] = ["PG", "SG", "SF", "PF", "C", "PG", "SG", "SF", "PF", "C", "SF", "PF"];
    positions.forEach((pos, i) => {
      const ovr = clamp(base - i * 1.5 + rand(-3, 3), 55, 86);
      team.roster.push(makePlayer(l, pos, ovr, randi(20, 33), t.id).id);
    });
    // Starting payrolls land between 85M and 140M: some bargains, some bad deals
    const target = clamp(100 + (t.rating - 75) * 1.6 + rand(-8, 8), 85, 140);
    const k = target / payroll(l, t.id);
    for (const pid of team.roster)
      l.players[pid].contract.salary = round1(clamp(l.players[pid].contract.salary * k, MIN_SALARY, MAX_SALARY));
  }
  // Free-agent pool
  for (let i = 0; i < 24; i++) {
    const p = makePlayer(l, pick(POSITIONS), rand(55, 72), randi(22, 34), null);
    p.contract = { salary: askingSalary(p), years: 0 };
    l.freeAgents.push(p.id);
  }
  startSeason(l);
  l.news.unshift(`Welcome to the front office. You now own the ${l.teams[userTeam].city} ${l.teams[userTeam].name}.`);
  return l;
}

function startSeason(l: League) {
  const ids = Object.keys(l.teams);
  const rr = roundRobin(ids);
  // Double round robin: second half flips home and away
  l.schedule = [...rr, ...rr.map((wk) => wk.map(([a, b]) => [b, a] as [string, string]))];
  l.week = 0;
  l.phase = "regular";
  l.results = [];
  l.playoff = null;
  for (const t of Object.values(l.teams)) {
    t.w = t.l = t.pf = t.pa = 0;
    t.revenue = t.expenses = 0;
  }
  for (const p of Object.values(l.players)) p.stats = { gp: 0, pts: 0, reb: 0, ast: 0 };
  const u = l.teams[l.userTeam];
  const s = strength(l, u.id);
  l.goals = { wins: clamp(Math.round((s - 60) / 1.4), 6, 18), profit: 0 };
}

/* ------------------------------------------------------------ sim */

export function sortedRoster(l: League, teamId: string) {
  return l.teams[teamId].roster.map((id) => l.players[id]).sort((a, b) => b.ovr - a.ovr);
}

/** Team strength: weighted top-8 healthy players + coaching */
export function strength(l: League, teamId: string) {
  const healthy = sortedRoster(l, teamId).filter((p) => p.injury <= 0);
  const w = [1, 0.95, 0.85, 0.75, 0.62, 0.45, 0.32, 0.22];
  let sum = 0;
  let wsum = 0;
  w.forEach((k, i) => {
    const p = healthy[i];
    sum += (p ? p.ovr : 45) * k;
    wsum += k;
  });
  const coach = (l.teams[teamId].coach.rating - 70) * 0.08;
  return sum / wsum + coach;
}

function boxScore(l: League, teamId: string, points: number) {
  const players = sortedRoster(l, teamId)
    .filter((p) => p.injury <= 0)
    .slice(0, 9);
  const weights = players.map((p) => Math.pow(p.ovr / 60, 4) * rand(0.6, 1.4));
  const total = weights.reduce((a, b) => a + b, 0);
  let top = { name: "", pts: 0 };
  players.forEach((p, i) => {
    const pts = Math.round((points * weights[i]) / total);
    const big = p.pos === "C" || p.pos === "PF";
    const reb = Math.round(rand(1, big ? 11 : 6) * (p.ovr / 75));
    const ast = Math.round(rand(0, p.pos === "PG" ? 10 : 4) * (p.ovr / 75));
    p.stats.gp++;
    p.stats.pts += pts;
    p.stats.reb += reb;
    p.stats.ast += ast;
    if (pts > top.pts) top = { name: `${p.first} ${p.last}`, pts };
    // Occasional injuries
    if (R() < 0.006) {
      p.injury = randi(1, 6);
      if (teamId === l.userTeam)
        l.news.unshift(`${p.first} ${p.last} is out ${p.injury} game${p.injury > 1 ? "s" : ""} with an injury.`);
    }
  });
  return top;
}

function gameFinances(l: League, home: string) {
  const t = l.teams[home];
  // Demand falls off as price rises above what fans will pay
  const willing = 55 + t.fans * 0.9;
  const demand = clamp(t.fans / 100 + 0.35 - Math.max(0, t.ticket - willing) / 120, 0.2, 1);
  const attendance = Math.round(ARENA_CAPACITY * demand);
  const gate = (attendance * t.ticket) / 1e6;
  // Local sponsors and merch scale with how much the city cares
  const local = 0.6 + (t.fans / 100) * 2.2;
  t.revenue += gate + local;
  t.cash += gate + local;
  return attendance;
}

/** League-wide national TV deal, paid to both teams every game */
function tvMoney(l: League, ...teams: string[]) {
  for (const id of teams) {
    l.teams[id].revenue += TV_PER_GAME;
    l.teams[id].cash += TV_PER_GAME;
  }
}

function perGameExpenses(l: League, teamId: string) {
  const games = l.schedule.length;
  const pay = payroll(l, teamId);
  const tax = Math.max(0, pay - TAX_LINE) * 1.5;
  const cost = (pay + tax + l.teams[teamId].coach.salary + 6) / games;
  l.teams[teamId].expenses += cost;
  l.teams[teamId].cash -= cost;
}

/** Score a game between two teams (neutral sim) */
export function simScore(l: League, home: string, away: string): [number, number] {
  const edge = strength(l, home) + 1.5 - strength(l, away);
  const pace = rand(92, 108);
  let hs = Math.round(pace + edge * 0.8 + rand(-12, 12));
  let as = Math.round(pace - edge * 0.8 + rand(-12, 12));
  if (hs === as) R() < 0.5 + edge / 30 ? (hs += randi(1, 6)) : (as += randi(1, 6));
  return [hs, as];
}

function recordGame(l: League, g: GameResult) {
  const h = l.teams[g.home];
  const a = l.teams[g.away];
  const homeWon = g.hs > g.as;
  h.pf += g.hs;
  h.pa += g.as;
  a.pf += g.as;
  a.pa += g.hs;
  if (homeWon) {
    h.w++;
    a.l++;
  } else {
    a.w++;
    h.l++;
  }
  // Winning grows the fan base, losing shrinks it
  for (const [t, won] of [
    [h, homeWon],
    [a, !homeWon],
  ] as const)
    t.fans = clamp(t.fans + (won ? 0.6 : -0.4), 10, 100);
  l.results.push(g);
}

function tickInjuries(l: League, teams: string[]) {
  for (const id of teams) for (const pid of l.teams[id].roster) if (l.players[pid].injury > 0) l.players[pid].injury--;
}

/** The user's game this week (null during playoffs or off weeks) */
export function userGame(l: League): [string, string] | null {
  if (l.phase !== "regular" || l.week >= l.schedule.length) return null;
  return l.schedule[l.week].find((g) => g.includes(l.userTeam)) ?? null;
}

/**
 * Advance one week of the regular season. If `played` is given, the user's
 * game uses that score (from playing it in the 1-on-1 engine).
 */
export function simWeek(prev: League, played?: [number, number]): League {
  const l = structuredClone(prev);
  if (l.phase !== "regular") return l;
  const games = l.schedule[l.week];
  for (const [home, away] of games) {
    const mine = home === l.userTeam || away === l.userTeam;
    const [hs, as] = mine && played ? played : simScore(l, home, away);
    gameFinances(l, home);
    tvMoney(l, home, away);
    const topH = boxScore(l, home, hs);
    const topA = boxScore(l, away, as);
    const star = hs > as ? topH : topA;
    recordGame(l, { week: l.week, home, away, hs, as, star: `${star.name} ${star.pts}`, played: mine && !!played });
    if (mine) {
      const won = (home === l.userTeam && hs > as) || (away === l.userTeam && as > hs);
      const opp = l.teams[home === l.userTeam ? away : home];
      l.news.unshift(
        `${won ? "W" : "L"} ${Math.max(hs, as)}-${Math.min(hs, as)} ${home === l.userTeam ? "vs" : "@"} ${opp.city} ${opp.name} · ${star.name} ${star.pts} pts`,
      );
    }
    tickInjuries(l, [home, away]);
  }
  for (const id of Object.keys(l.teams)) perGameExpenses(l, id);
  l.week++;
  aiMidseasonMoves(l);
  if (l.week >= l.schedule.length) startPlayoffs(l);
  l.news = l.news.slice(0, 40);
  return l;
}

export function simWeeks(l: League, n: number) {
  let out = l;
  for (let i = 0; i < n && out.phase === "regular"; i++) out = simWeek(out);
  return out;
}

export function standings(l: League) {
  return Object.values(l.teams).sort((a, b) => b.w - a.w || b.pf - b.pa - (a.pf - a.pa));
}

function startPlayoffs(l: League) {
  const seeds = standings(l)
    .slice(0, PLAYOFF_TEAMS)
    .map((t) => t.id);
  l.phase = "playoffs";
  l.playoff = {
    round: 0,
    series: [0, 1, 2, 3].map((i) => ({ a: seeds[i], b: seeds[PLAYOFF_TEAMS - 1 - i], wa: 0, wb: 0 })),
  };
  const rank = seeds.indexOf(l.userTeam);
  l.news.unshift(
    rank >= 0
      ? `Playoffs! You're the #${rank + 1} seed. Best-of-five series.`
      : "The season is over. You missed the playoffs.",
  );
}

export const ROUND_NAMES = ["First Round", "Semifinals", "EBL Finals"];
const WINS_NEEDED = 3;

/** The user's playoff opponent this game day, if still alive */
export function userSeries(l: League): Series | null {
  return (
    l.playoff?.series.find(
      (s) => (s.a === l.userTeam || s.b === l.userTeam) && s.wa < WINS_NEEDED && s.wb < WINS_NEEDED,
    ) ?? null
  );
}

/** Play one game in every open series */
export function simPlayoffDay(prev: League, played?: [number, number]): League {
  const l = structuredClone(prev);
  if (!l.playoff) return l;
  for (const s of l.playoff.series) {
    if (s.wa >= WINS_NEEDED || s.wb >= WINS_NEEDED) continue;
    const gameNo = s.wa + s.wb;
    const aHome = gameNo % 2 === 0 || gameNo === 4;
    const [home, away] = aHome ? [s.a, s.b] : [s.b, s.a];
    const mine = home === l.userTeam || away === l.userTeam;
    const [hs, as] = mine && played ? played : simScore(l, home, away);
    gameFinances(l, home);
    // Playoff gates are bigger
    l.teams[home].revenue += 2;
    l.teams[home].cash += 2;
    const aWon = (home === s.a && hs > as) || (away === s.a && as > hs);
    if (aWon) s.wa++;
    else s.wb++;
    if (mine) {
      const won = (s.a === l.userTeam) === aWon;
      const opp = l.teams[s.a === l.userTeam ? s.b : s.a];
      const [my, their] = s.a === l.userTeam ? [s.wa, s.wb] : [s.wb, s.wa];
      l.news.unshift(
        `${ROUND_NAMES[l.playoff.round]} vs ${opp.name}: ${won ? "W" : "L"} ${Math.max(hs, as)}-${Math.min(hs, as)} (series ${my}-${their})`,
      );
    }
  }
  const done = l.playoff.series.every((s) => s.wa >= WINS_NEEDED || s.wb >= WINS_NEEDED);
  if (done) {
    const winners = l.playoff.series.map((s) => (s.wa >= WINS_NEEDED ? s.a : s.b));
    if (winners.length === 1) {
      finishSeason(l, winners[0]);
    } else {
      l.playoff.round++;
      l.playoff.series = [];
      for (let i = 0; i < winners.length / 2; i++)
        l.playoff.series.push({ a: winners[i], b: winners[winners.length - 1 - i], wa: 0, wb: 0 });
    }
  }
  return l;
}

/** Sim the rest of the playoffs */
export function simPlayoffs(l: League) {
  let out = l;
  while (out.phase === "playoffs") out = simPlayoffDay(out);
  return out;
}

/* ------------------------------------------------------------ offseason */

function finishSeason(l: League, champion: string) {
  const u = l.teams[l.userTeam];
  const champ = l.teams[champion];
  // MVP: production on a winning team
  const mvp = Object.values(l.players)
    .filter((p) => p.teamId && p.stats.gp > 0)
    .sort((a, b) => {
      const score = (p: OPlayer) =>
        p.stats.pts / p.stats.gp + p.stats.ast / p.stats.gp + p.stats.reb / p.stats.gp / 2 + l.teams[p.teamId!].w * 0.8;
      return score(b) - score(a);
    })[0];
  mvp?.awards.push(`MVP ${l.season}`);
  for (const pid of champ.roster) l.players[pid].awards.push(`Champion ${l.season}`);
  const userResult =
    champion === l.userTeam
      ? "🏆 Champions"
      : l.playoff?.series.some((s) => s.a === l.userTeam || s.b === l.userTeam)
        ? "Lost in the Finals"
        : standings(l).findIndex((t) => t.id === l.userTeam) < PLAYOFF_TEAMS
          ? "Playoffs"
          : "Missed playoffs";
  l.history.push({
    season: l.season,
    champion,
    mvp: mvp ? `${mvp.first} ${mvp.last} (${l.teams[mvp.teamId!].abbr})` : "—",
    userRecord: `${u.w}-${u.l}`,
    userResult,
    profit: round1(u.revenue - u.expenses),
  });
  if (champion === l.userTeam) u.fans = clamp(u.fans + 12, 0, 100);
  l.news.unshift(`🏆 The ${champ.city} ${champ.name} win the EBL title! MVP: ${l.history[l.history.length - 1].mvp}.`);
  // Draft order: worst record picks first, champion last
  l.draftOrder = standings(l)
    .map((t) => t.id)
    .reverse();
  l.draftOrder = [...l.draftOrder.filter((id) => id !== champion), champion];
  l.draftOrder = [...l.draftOrder, ...l.draftOrder]; // two rounds
  l.draftClass = [];
  for (let i = 0; i < 30; i++) {
    const age = randi(19, 22);
    const p = makePlayer(l, pick(POSITIONS), clamp(rand(55, 74) - (i > 12 ? 4 : 0), 50, 78), age, null);
    p.pot = clamp(Math.round(p.ovr + rand(6, 24)), p.ovr, 97);
    l.draftClass.push(p.id);
  }
  l.draftClass.sort((a, b) => l.players[b].pot + l.players[b].ovr - (l.players[a].pot + l.players[a].ovr));
  l.phase = "draft";
}

/** Whose pick is it, and which overall pick */
export function onTheClock(l: League) {
  return l.draftOrder.length
    ? { team: l.draftOrder[0], pick: 2 * Object.keys(l.teams).length - l.draftOrder.length + 1 }
    : null;
}

function rookieContract(p: OPlayer, pickNo: number) {
  p.contract = { salary: round1(clamp(9 - pickNo * 0.35, MIN_SALARY, 9)), years: pickNo <= 12 ? 4 : 2 };
}

function makePick(l: League, pid: number) {
  const clock = onTheClock(l)!;
  const p = l.players[pid];
  p.teamId = clock.team;
  p.draftYear = l.season;
  rookieContract(p, clock.pick);
  l.teams[clock.team].roster.push(pid);
  l.draftClass = l.draftClass.filter((x) => x !== pid);
  l.draftOrder.shift();
  const t = l.teams[clock.team];
  if (clock.pick <= 5 || clock.team === l.userTeam)
    l.news.unshift(`Pick ${clock.pick}: ${t.abbr} select ${p.first} ${p.last} (${p.pos}, ${p.ovr} OVR / ${p.pot} POT)`);
}

/** CPU teams pick until it's the user's turn (or the draft ends) */
export function autoDraft(prev: League, includeUser = false): League {
  const l = structuredClone(prev);
  while (l.draftOrder.length && (includeUser || l.draftOrder[0] !== l.userTeam)) {
    // Best available by a blend of now and later
    const best = [...l.draftClass].sort((a, b) => {
      const v = (id: number) => l.players[id].ovr * 0.6 + l.players[id].pot * 0.4 + rand(-3, 3);
      return v(b) - v(a);
    })[0];
    makePick(l, best);
  }
  if (!l.draftOrder.length) beginFreeAgency(l);
  return l;
}

export function userDraft(prev: League, pid: number): League {
  const l = structuredClone(prev);
  if (onTheClock(l)?.team !== l.userTeam) return l;
  makePick(l, pid);
  return autoDraft(l);
}

function beginFreeAgency(l: League) {
  // Undrafted rookies join the pool
  for (const id of l.draftClass) {
    const p = l.players[id];
    p.contract = { salary: MIN_SALARY, years: 0 };
    l.freeAgents.push(id);
  }
  l.draftClass = [];
  // Progression, aging, retirements, expiring deals
  for (const p of Object.values(l.players)) {
    p.age++;
    const grow =
      p.age <= 24
        ? rand(1, 5) * ((p.pot - p.ovr) / 12 + 0.4)
        : p.age <= 29
          ? rand(-1, 2)
          : p.age <= 32
            ? rand(-3, 0.5)
            : rand(-6, -1);
    // Good coaching helps young players develop
    const coachBoost = p.teamId && p.age <= 26 ? (l.teams[p.teamId].coach.rating - 70) / 40 : 0;
    p.ovr = clamp(Math.round(p.ovr + grow + coachBoost), 40, Math.max(p.pot, p.ovr));
    if (p.age > 27) p.pot = Math.max(p.ovr, p.pot - 1);
    p.injury = 0;
  }
  for (const p of Object.values(l.players)) {
    const retire = p.age >= 36 || (p.age >= 33 && p.ovr < 62 && R() < 0.5);
    if (retire && !p.baller) {
      if (p.teamId) l.teams[p.teamId].roster = l.teams[p.teamId].roster.filter((x) => x !== p.id);
      l.freeAgents = l.freeAgents.filter((x) => x !== p.id);
      if (p.teamId === l.userTeam || p.ovr >= 80) l.news.unshift(`${p.first} ${p.last} retires at ${p.age}.`);
      delete l.players[p.id];
      continue;
    }
    if (p.teamId && p.contract.years > 0) p.contract.years--;
  }
  // Expiring contracts: CPU teams keep most of their good players
  for (const t of Object.values(l.teams)) {
    for (const pid of [...t.roster]) {
      const p = l.players[pid];
      if (p.contract.years > 0) continue;
      if (t.id !== l.userTeam && p.ovr >= 68 && R() < 0.7 && payroll(l, t.id) + askingSalary(p) < TAX_LINE) {
        p.contract = { salary: askingSalary(p), years: randi(1, 4) };
      } else if (t.id !== l.userTeam) {
        release(l, pid, false);
      }
    }
  }
  l.phase = "freeagency";
  const expiring = l.teams[l.userTeam].roster.filter((id) => l.players[id].contract.years === 0).length;
  l.news.unshift(
    `Free agency is open.${expiring ? ` ${expiring} of your players have expiring deals: re-sign them or let them walk.` : ""}`,
  );
}

function release(l: League, pid: number, news = true) {
  const p = l.players[pid];
  if (!p.teamId) return;
  const t = l.teams[p.teamId];
  t.roster = t.roster.filter((x) => x !== pid);
  p.teamId = null;
  p.contract = { salary: askingSalary(p), years: 0 };
  l.freeAgents.push(pid);
  if (news) l.news.unshift(`${t.abbr} released ${p.first} ${p.last}.`);
}

export function releasePlayer(prev: League, pid: number): League {
  const l = structuredClone(prev);
  const p = l.players[pid];
  if (p.teamId !== l.userTeam) return l;
  // Dead money: the rest of this season's salary still counts against cash
  l.teams[l.userTeam].cash -= p.contract.years > 0 ? p.contract.salary * 0.5 : 0;
  release(l, pid);
  return l;
}

/** Can the user afford this signing under the cap rules? */
export function canSign(l: League, salary: number, pid?: number) {
  const t = l.teams[l.userTeam];
  if (t.roster.length >= ROSTER_MAX && !(pid && t.roster.includes(pid)))
    return { ok: false, why: "Roster is full (15)." };
  const pay = payroll(l, l.userTeam) - (pid && t.roster.includes(pid) ? l.players[pid].contract.salary : 0);
  // Re-signing your own players is always allowed (Bird rights); outside signings need space or a minimum deal
  if (pid && t.roster.includes(pid)) return { ok: true, why: "" };
  if (salary <= MIN_SALARY + 0.01) return { ok: true, why: "" };
  if (pay + salary > CAP)
    return { ok: false, why: `Over the cap: only minimum deals (payroll ${round1(pay)}M / cap ${CAP}M).` };
  return { ok: true, why: "" };
}

/** Will the player accept? More years + more money + a winning team help. */
export function willAccept(l: League, pid: number, salary: number, years: number) {
  const p = l.players[pid];
  const ask = askingSalary(p);
  const t = l.teams[l.userTeam];
  const winning = (t.w - t.l) / 10 + (t.fans - 50) / 100;
  const loyalty = p.teamId === l.userTeam ? 0.06 : 0;
  const yearsPref = p.age >= 30 ? (years - 1) * 0.03 : (years - 2) * 0.01;
  return salary / ask + winning * 0.05 + loyalty + yearsPref >= 0.97;
}

export function signPlayer(
  prev: League,
  pid: number,
  salary: number,
  years: number,
): { league: League; ok: boolean; msg: string } {
  const l = structuredClone(prev);
  const p = l.players[pid];
  const can = canSign(l, salary, pid);
  if (!can.ok) return { league: prev, ok: false, msg: can.why };
  if (!willAccept(l, pid, salary, years))
    return {
      league: prev,
      ok: false,
      msg: `${p.first} ${p.last} turned it down. He's asking about ₿${askingSalary(p)}M.`,
    };
  const t = l.teams[l.userTeam];
  p.contract = { salary: round1(salary), years };
  if (p.teamId !== l.userTeam) {
    l.freeAgents = l.freeAgents.filter((x) => x !== pid);
    p.teamId = l.userTeam;
    t.roster.push(pid);
  }
  l.news.unshift(`Signed ${p.first} ${p.last}: ${years} yr / $${round1(salary)}M per year.`);
  return { league: l, ok: true, msg: "Signed!" };
}

/** CPU teams fill their rosters, then the new season tips off */
export function finishFreeAgency(prev: League): League {
  const l = structuredClone(prev);
  // The user's unsigned players walk
  for (const pid of [...l.teams[l.userTeam].roster]) if (l.players[pid].contract.years === 0) release(l, pid);
  const pool = () => l.freeAgents.map((id) => l.players[id]).sort((a, b) => b.ovr - a.ovr);
  for (let pass = 0; pass < 3; pass++) {
    for (const t of Object.values(l.teams)) {
      if (t.id === l.userTeam) continue;
      if (t.roster.length >= 13) continue;
      const room = CAP - payroll(l, t.id);
      const target = pool().find((p) => askingSalary(p) <= Math.max(MIN_SALARY, room)) ?? pool()[pool().length - 1];
      if (!target) continue;
      target.contract = {
        salary: askingSalary(target) <= room ? askingSalary(target) : MIN_SALARY,
        years: randi(1, 3),
      };
      target.teamId = t.id;
      t.roster.push(target.id);
      l.freeAgents = l.freeAgents.filter((x) => x !== target.id);
      if (target.ovr >= 76) l.news.unshift(`${t.abbr} sign ${target.first} ${target.last} (${target.ovr} OVR).`);
    }
  }
  // Minimum roster for the user: auto-sign cheapest bodies if short
  while (l.teams[l.userTeam].roster.length < ROSTER_MIN && l.freeAgents.length) {
    const p = pool().reverse()[0];
    p.contract = { salary: MIN_SALARY, years: 1 };
    p.teamId = l.userTeam;
    l.teams[l.userTeam].roster.push(p.id);
    l.freeAgents = l.freeAgents.filter((x) => x !== p.id);
    l.news.unshift(`League rule: signed ${p.first} ${p.last} to reach the ${ROSTER_MIN}-man minimum.`);
  }
  // Refill the pool with journeymen so it never runs dry
  while (l.freeAgents.length < 20) {
    const p = makePlayer(l, pick(POSITIONS), rand(54, 68), randi(24, 33), null);
    p.contract = { salary: askingSalary(p), years: 0 };
    l.freeAgents.push(p.id);
  }
  l.season++;
  startSeason(l);
  l.news.unshift(`Season ${l.season} tips off. Owner goal: ${l.goals.wins}+ wins and stay profitable.`);
  return l;
}

/* ------------------------------------------------------------ trades */

export interface TradeEval {
  ok: boolean;
  msg: string;
  give: number;
  get: number;
}

export function evaluateTrade(l: League, partner: string, giving: number[], getting: number[]): TradeEval {
  const give = giving.reduce((s, id) => s + tradeValue(l.players[id]), 0);
  const get = getting.reduce((s, id) => s + tradeValue(l.players[id]), 0);
  if (!giving.length || !getting.length) return { ok: false, msg: "Pick players on both sides.", give, get };
  const inSal = getting.reduce((s, id) => s + l.players[id].contract.salary, 0);
  const outSal = giving.reduce((s, id) => s + l.players[id].contract.salary, 0);
  const userPay = payroll(l, l.userTeam) - outSal + inSal;
  const theirPay = payroll(l, partner) - inSal + outSal;
  // Salary matching once over the cap: incoming within 125% + 1M
  if (userPay > CAP && inSal > outSal * 1.25 + 1)
    return { ok: false, msg: "Salaries don't match (you're over the cap).", give, get };
  if (theirPay > CAP && outSal > inSal * 1.25 + 1)
    return { ok: false, msg: "They can't take on that much salary.", give, get };
  const uSize = l.teams[l.userTeam].roster.length - giving.length + getting.length;
  const tSize = l.teams[partner].roster.length - getting.length + giving.length;
  if (uSize > ROSTER_MAX || tSize > ROSTER_MAX)
    return { ok: false, msg: "That would put a roster over 15.", give, get };
  if (uSize < ROSTER_MIN - 2 || tSize < ROSTER_MIN - 2)
    return { ok: false, msg: "That would leave a roster too thin.", give, get };
  // AI wants to win the trade by a little
  if (give < get * 1.08) return { ok: false, msg: "They want more value coming back.", give, get };
  return { ok: true, msg: "They'd accept this.", give, get };
}

export function executeTrade(prev: League, partner: string, giving: number[], getting: number[]): League {
  const l = structuredClone(prev);
  const u = l.teams[l.userTeam];
  const t = l.teams[partner];
  for (const id of giving) {
    u.roster = u.roster.filter((x) => x !== id);
    t.roster.push(id);
    l.players[id].teamId = partner;
  }
  for (const id of getting) {
    t.roster = t.roster.filter((x) => x !== id);
    u.roster.push(id);
    l.players[id].teamId = l.userTeam;
  }
  const names = (ids: number[]) => ids.map((id) => `${l.players[id].first} ${l.players[id].last}`).join(", ");
  l.news.unshift(`TRADE with ${t.abbr}: you get ${names(getting)} for ${names(giving)}.`);
  return l;
}

/** CPU teams occasionally swap players with each other */
function aiMidseasonMoves(l: League) {
  if (R() > 0.15) return;
  const ids = Object.keys(l.teams).filter((id) => id !== l.userTeam);
  const a = pick(ids);
  const b = pick(ids.filter((x) => x !== a));
  const pa = pick(l.teams[a].roster.slice(2));
  const pb = pick(l.teams[b].roster.slice(2));
  if (!pa || !pb) return;
  const va = tradeValue(l.players[pa]);
  const vb = tradeValue(l.players[pb]);
  if (Math.abs(va - vb) / Math.max(va, vb) > 0.2) return;
  l.teams[a].roster = l.teams[a].roster.filter((x) => x !== pa).concat(pb);
  l.teams[b].roster = l.teams[b].roster.filter((x) => x !== pb).concat(pa);
  l.players[pa].teamId = b;
  l.players[pb].teamId = a;
  l.news.unshift(
    `Around the league: ${l.teams[a].abbr} trade ${l.players[pa].first} ${l.players[pa].last} to ${l.teams[b].abbr} for ${l.players[pb].first} ${l.players[pb].last}.`,
  );
}

/* ------------------------------------------------------------ owner */

export function setTicketPrice(prev: League, price: number): League {
  const l = structuredClone(prev);
  l.teams[l.userTeam].ticket = clamp(Math.round(price), 20, 300);
  return l;
}

/** Coaching candidates this offseason (deterministic per season) */
export function coachCandidates(l: League): Coach[] {
  const r = rng(l.seed + l.season * 97);
  return [0, 1, 2, 3].map((i) => {
    const rating = Math.round(58 + r() * 38);
    return {
      name: COACH_NAMES[(l.season * 5 + i * 3) % COACH_NAMES.length],
      rating,
      salary: round1(2 + (rating - 55) * 0.25),
    };
  });
}

export function hireCoach(prev: League, c: Coach): League {
  const l = structuredClone(prev);
  const t = l.teams[l.userTeam];
  // Buyout for the old coach
  t.cash -= t.coach.salary * 0.5;
  l.news.unshift(`Coach ${t.coach.name} is out. ${c.name} (${c.rating}) takes over.`);
  t.coach = c;
  return l;
}

export function estimatedAttendance(t: OTeam) {
  const willing = 55 + t.fans * 0.9;
  const demand = clamp(t.fans / 100 + 0.35 - Math.max(0, t.ticket - willing) / 120, 0.2, 1);
  return Math.round(ARENA_CAPACITY * demand);
}

export const fullName = (p: OPlayer) => `${p.first} ${p.last}`;
export const perGame = (p: OPlayer, k: keyof Omit<SeasonStats, "gp">) =>
  p.stats.gp ? round1(p.stats[k] / p.stats.gp) : 0;
