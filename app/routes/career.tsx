import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AttributeBuilder } from "~/components/attribute-builder/attribute-builder";
import { AssetImage } from "~/components/asset-image/asset-image";
import { Blueprint } from "~/components/blueprint/blueprint";
import { Dialogue } from "~/components/dialogue/dialogue";
import { GameView } from "~/components/game-view/game-view";
import { MenuButton } from "~/components/menu-button/menu-button";
import { Results } from "~/components/results/results";
import { RapBooth } from "~/components/rap-booth/rap-booth";
import { SchoolSelect } from "~/components/school-select/school-select";
import { caps as capsFor, heightLabel, overallOf, toRatings } from "~/data/attributes";
import {
  COLLEGES,
  collegeGamesFor,
  dreCollege,
  DATES,
  FINALE,
  HS_GAMES,
  LIFE_EVENTS,
  PRESSERS,
  SCENES,
  registerMyBaller,
  sceneSet,
  type SceneCtx,
} from "~/data/career";
import { getBaller } from "~/data/characters";
import { RAP_QUEST } from "~/data/rap";
import { EBL_TEAMS, getTeam, roundRobin, simGame } from "~/data/ebl";
import type { Effect, Line } from "~/data/story";
import type { MatchResult } from "~/game/types";
import { NEW_CAREER, useCareer, type Career } from "~/hooks/use-career";
import { useProgress } from "~/hooks/use-progress";
import { useSettings } from "~/hooks/use-settings";
import type { Route } from "./+types/career";
import styles from "./career.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "EBL Career — Concrete Crown" }];
}

const SCHEDULE = roundRobin(EBL_TEAMS.map((t) => t.id));
const SALARY = 300;

type Overlay =
  | {
      kind: "scene";
      title: string;
      lines: Line[];
      bg?: string;
      then?: (c: Career) => Career;
      seenId?: string;
      set?: string;
      /** Overlay to open when the scene ends (e.g. the recording booth) */
      next?: Overlay;
    }
  | { kind: "builder" }
  | { kind: "rap"; step: number }
  | { kind: "game"; oppId: string; venueId: string; label: string; target: number }
  | null;

function applyEffect(c: Career, e?: Effect): Career {
  if (!e) return c;
  return {
    ...c,
    fans: Math.max(0, c.fans + (e.fans ?? 0)),
    love: Math.max(0, c.love + (e.love ?? 0)),
    chemistry: Math.max(0, Math.min(100, c.chemistry + (e.chemistry ?? 0))),
    flags: e.flag && !c.flags.includes(e.flag) ? [...c.flags, e.flag] : c.flags,
  };
}

function standings(c: Career) {
  return EBL_TEAMS.map((t) => ({ t, rec: c.table[t.id] ?? { w: 0, l: 0, pf: 0, pa: 0 } })).sort(
    (a, b) => b.rec.w - a.rec.w || b.rec.pf - b.rec.pa - (a.rec.pf - a.rec.pa),
  );
}

export default function CareerRoute() {
  const navigate = useNavigate();
  const [career, setCareer] = useCareer();
  const [, setProgress] = useProgress();
  const [settings] = useSettings();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [runId, setRunId] = useState(0);
  const c = career;

  const college = COLLEGES.find((x) => x.id === c.collegeId);
  const team = c.teamId ? getTeam(c.teamId) : undefined;
  const collegeGames = useMemo(() => collegeGamesFor(c.collegeId ?? undefined), [c.collegeId]);
  const ctx: SceneCtx | null = c.me
    ? {
        me: c.me,
        team,
        college,
        hsWins: c.hsWins,
        collegeWins: c.collegeWins,
        pick: c.pick,
        wins: team ? (c.table[team.id]?.w ?? 0) : 0,
        losses: team ? (c.table[team.id]?.l ?? 0) : 0,
        fans: c.fans,
        love: c.love,
      }
    : null;
  const names = c.me ? { me: c.me.name.split(" ")[0] } : undefined;

  // Keep the engine's copy of "me" in sync with attributes + current jersey
  const jersey = useMemo(() => {
    if (c.stage === "pro" && team) return [team.primary, team.secondary];
    if (college && (c.stage === "college" || c.stage === "draft")) return [college.primary, college.secondary];
    return ["#f2f4f8", "#8ec3ee"];
  }, [c.stage, team, college]);
  if (c.me && c.attrs) registerMyBaller(c.me, toRatings(c.attrs), jersey[0], jersey[1]);

  const scene = (
    title: string,
    lines: Line[],
    then?: (c: Career) => Career,
    seenId?: string,
    set?: string,
    next?: Overlay,
  ) => setOverlay({ kind: "scene", title, lines, then, seenId, set, next });

  /* ---------------------------------------------------------- create */
  if (c.stage === "create" || !c.me || !c.attrs) {
    return (
      <Blueprint
        onBack={() => navigate("/")}
        onFinish={(me, attrs) => {
          setCareer(() => ({ ...NEW_CAREER, me, attrs, stage: "hs" }));
        }}
      />
    );
  }
  const me = c.me;
  const attrs = c.attrs;
  const caps = capsFor(me.archetype, me.heightIn);
  const ovr = overallOf(attrs, me.archetype);

  /* ---------------------------------------------------------- overlays */
  if (overlay?.kind === "scene") {
    return (
      <Dialogue
        key={overlay.title + overlay.lines.length}
        lines={overlay.lines}
        title={overlay.title}
        background={overlay.title.includes("Draft") ? "key-art" : "city-aerial"}
        backgroundTint={jersey[0]}
        chooser="me"
        names={names}
        stage={sceneSet(
          overlay.set ?? (c.stage === "hs" ? "hsAfter" : c.stage === "college" ? "collegeAfter" : "pro"),
          { college, team },
        )}
        onChoice={(e) => setCareer((x) => applyEffect(x, e))}
        onDone={() => {
          setCareer((x) => {
            let n =
              overlay.seenId && !x.seen.includes(overlay.seenId) ? { ...x, seen: [...x.seen, overlay.seenId] } : x;
            if (overlay.then) n = overlay.then(n);
            return n;
          });
          setOverlay(overlay.next ?? null);
        }}
      />
    );
  }
  if (overlay?.kind === "rap") {
    const step = RAP_QUEST[overlay.step];
    return (
      <RapBooth
        song={step.song}
        artist={`${me.nickname} · Mic Check ${overlay.step + 1}/${RAP_QUEST.length}`}
        onDone={(grade) => {
          const fans = Math.round(4 + grade * 10);
          const pay = Math.round(100 + grade * 400);
          setProgress((p) => ({ ...p, crowns: (p.crowns ?? 0) + pay }));
          const last = overlay.step + 1 >= RAP_QUEST.length;
          scene(
            step.title,
            [
              ...step.after(ctx!, grade),
              {
                who: "narrator",
                text: `+${fans} fans · ₵${pay} in streams${last ? " · Side quest complete: you're a certified rapper." : ""}`,
              },
            ],
            (x) => ({
              ...x,
              activityDone: true,
              fans: x.fans + fans,
              earnings: x.earnings + pay,
              rapStep: overlay.step + 1,
              flags: last ? [...x.flags, "rapper"] : x.flags,
            }),
            undefined,
            step.venueId,
          );
        }}
      />
    );
  }
  if (overlay?.kind === "builder") {
    return (
      <AttributeBuilder
        name={me.name}
        nickname={me.nickname}
        archetype={me.archetype}
        heightIn={me.heightIn}
        attrs={attrs}
        caps={caps}
        sp={c.sp}
        onClose={() => setOverlay(null)}
        onConfirm={(next, spent) => {
          setCareer((x) => ({ ...x, attrs: next, sp: x.sp - spent }));
          setOverlay(null);
        }}
      />
    );
  }
  if (overlay?.kind === "game") {
    const g = overlay;
    return (
      <GameView
        runId={runId}
        config={{
          playerId: "me",
          opponentId: g.oppId,
          venueId: g.venueId,
          target: g.target,
          difficulty: settings.difficulty,
          useHiggsfield: false,
          shadows: settings.shadows,
          cameraShake: settings.cameraShake,
        }}
        objective={g.label}
        onFinish={setResult}
        onQuit={() => {
          setOverlay(null);
          setResult(null);
        }}
        overlay={
          result && (
            <Results
              result={result}
              playerId="me"
              opponentId={g.oppId}
              actions={
                <MenuButton
                  variant="primary"
                  autoFocus
                  onClick={() => {
                    const r = result;
                    setResult(null);
                    setOverlay(null);
                    finishGame(r);
                  }}
                >
                  Continue
                </MenuButton>
              }
            />
          )
        }
      />
    );
  }

  /* ---------------------------------------------------------- game flow */
  function startGame(oppId: string, venueId: string, label: string, target: number) {
    setRunId((n) => n + 1);
    setResult(null);
    setOverlay({ kind: "game", oppId, venueId, label, target });
  }

  function finishGame(r: MatchResult) {
    const win = r.winner === 0;
    const sp = win ? 14 : 6;
    setProgress((p) => ({
      ...p,
      crowns: (p.crowns ?? 0) + (c.stage === "pro" ? SALARY + (win ? 200 : 0) : win ? 60 : 20),
    }));
    if (c.stage === "hs") {
      const game = c.hsGame;
      const next: Career = {
        ...c,
        sp: c.sp + sp,
        hsGame: game + 1,
        hsWins: c.hsWins + (win ? 1 : 0),
        fans: c.fans + (win ? 3 : 0),
      };
      if (game + 1 >= HS_GAMES.length) next.stage = "college-pick";
      setCareer(() => next);
      const lines = win ? SCENES.hsWinAfter({ ...ctx!, hsWins: next.hsWins }, game) : SCENES.hsLoss(game);
      if (lines.length) scene(win ? "Postgame" : "Loss", lines);
    } else if (c.stage === "college") {
      const game = c.collegeGame;
      const next: Career = {
        ...c,
        sp: c.sp + sp + 4,
        collegeGame: game + 1,
        collegeWins: c.collegeWins + (win ? 1 : 0),
        fans: c.fans + (win ? 5 : 1),
      };
      if (game + 1 >= collegeGames.length) next.stage = "draft";
      setCareer(() => next);
      const lines = win
        ? SCENES.collegeAfter({ ...ctx!, collegeWins: next.collegeWins }, game)
        : SCENES.collegeLoss(ctx!, game);
      scene(win ? "Postgame" : "Loss", lines);
    } else if (c.stage === "pro") {
      proResult(r, win, sp);
    }
  }

  function proResult(r: MatchResult, win: boolean, sp: number) {
    const t = team!;
    const next: Career = {
      ...c,
      sp: c.sp + sp,
      fans: c.fans + (win ? 4 : 1),
      earnings: c.earnings + SALARY + (win ? 200 : 0),
    };
    if (c.playoff) {
      if (!win) {
        next.playoff = { ...c.playoff, alive: false };
        next.stage = "done";
        setCareer(() => next);
        scene("Season Over", FINALE.finalsLoss(ctx!));
        return;
      }
      if (c.playoff.round === 1) {
        next.playoff = { ...c.playoff, round: 2 };
        next.flags = [...c.flags, "champion"];
        next.stage = "done";
        setCareer(() => next);
        setProgress((p) => ({ ...p, crowns: (p.crowns ?? 0) + 2000 }));
        scene("Champions", FINALE.champion(ctx!));
        return;
      }
      next.playoff = { ...c.playoff, round: 1 };
      setCareer(() => next);
      scene("Semifinal Win", [{ who: "coach", text: "One more. The EBL Finals. Win and you're a champion." }]);
      return;
    }
    // Regular season week: record + sim everyone else
    const table = { ...c.table };
    const add = (id: string, pf: number, pa: number) => {
      const rec = table[id] ?? { w: 0, l: 0, pf: 0, pa: 0 };
      table[id] = { w: rec.w + (pf > pa ? 1 : 0), l: rec.l + (pf < pa ? 1 : 0), pf: rec.pf + pf, pa: rec.pa + pa };
    };
    const games = SCHEDULE[c.week];
    const mine = games.find((g) => g.includes(t.id))!;
    const opp = mine[0] === t.id ? mine[1] : mine[0];
    add(t.id, r.score[0], r.score[1]);
    add(opp, r.score[1], r.score[0]);
    for (const g of games) {
      if (g.includes(t.id)) continue;
      const [a, b] = simGame(getTeam(g[0]), getTeam(g[1]));
      add(g[0], a, b);
      add(g[1], b, a);
    }
    next.table = table;
    next.games = [...c.games, { week: c.week, opp, home: mine[0] === t.id, score: r.score, win }];
    next.week = c.week + 1;
    next.activityDone = false;
    if (next.week >= SCHEDULE.length) {
      const seeds = standings(next).map((s) => s.t.id);
      const rank = seeds.indexOf(t.id);
      if (rank < 4) {
        next.playoff = { seeds, round: 0, alive: true };
        next.flags = [...next.flags, "made-playoffs"];
        setCareer(() => next);
        scene("Playoffs", FINALE.playoffs({ ...ctx!, wins: table[t.id].w, losses: table[t.id].l }));
      } else {
        next.stage = "done";
        next.flags = [...next.flags, "missed-playoffs"];
        setCareer(() => next);
        scene("Season Over", FINALE.missed({ ...ctx!, wins: table[t.id].w, losses: table[t.id].l }));
      }
      return;
    }
    setCareer(() => next);
    // Life events that unlock this week
    const ev = LIFE_EVENTS.find(
      (e) => !next.seen.includes(e.id) && e.when({ ...ctx!, fans: next.fans, love: next.love }, next.week),
    );
    if (ev) {
      if (ev.id === "all-star") setProgress((p) => ({ ...p, crowns: (p.crowns ?? 0) + 1500 }));
      scene(ev.id === "all-star" ? "All-Star" : "Life", ev.lines(ctx!), undefined, ev.id, ev.id);
    }
  }

  /* ---------------------------------------------------------- stage intros */
  if (c.stage === "hs" && !c.seen.includes("hs-intro") && !overlay) {
    return (
      <Dialogue
        key="hs-intro"
        lines={SCENES.hsIntro(ctx!)}
        title="Senior Year · Harbor Heights High"
        stage={sceneSet("hsIntro", {})}
        background="city-aerial"
        backgroundTint="#8ec3ee"
        chooser="me"
        names={names}
        onChoice={(e) => setCareer((x) => applyEffect(x, e))}
        onDone={() => setCareer((x) => ({ ...x, seen: [...x.seen, "hs-intro"] }))}
      />
    );
  }
  if (c.stage === "college-pick" && !overlay) {
    if (!c.seen.includes("signing-day"))
      return (
        <Dialogue
          key="signing-day"
          lines={SCENES.collegeOffers(ctx!)}
          title="National Signing Day"
          stage={sceneSet("hsIntro", {})}
          background="city-aerial"
          backgroundTint="#8ec3ee"
          chooser="me"
          names={names}
          onChoice={(e) => setCareer((x) => applyEffect(x, e))}
          onDone={() => setCareer((x) => ({ ...x, seen: [...x.seen, "signing-day"] }))}
        />
      );
    return (
      <SchoolSelect
        colleges={COLLEGES}
        hsWins={c.hsWins}
        rivalId={dreCollege().id}
        onSign={(col) => setCareer((x) => ({ ...x, collegeId: col.id, stage: "college", sp: x.sp + 20 }))}
      />
    );
  }
  if (c.stage === "college" && !c.seen.includes("college-intro")) {
    return (
      <Dialogue
        key="college-intro"
        lines={SCENES.collegeIntro(ctx!)}
        title={`Freshman Year · ${college?.name}`}
        stage={sceneSet("collegeIntro", { college })}
        background="city-aerial"
        backgroundTint={college?.primary}
        chooser="me"
        names={names}
        onChoice={(e) => setCareer((x) => applyEffect(x, e))}
        onDone={() => setCareer((x) => ({ ...x, seen: [...x.seen, "college-intro"] }))}
      />
    );
  }
  if (c.stage === "draft") {
    // Draft slot from your amateur résumé; worst teams pick first
    const score = c.hsWins + c.collegeWins * 2 + Math.floor(ovr / 10);
    const pick = Math.max(1, Math.min(12, 14 - score));
    const order = [...EBL_TEAMS].sort((a, b) => a.rating - b.rating);
    const drafted = order[pick - 1];
    return (
      <Dialogue
        key="draft"
        lines={SCENES.draft({ ...ctx!, pick, team: drafted })}
        title="EBL Draft Night"
        stage={{ set: "draft" }}
        background="key-art"
        backgroundTint={drafted.primary}
        chooser="me"
        names={names}
        onChoice={(e) => setCareer((x) => applyEffect(x, e))}
        onDone={() =>
          setCareer((x) => ({
            ...x,
            stage: "pro",
            pick,
            teamId: drafted.id,
            week: 0,
            table: {},
            games: [],
            sp: x.sp + 30,
            seen: [...x.seen, "draft"],
          }))
        }
      />
    );
  }
  if (c.stage === "pro" && !c.seen.includes("pro-intro")) {
    return (
      <Dialogue
        key="pro-intro"
        lines={SCENES.proIntro(ctx!)}
        title={`Rookie Season · ${team?.city} ${team?.name}`}
        stage={sceneSet("proIntro", { team })}
        background="city-aerial"
        backgroundTint={team?.primary}
        chooser="me"
        names={names}
        onChoice={(e) => setCareer((x) => applyEffect(x, e))}
        onDone={() => setCareer((x) => ({ ...x, seen: [...x.seen, "pro-intro"] }))}
      />
    );
  }

  /* ---------------------------------------------------------- hub */
  const stageLabel = {
    hs: "High School · Senior Year",
    "college-pick": "National Signing Day",
    college: `College · ${college?.name ?? ""}`,
    draft: "EBL Draft",
    pro: `EBL Rookie Season · ${team?.city} ${team?.name}`,
    done: "Season Complete",
    create: "",
  }[c.stage];

  let next: { label: string; oppId: string; venueId: string; target: number } | null = null;
  if (c.stage === "hs" && c.hsGame < HS_GAMES.length) {
    const g = HS_GAMES[c.hsGame];
    next = { label: g.label, oppId: g.opp.id, venueId: "hs-gym", target: 11 };
  } else if (c.stage === "college" && c.collegeGame < collegeGames.length && college) {
    const g = collegeGames[c.collegeGame];
    next = { label: g.label, oppId: g.opp.id, venueId: college.venueId, target: 15 };
  } else if (c.stage === "pro" && team) {
    if (c.playoff?.alive) {
      const rank = c.playoff.seeds.indexOf(team.id);
      const oppId =
        c.playoff.round === 0
          ? c.playoff.seeds[3 - rank]
          : (c.playoff.seeds.find((s, i) => i < 4 && s !== team.id && s !== c.playoff!.seeds[3 - rank]) ??
            c.playoff.seeds[0]);
      const opp = getTeam(oppId);
      next = {
        label: `${c.playoff.round === 0 ? "EBL Semifinal" : "EBL FINALS"} vs ${opp.city} ${opp.name}`,
        oppId: opp.starId,
        venueId: team.venueId,
        target: 21,
      };
    } else if (c.week < SCHEDULE.length) {
      const g = SCHEDULE[c.week].find((x) => x.includes(team.id))!;
      const home = g[0] === team.id;
      const opp = getTeam(home ? g[1] : g[0]);
      next = {
        label: `Week ${c.week + 1}: ${home ? "vs" : "@"} ${opp.city} ${opp.name}`,
        oppId: opp.starId,
        venueId: home ? team.venueId : opp.venueId,
        target: 21,
      };
    }
  }

  const activity = (kind: "practice" | "date" | "endorse" | "press" | "rest" | "studio") => {
    if (c.activityDone) return;
    const done = (x: Career): Career => ({ ...x, activityDone: true });
    if (kind === "studio") {
      const n = c.rapStep ?? 0;
      const step = RAP_QUEST[n];
      scene(step.title, step.intro(ctx!), undefined, undefined, step.venueId, { kind: "rap", step: n });
    } else if (kind === "practice") {
      setCareer((x) => done({ ...x, sp: x.sp + 12, chemistry: Math.min(100, x.chemistry + 2) }));
      scene("Practice", [
        {
          who: c.stage === "pro" ? "coach" : c.stage === "college" ? "collegecoach" : "hscoach",
          text: "Two hours of film, then shooting until your arms fall off. Good work. (+12 SP)",
        },
      ]);
    } else if (kind === "date") {
      const lines = DATES[Math.min(c.love, DATES.length - 1)](ctx!);
      scene("Date with Imani", lines, done, undefined, `date${Math.min(c.love, DATES.length - 1)}`);
    } else if (kind === "endorse") {
      const pay = 250 + c.fans * 8;
      setProgress((p) => ({ ...p, crowns: (p.crowns ?? 0) + pay }));
      setCareer((x) => done({ ...x, fans: x.fans + 3, earnings: x.earnings + pay }));
      scene("Endorsement Shoot", [
        { who: "agent", text: `Harbor Kicks commercial shoot. Smile, dunk, smile again. That's ₵${pay} in the bank.` },
        { who: "imani", text: "I'm on set too. Try not to blink in every take." },
      ]);
    } else if (kind === "press") {
      scene("Press Conference", PRESSERS[c.week % PRESSERS.length](ctx!), done);
    } else {
      setCareer((x) => done({ ...x, chemistry: Math.min(100, x.chemistry + 4) }));
      scene("Rest Day", [{ who: "mom", text: "You slept eleven hours. I'm proud of you. Now eat something." }]);
    }
  };

  const table = standings(c);

  return (
    <main className={styles.page} style={{ "--team": jersey[0], "--team2": jersey[1] } as React.CSSProperties}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          ← Menu
        </Link>
        <div>
          <p className={styles.kicker}>{stageLabel}</p>
          <h1>
            {me.name} <span>“{me.nickname}”</span>
          </h1>
          <p className={styles.meta}>
            {heightLabel(me.heightIn)} · {me.archetype.replace("-", " ")} · #{me.number}
          </p>
        </div>
        <div className={styles.ovr}>
          <strong>{ovr}</strong>
          <span>OVR</span>
        </div>
      </header>

      <section className={styles.grid}>
        <article className={styles.card} data-main>
          <h2>Next up</h2>
          {next ? (
            <>
              <div className={styles.matchup}>
                <div className={styles.face}>
                  <AssetImage
                    asset={getBaller(next.oppId).portrait === "key-art" ? undefined : getBaller(next.oppId).portrait}
                    alt=""
                    fallbackLabel={getBaller(next.oppId).nickname.slice(0, 3)}
                    accent={getBaller(next.oppId).accent}
                  />
                </div>
                <div>
                  <p className={styles.label}>{next.label}</p>
                  <p className={styles.oppLine}>
                    {getBaller(next.oppId).name} “{getBaller(next.oppId).nickname}” · {getBaller(next.oppId).from} ·
                    first to {next.target}
                  </p>
                </div>
              </div>
              <MenuButton
                variant="primary"
                onClick={() => startGame(next!.oppId, next!.venueId, next!.label, next!.target)}
                autoFocus
              >
                Play game
              </MenuButton>
            </>
          ) : c.stage === "college-pick" ? (
            <div className={styles.offers}>
              <p>Signing Day: you won {c.hsWins} of 3 big games. Pick your school.</p>
              {COLLEGES.map((col) => {
                const offered = c.hsWins >= col.needWins;
                return (
                  <button
                    key={col.id}
                    disabled={!offered}
                    style={{ "--c": col.primary } as React.CSSProperties}
                    onClick={() => setCareer((x) => ({ ...x, collegeId: col.id, stage: "college", sp: x.sp + 20 }))}
                  >
                    <strong>{col.name}</strong>
                    <em>{offered ? col.pitch : `No offer (needs ${col.needWins} HS wins)`}</em>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <p className={styles.label}>
                {c.flags.includes("champion") ? "🏆 EBL Champion · Rookie of the Year" : "Season complete."}
              </p>
              <MenuButton onClick={() => setCareer(() => ({ ...NEW_CAREER }))}>Start a new career</MenuButton>
            </div>
          )}
        </article>

        <article className={styles.card}>
          <h2>Build</h2>
          <p className={styles.big}>
            {c.sp} <small>SP available</small>
          </p>
          <MenuButton onClick={() => setOverlay({ kind: "builder" })}>Upgrade attributes</MenuButton>
          <p className={styles.small}>Wins +14 SP · losses +6 · practice +12</p>
        </article>

        <article className={styles.card}>
          <h2>This week</h2>
          {c.activityDone ? (
            <p className={styles.small}>You've already made your move this week. Play the next game.</p>
          ) : (
            <div className={styles.acts}>
              <button onClick={() => activity("practice")}>🏀 Extra practice</button>
              <button onClick={() => activity("date")}>💬 Hang out with Imani</button>
              {(c.stage === "college" || c.stage === "pro") && (c.rapStep ?? 0) < RAP_QUEST.length && (
                <button onClick={() => activity("studio")}>
                  🎙 Side quest: Mic Check {(c.rapStep ?? 0) + 1}/{RAP_QUEST.length}
                </button>
              )}
              {c.stage === "pro" && <button onClick={() => activity("endorse")}>📸 Endorsement shoot</button>}
              {c.stage === "pro" && <button onClick={() => activity("press")}>🎤 Press conference</button>}
              <button onClick={() => activity("rest")}>🛋 Rest day</button>
            </div>
          )}
          <div className={styles.meters}>
            <span>
              Fans <b>{c.fans}</b>
            </span>
            <span>
              Chemistry <b>{c.chemistry}</b>
            </span>
            {(c.stage === "college" || c.stage === "pro" || c.stage === "done") && (
              <span>
                Imani <b>{"♥".repeat(Math.min(5, c.love)) || "—"}</b>
                {c.flags.includes("together") && " (dating)"}
              </span>
            )}
            {c.earnings > 0 && (
              <span>
                Earnings <b>₵{c.earnings.toLocaleString()}</b>
              </span>
            )}
          </div>
        </article>

        {(c.stage === "pro" || c.stage === "done") && team && (
          <article className={styles.card} data-wide>
            <h2>EBL Standings</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                {table.map(({ t, rec }, i) => (
                  <tr key={t.id} data-me={t.id === team.id} data-cut={i === 3}>
                    <td>{i + 1}</td>
                    <td>
                      <span className={styles.dot} style={{ background: t.primary }} /> {t.city} {t.name}
                    </td>
                    <td>{rec.w}</td>
                    <td>{rec.l}</td>
                    <td>
                      {rec.pf - rec.pa > 0 ? "+" : ""}
                      {rec.pf - rec.pa}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </section>
    </main>
  );
}
