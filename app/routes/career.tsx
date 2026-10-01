import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AttributeBuilder } from "~/components/attribute-builder/attribute-builder";
import { AssetImage } from "~/components/asset-image/asset-image";
import { Blueprint } from "~/components/blueprint/blueprint";
import { Potential } from "~/components/potential/potential";
import { Vitals, type VitalsData } from "~/components/vitals/vitals";
import { BadgeBuilder } from "~/components/badge-builder/badge-builder";
import { applyBadges, emptyBP, type BadgeCat } from "~/data/badges";
import type { Attrs } from "~/data/attributes";
import type { MyPlayer } from "~/data/career";
import { Dialogue } from "~/components/dialogue/dialogue";
import { Flight } from "~/components/flight/flight";
import { ShoeDealContracts } from "~/components/shoe-deal/shoe-deal";
import { SneakerArt, VantaLogo, VyroLogo } from "~/components/vyro-store/vyro-store";
import { BRANDS, TIER_LABEL, dealExpired, dealIntro, dealOffers, dealSigned, royaltyCheck } from "~/data/deals";
import { GEAR } from "~/data/gear";
import { cityFor } from "~/data/cities";
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
  HOMETOWN,
  SCENES,
  registerMyBaller,
  sceneSet,
  type SceneCtx,
} from "~/data/career";
import { getBaller } from "~/data/characters";
import { RAP_QUEST } from "~/data/rap";
import {
  AGING_FROM,
  awardsCeremony,
  awardsFor,
  CAN_RETIRE_FROM,
  contractOffers,
  dreEbl,
  dreTeamFor,
  eblPregame,
  hallOfFame,
  MAX_SEASONS,
  RESULT_LABEL,
  SEASON_EVENTS,
  seasonIntro,
  seasonTitle,
  signingLines,
  type Offer,
  type SeasonRecord,
  type SeasonResult,
} from "~/data/seasons";
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
const ROOKIE_SALARY = 300;

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
  | { kind: "badges" }
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

const addBP = (bp: Record<BadgeCat, number> | undefined, add: Record<BadgeCat, number>) => {
  const out = { ...(bp ?? emptyBP()) };
  for (const k of Object.keys(add) as BadgeCat[]) out[k] += add[k];
  return out;
};

const cap = (w: string) => w.charAt(0) + w.slice(1).toLowerCase();

/** Runs an action once after mount (used for campus → career shortcuts) */
function RunOnce({ run }: { run(): void }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function CareerRoute() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const go = params.get("go");
  const [career, setCareer] = useCareer();
  const [, setProgress] = useProgress();
  const [settings] = useSettings();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [create, setCreate] = useState<{
    step: "vitals" | "builder" | "potential";
    vitals?: VitalsData;
    me?: MyPlayer;
    attrs?: Attrs;
  }>({
    step: "vitals",
  });
  const [result, setResult] = useState<MatchResult | null>(null);
  const [runId, setRunId] = useState(0);
  const c = career;

  const college = COLLEGES.find((x) => x.id === c.collegeId);
  const team = c.teamId ? getTeam(c.teamId) : undefined;
  const collegeGames = useMemo(() => collegeGamesFor(c.collegeId ?? undefined), [c.collegeId]);
  const season = c.season ?? 1;
  const salary = c.salary ?? ROOKIE_SALARY;
  const history = c.history ?? [];
  const dreTeam = c.teamId ? getTeam(c.dreTeamId ?? dreTeamFor(c.pick || 2, c.teamId).id) : undefined;
  // Old saves ended at "done" after one season: treat that as the offseason
  const offseason = c.stage === "offseason" || (c.stage === "done" && !c.flags.includes("retired") && !!c.teamId);
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
        season,
        dreTeam,
        flags: c.flags,
      }
    : null;
  const names = c.me ? { me: c.me.name.split(" ")[0] } : undefined;
  // In the pros, Zay shows up in his EBL uniform in every scene
  const proEra = (c.stage === "pro" || offseason || c.flags.includes("retired")) && !!dreTeam;
  if (proEra) dreEbl(dreTeam!, season);
  const staged = (st: ReturnType<typeof sceneSet>): ReturnType<typeof sceneSet> =>
    proEra ? { ...st, alias: { ...st.alias, "rival-dre": "rival-dre-ebl" } } : st;

  // Keep the engine's copy of "me" in sync with attributes + current jersey
  const jersey = useMemo(() => {
    if ((c.stage === "pro" || offseason) && team) return [team.primary, team.secondary];
    if (college && (c.stage === "college" || c.stage === "draft")) return [college.primary, college.secondary];
    return ["#f2f4f8", "#8ec3ee"];
  }, [c.stage, team, college]);
  const deal = c.shoeDeal ?? null;
  if (c.me && c.attrs)
    registerMyBaller(
      c.me,
      applyBadges(toRatings(c.attrs), c.badges),
      jersey[0],
      jersey[1],
      deal ? [deal.shoeColors[0], deal.shoeColors[2]] : undefined,
    );

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
    // 2K22-style creator: Vitals → Builder → Potential
    if (create.step === "vitals")
      return (
        <Vitals
          initial={create.vitals}
          onBack={() => navigate("/")}
          onContinue={(v) => setCreate({ step: "builder", vitals: v })}
        />
      );
    if (create.step === "potential" && create.me && create.attrs) {
      const cm = create.me;
      const ca = create.attrs;
      return (
        <Potential
          me={cm}
          start={ca}
          caps={capsFor(cm.archetype, cm.heightIn)}
          onBack={() => setCreate((x) => ({ ...x, step: "builder" }))}
          onContinue={() => {
            setCareer(() => ({ ...NEW_CAREER, me: cm, attrs: ca, stage: "hs", bp: emptyBP(), badges: {} }));
            setCreate({ step: "vitals" });
          }}
        />
      );
    }
    const v = create.vitals;
    return (
      <Blueprint
        initial={v ? { name: `${cap(v.first)} ${cap(v.last)}`, number: v.number, pos: v.pos, hand: v.hand } : undefined}
        onBack={() => setCreate((x) => ({ ...x, step: "vitals" }))}
        onFinish={(me, attrs) => setCreate((x) => ({ ...x, step: "potential", me, attrs }))}
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
        stage={staged(
          sceneSet(overlay.set ?? (c.stage === "hs" ? "hsAfter" : c.stage === "college" ? "collegeAfter" : "pro"), {
            college,
            team,
          }),
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
  if (overlay?.kind === "badges") {
    return (
      <BadgeBuilder
        attrs={attrs}
        bp={c.bp ?? emptyBP()}
        badges={c.badges ?? {}}
        onClose={() => setOverlay(null)}
        onConfirm={(badges, bp) => {
          setCareer((x) => ({ ...x, badges, bp }));
          setOverlay(null);
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
          // The league catches up with you: later seasons play a level harder
          difficulty:
            c.stage === "pro" ? Math.min(2, settings.difficulty + (season >= 3 ? 1 : 0)) : settings.difficulty,
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
    // Badge Points: your archetype's category grows fastest
    const main: BadgeCat =
      me.archetype === "sniper"
        ? "shooting"
        : me.archetype === "floor-general"
          ? "playmaking"
          : me.archetype === "lockdown" || me.archetype === "big"
            ? "defense"
            : "finishing";
    const cats: BadgeCat[] = ["finishing", "shooting", "playmaking", "defense"];
    const other = cats[(c.hsGame + c.collegeGame + c.week) % 4];
    setCareer((x) => {
      const bp = { ...(x.bp ?? emptyBP()) };
      bp[main] += win ? 2 : 1;
      if (win) bp[other] += 1;
      return { ...x, bp };
    });
    setProgress((p) => ({
      ...p,
      crowns:
        (p.crowns ?? 0) +
        (c.stage === "pro" ? salary + (deal?.perGame ?? 0) + (win ? 200 : 0) : win ? 60 : 20),
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

  /** Close out a season: record, awards, rings → offseason */
  function endSeason(next: Career, result: SeasonResult): Career {
    const rec = next.table[team!.id] ?? { w: 0, l: 0, pf: 0, pa: 0 };
    const allStar = next.flags.includes(`all-star-${season}`);
    const record: SeasonRecord = {
      season,
      teamId: team!.id,
      w: rec.w,
      l: rec.l,
      result,
      awards: awardsFor(season, rec.w, result, allStar),
      salary,
      ovr,
    };
    return { ...next, stage: "offseason", history: [...(next.history ?? []), record] };
  }

  function proResult(r: MatchResult, win: boolean, sp: number) {
    const t = team!;
    const next: Career = {
      ...c,
      sp: c.sp + sp,
      fans: c.fans + (win ? 4 : 1),
      earnings: c.earnings + salary + (win ? 200 : 0),
    };
    if (c.playoff) {
      if (!win) {
        next.playoff = { ...c.playoff, alive: false };
        setCareer(() => endSeason(next, c.playoff!.round === 0 ? "semis" : "finals"));
        scene("Season Over", FINALE.finalsLoss(ctx!));
        return;
      }
      if (c.playoff.round === 1) {
        next.playoff = { ...c.playoff, round: 2 };
        next.flags = [...c.flags, "champion", `champion-${season}`];
        setCareer(() => endSeason(next, "champion"));
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
        next.flags = [...next.flags, "missed-playoffs"];
        setCareer(() => endSeason(next, "missed"));
        scene("Season Over", FINALE.missed({ ...ctx!, wins: table[t.id].w, losses: table[t.id].l }));
      }
      return;
    }
    setCareer(() => next);
    // Season storylines first (moving in, the proposal, the wedding, All-Star…)
    const sctx = { ...ctx!, fans: next.fans, love: next.love, flags: next.flags };
    const sev = SEASON_EVENTS.find(
      (e) =>
        next.week >= e.week &&
        !next.seen.includes(`${e.id}-${season}`) &&
        !next.seen.includes(e.id) &&
        e.when(sctx, season),
    );
    if (sev) {
      const b = sev.bonus;
      if (b?.crowns) setProgress((p) => ({ ...p, crowns: (p.crowns ?? 0) + b.crowns! }));
      scene(
        sev.title,
        sev.lines(sctx, season),
        (x) => ({
          ...x,
          sp: x.sp + (b?.sp ?? 0),
          earnings: x.earnings + (b?.crowns ?? 0),
          flags:
            b?.flag && !x.flags.includes(b.flag)
              ? [...x.flags, b.flag]
              : sev.id === "all-star"
                ? [...x.flags, `all-star-${season}`]
                : x.flags,
        }),
        `${sev.id}-${season}`,
        sev.set,
      );
      return;
    }
    // Life events that unlock this week (one-time, any season)
    const ev = LIFE_EVENTS.find(
      (e) => !next.seen.includes(e.id) && e.when({ ...ctx!, fans: next.fans, love: next.love }, next.week),
    );
    if (ev) {
      if (ev.id === "all-star") {
        setProgress((p) => ({ ...p, crowns: (p.crowns ?? 0) + 1500 }));
        setCareer((x) => ({ ...x, flags: [...x.flags, `all-star-${season}`] }));
      }
      scene(ev.id === "all-star" ? "All-Star" : "Life", ev.lines(ctx!), undefined, ev.id, ev.id);
    }
  }

  /* ---------------------------------------------------------- flight */
  if (c.flight && !overlay) {
    return (
      <Flight
        key={`${c.flight.from}-${c.flight.to}`}
        from={cityFor(c.flight.from)}
        to={cityFor(c.flight.to)}
        team={getTeam(c.flight.to)}
        tag={c.flight.tag}
        onDone={() => setCareer((x) => ({ ...x, flight: null }))}
      />
    );
  }

  /* ---------------------------------------------------------- shoe deal */
  // Week 2 of your rookie year (and whenever a deal runs out) the brands come calling
  if (c.stage === "pro" && team && c.week >= 2 && dealExpired(deal, season) && c.dealSeen !== season && !overlay) {
    if (!c.seen.includes(`deal-intro-${season}`))
      return (
        <Dialogue
          key={`deal-intro-${season}`}
          lines={dealIntro(me.name.split(" ")[0], deal)}
          title="The Shoe Deal · VYRO vs VANTA"
          stage={staged(sceneSet("proIntro", { team }))}
          background="city-aerial"
          backgroundTint={team.primary}
          chooser="me"
          names={names}
          onDone={() => setCareer((x) => ({ ...x, seen: [...x.seen, `deal-intro-${season}`] }))}
        />
      );
    return (
      <ShoeDealContracts
        offers={dealOffers(me, {
          fans: c.fans,
          ovr,
          season,
          champion: c.flags.includes("champion"),
          current: deal,
        })}
        athlete={{ name: me.name, number: me.number, team: `${team.city} ${team.name}` }}
        season={season}
        onDecline={() => setCareer((x) => ({ ...x, dealSeen: season }))}
        onSign={(d) => {
          const brandGear = GEAR.filter((g) => g.brand === BRANDS[d.brand].gearBrand && g.slot === "shoes").map(
            (g) => g.id,
          );
          setProgress((p) => ({
            ...p,
            crowns: (p.crowns ?? 0) + d.bonus,
            owned: [...new Set([...(p.owned ?? []), ...brandGear])],
          }));
          setCareer((x) => ({ ...x, shoeDeal: d, dealSeen: season, earnings: x.earnings + d.bonus, fans: x.fans + 5 }));
          scene("Shoe Deal", dealSigned(d));
        }}
      />
    );
  }

  /* ---------------------------------------------------------- stage intros */
  if (c.stage === "hs" && !c.seen.includes("hs-intro") && !overlay) {
    return (
      <Dialogue
        key="hs-intro"
        lines={SCENES.hsIntro(ctx!)}
        title="Senior Year · Peachtree Heights High · Atlanta, GA"
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
        onSign={(col) =>
          setCareer((x) => ({ ...x, collegeId: col.id, stage: "college", sp: x.sp + 20, bp: addBP(x.bp, col.bonus) }))
        }
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
    // Asked to go home? Atlanta trades up into your slot
    const drafted = c.flags.includes("hometown-draft") ? getTeam(HOMETOWN.teamId) : order[pick - 1];
    if (!c.seen.includes("predraft") && !overlay)
      return (
        <Dialogue
          key="predraft"
          lines={SCENES.predraft(ctx!)}
          title={`Pre-Draft Workouts · Hometown: ${HOMETOWN.city}, ${HOMETOWN.state}`}
          stage={{ set: "draft" }}
          background="key-art"
          backgroundTint={getTeam(HOMETOWN.teamId).primary}
          chooser="me"
          names={names}
          onChoice={(e) => setCareer((x) => applyEffect(x, e))}
          onDone={() => setCareer((x) => ({ ...x, seen: [...x.seen, "predraft"] }))}
        />
      );
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
            dreTeamId: dreTeamFor(pick, drafted.id).id,
            season: 1,
            salary: ROOKIE_SALARY,
            history: [],
            week: 0,
            table: {},
            games: [],
            sp: x.sp + 30,
            seen: [...x.seen, "draft"],
            // Draft night is in New York; fly to your new home city
            flight: drafted.id === "nyc" ? null : { from: "nyc", to: drafted.id, tag: "Rookie" },
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
        stage={staged(sceneSet("proIntro", { team }))}
        background="city-aerial"
        backgroundTint={team?.primary}
        chooser="me"
        names={names}
        onChoice={(e) => setCareer((x) => applyEffect(x, e))}
        onDone={() => setCareer((x) => ({ ...x, seen: [...x.seen, "pro-intro"] }))}
      />
    );
  }

  if (c.stage === "pro" && season >= 2 && !c.seen.includes(`season-${season}-intro`) && !overlay) {
    return (
      <Dialogue
        key={`season-${season}-intro`}
        lines={seasonIntro(ctx!)}
        title={`${seasonTitle(season)} · ${team?.city} ${team?.name}`}
        stage={staged(sceneSet("proIntro", { team }))}
        background="city-aerial"
        backgroundTint={team?.primary}
        chooser="me"
        names={names}
        onChoice={(e) => setCareer((x) => applyEffect(x, e))}
        onDone={() => setCareer((x) => ({ ...x, seen: [...x.seen, `season-${season}-intro`] }))}
      />
    );
  }
  const lastRec: SeasonRecord | undefined =
    history[history.length - 1] ??
    (offseason && team
      ? {
          season: 1,
          teamId: team.id,
          w: c.table[team.id]?.w ?? 0,
          l: c.table[team.id]?.l ?? 0,
          result: c.flags.includes("champion") ? "champion" : c.flags.includes("missed-playoffs") ? "missed" : "semis",
          awards: awardsFor(
            1,
            c.table[team.id]?.w ?? 0,
            c.flags.includes("champion") ? "champion" : c.flags.includes("missed-playoffs") ? "missed" : "semis",
            c.seen.includes("all-star"),
          ),
          salary,
          ovr,
        }
      : undefined);
  if (offseason && lastRec && !c.seen.includes(`awards-${lastRec.season}`) && !overlay) {
    return (
      <Dialogue
        key={`awards-${lastRec.season}`}
        lines={awardsCeremony(ctx!, lastRec)}
        title={`EBL Awards · ${seasonTitle(lastRec.season)}`}
        stage={staged({ set: "draft" })}
        background="key-art"
        backgroundTint={team?.primary}
        chooser="me"
        names={names}
        onDone={() => {
          // Signature-shoe royalties are paid once a season
          const check = deal ? royaltyCheck(deal, c.fans) : 0;
          if (check) setProgress((p) => ({ ...p, crowns: (p.crowns ?? 0) + check }));
          setCareer((x) => ({
            ...x,
            stage: "offseason",
            history: x.history?.length ? x.history : [lastRec],
            seen: [...x.seen, `awards-${lastRec.season}`],
            earnings: x.earnings + check,
            royalties: (x.royalties ?? 0) + check,
          }));
        }}
      />
    );
  }

  /** Sign a contract and tip off the next season */
  function startSeason(offer: Offer) {
    const from = team!;
    const nextSeason = season + 1;
    let a = attrs;
    if (nextSeason >= AGING_FROM) {
      // Athletic decline: a step slower every year, but the skills stay
      a = { ...attrs };
      for (const k of ["speed", "agility", "vertical"] as const) a[k] = Math.max(40, a[k] - 2);
    }
    setCareer((x) => ({
      ...x,
      stage: "pro",
      season: nextSeason,
      teamId: offer.teamId,
      salary: offer.salary,
      attrs: a,
      week: 0,
      table: {},
      games: [],
      playoff: null,
      activityDone: false,
      sp: x.sp + 25,
      flight: offer.teamId === from.id ? null : { from: from.id, to: offer.teamId, tag: `Season ${nextSeason}` },
    }));
    scene("Contract", signingLines(ctx!, offer, from), undefined, undefined, getTeam(offer.teamId).venueId);
  }

  function retire() {
    setCareer((x) => ({ ...x, stage: "done", flags: [...x.flags, "retired"] }));
    scene("Hall of Fame", hallOfFame(ctx!, history), undefined, undefined, "the-crown");
  }

  /* ---------------------------------------------------------- hub */
  const stageLabel = {
    hs: "High School · Senior Year",
    "college-pick": "National Signing Day",
    college: `College · ${college?.name ?? ""}`,
    draft: "EBL Draft",
    pro: `EBL ${seasonTitle(season)} · ${team?.city} ${team?.name}`,
    offseason: `Offseason · after ${seasonTitle(season)}`,
    done: c.flags.includes("retired") ? "Retired · Hall of Fame" : "Season Complete",
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
      const rivalry = dreTeam && opp.id === dreTeam.id;
      next = {
        label: `${c.playoff.round === 0 ? "EBL Semifinal" : "EBL FINALS"} vs ${rivalry ? "Zay Carter & the " : ""}${opp.city} ${opp.name}`,
        oppId: rivalry ? dreEbl(opp, season).id : opp.starId,
        venueId: team.venueId,
        target: 21,
      };
    } else if (c.week < SCHEDULE.length) {
      const g = SCHEDULE[c.week].find((x) => x.includes(team.id))!;
      const home = g[0] === team.id;
      const opp = getTeam(home ? g[1] : g[0]);
      const rivalry = dreTeam && opp.id === dreTeam.id;
      next = {
        label: rivalry
          ? `Week ${c.week + 1} · RIVALRY WEEK: ${home ? "vs" : "@"} Zay Carter & the ${opp.city} ${opp.name}`
          : `Week ${c.week + 1}: ${home ? "vs" : "@"} ${opp.city} ${opp.name}`,
        oppId: rivalry ? dreEbl(opp, season).id : opp.starId,
        venueId: home ? team.venueId : opp.venueId,
        target: 21,
      };
    }
  }

  /** Tip off the next game (rivalry games get a face-off first) */
  function playNext() {
    const n = next!;
    if (n.oppId.startsWith("rival-dre")) {
      // Beef at center court first, then tip-off
      const key = c.stage === "hs" ? "hsPregame" : c.stage === "pro" ? "eblPregame" : "collegePregame";
      setRunId((r) => r + 1);
      setResult(null);
      scene(
        "Face-Off",
        key === "eblPregame" ? eblPregame(ctx!) : SCENES[key](ctx!),
        undefined,
        undefined,
        key === "eblPregame" ? `eblPregame:${n.venueId}` : key,
        {
          kind: "game",
          oppId: n.oppId,
          venueId: n.venueId,
          label: n.label,
          target: n.target,
        },
      );
    } else startGame(n.oppId, n.venueId, n.label, n.target);
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
      scene("Date with Jaailyah", lines, done, undefined, `date${Math.min(c.love, DATES.length - 1)}`);
    } else if (kind === "endorse") {
      const pay = 250 + c.fans * 8;
      setProgress((p) => ({ ...p, crowns: (p.crowns ?? 0) + pay }));
      setCareer((x) => done({ ...x, fans: x.fans + 3, earnings: x.earnings + pay }));
      const brand = deal ? BRANDS[deal.brand].name : "A local car dealership";
      scene("Endorsement Shoot", [
        {
          who: "agent",
          text: `${brand} commercial shoot${deal?.shoe ? ` for the ${deal.shoe}` : ""}. Smile, dunk, smile again. That's ₵${pay} in the bank.`,
        },
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
  const rings = history.filter((h) => h.result === "champion").length;
  const mvps = history.filter((h) => h.awards.includes("EBL MVP")).length;

  /** Main card once a season is over: recap, contract offers, retirement */
  const seasonEnd = () => {
    if (!offseason || !lastRec || !team)
      return (
        <div>
          <p className={styles.label}>
            {c.flags.includes("retired")
              ? `Hall of Famer · ${history.length} seasons · ${rings} ${rings === 1 ? "ring" : "rings"} · ${mvps} MVP${mvps === 1 ? "" : "s"}`
              : "Season complete."}
          </p>
          <MenuButton onClick={() => setCareer(() => ({ ...NEW_CAREER }))}>Start a new career</MenuButton>
        </div>
      );
    const offers = contractOffers(team.id, dreTeam?.id, season, salary, ovr, c.fans);
    const forced = season >= MAX_SEASONS;
    return (
      <div className={styles.offseason}>
        <p className={styles.label}>
          {seasonTitle(lastRec.season)}: {lastRec.w}-{lastRec.l} · {RESULT_LABEL[lastRec.result]}
        </p>
        {lastRec.awards.length > 0 && <p className={styles.oppLine}>🏅 {lastRec.awards.join(" · ")}</p>}
        {forced ? (
          <p className={styles.small}>Your body says it's time. One last walk to the podium.</p>
        ) : (
          <>
            <p className={styles.small}>
              Free agency: pick where you play {seasonTitle(season + 1).toLowerCase()} (+25 SP offseason training).
            </p>
            <div className={styles.offers}>
              {offers.map((o) => {
                const t = getTeam(o.teamId);
                return (
                  <button
                    key={o.teamId}
                    style={{ "--c": t.primary } as React.CSSProperties}
                    onClick={() => startSeason(o)}
                  >
                    <strong>
                      {o.resign ? "Re-sign · " : ""}
                      {t.city} {t.name} · ₵{o.salary}/game
                    </strong>
                    <em>{o.pitch}</em>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {(season >= CAN_RETIRE_FROM || forced) && (
          <MenuButton variant={forced ? "primary" : "ghost"} onClick={retire}>
            Retire · Hall of Fame ceremony
          </MenuButton>
        )}
      </div>
    );
  };

  return (
    <main className={styles.page} style={{ "--team": jersey[0], "--team2": jersey[1] } as React.CSSProperties}>
      {go && !overlay && (
        <RunOnce
          run={() => {
            setParams({}, { replace: true });
            if (go === "build") setOverlay({ kind: "builder" });
            else if (go === "practice") activity("practice");
            else if (go === "date") activity("date");
            else if (go === "game" && next) playNext();
          }}
        />
      )}
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
          <h2>{offseason ? "Offseason" : c.flags.includes("retired") ? "Legacy" : "Next up"}</h2>
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
              <MenuButton variant="primary" onClick={playNext} autoFocus>
                Play game
              </MenuButton>
              {c.stage === "hs" && (
                <MenuButton onClick={() => navigate("/campus")} hint="Explore Peachtree Heights High before the game">
                  Walk the campus
                </MenuButton>
              )}
              {c.stage === "pro" && team && (
                <MenuButton onClick={() => navigate("/city")} hint={`Your home until you retire · ${cityFor(team.id).tagline}`}>
                  Explore {cityFor(team.id).city}, {cityFor(team.id).state}
                </MenuButton>
              )}
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
                    onClick={() =>
                      setCareer((x) => ({
                        ...x,
                        collegeId: col.id,
                        stage: "college",
                        sp: x.sp + 20,
                        bp: addBP(x.bp, col.bonus),
                      }))
                    }
                  >
                    <strong>{col.name}</strong>
                    <em>{offered ? col.pitch : `No offer (needs ${col.needWins} HS wins)`}</em>
                  </button>
                );
              })}
            </div>
          ) : (
            seasonEnd()
          )}
        </article>

        <article className={styles.card}>
          <h2>Build</h2>
          <p className={styles.big}>
            {c.sp} <small>SP available</small>
          </p>
          <MenuButton onClick={() => setOverlay({ kind: "builder" })}>Upgrade attributes</MenuButton>
          <MenuButton onClick={() => setOverlay({ kind: "badges" })}>
            Badges · {Object.values(c.bp ?? emptyBP()).reduce((a, b) => a + b, 0)} BP
          </MenuButton>
          <p className={styles.small}>Wins +14 SP · losses +6 · practice +12</p>
        </article>

        {(c.stage === "pro" || offseason || c.flags.includes("retired")) && (
          <article className={styles.card} data-deal={deal?.brand ?? "none"}>
            <h2>Shoe Deal</h2>
            {deal ? (
              <>
                <div className={styles.dealHead}>
                  {deal.brand === "vanta" ? <VantaLogo size={40} /> : <VyroLogo size={40} />}
                  <div>
                    <strong>{BRANDS[deal.brand].name}</strong>
                    <small>{TIER_LABEL[deal.tier]}</small>
                  </div>
                </div>
                <SneakerArt colors={deal.shoeColors} mark={deal.brand} />
                <p className={styles.label}>{deal.shoe ?? "Player Edition"}</p>
                <p className={styles.small}>
                  ₵{deal.perGame}/game · {deal.royalty ? `${deal.royalty}% royalty · ` : ""}
                  {deal.years >= 99
                    ? "Lifetime"
                    : `${Math.max(0, deal.signed + deal.years - season)} season${deal.signed + deal.years - season === 1 ? "" : "s"} left`}
                  {(c.royalties ?? 0) > 0 && ` · ₵${(c.royalties ?? 0).toLocaleString()} in royalties`}
                </p>
              </>
            ) : (
              <p className={styles.small}>
                {c.stage === "pro" && c.week < 2
                  ? "VYRO and VANTA scouts are at your games. Your agent expects offers by week 2."
                  : "No sneaker deal. Win games and grow your fans; the brands will call back next season."}
              </p>
            )}
          </article>
        )}

        <article className={styles.card}>
          <h2>This week</h2>
          {c.activityDone ? (
            <p className={styles.small}>You've already made your move this week. Play the next game.</p>
          ) : (
            <div className={styles.acts}>
              <button onClick={() => activity("practice")}>🏀 Extra practice</button>
              <button onClick={() => activity("date")}>💬 Hang out with Jaailyah</button>
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
            {(c.stage === "college" || c.stage === "pro" || c.stage === "done" || offseason) && (
              <span>
                Jaailyah <b>{"♥".repeat(Math.min(5, c.love)) || "—"}</b>
                {c.flags.includes("married")
                  ? " (married)"
                  : c.flags.includes("engaged")
                    ? " (engaged)"
                    : c.flags.includes("together") && " (dating)"}
              </span>
            )}
            {c.earnings > 0 && (
              <span>
                Earnings <b>₵{c.earnings.toLocaleString()}</b>
              </span>
            )}
          </div>
        </article>

        {history.length > 0 && (
          <article className={styles.card} data-wide>
            <h2>
              Career · {rings} {rings === 1 ? "ring" : "rings"} · {mvps} MVP{mvps === 1 ? "" : "s"}
            </h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Team</th>
                  <th>W-L</th>
                  <th>Result</th>
                  <th>Awards</th>
                  <th>OVR</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const t = getTeam(h.teamId);
                  return (
                    <tr key={h.season}>
                      <td>{h.season}</td>
                      <td>
                        <span className={styles.dot} style={{ background: t.primary }} /> {t.city} {t.name}
                      </td>
                      <td>
                        {h.w}-{h.l}
                      </td>
                      <td>{RESULT_LABEL[h.result]}</td>
                      <td>{h.awards.join(", ") || "—"}</td>
                      <td>{h.ovr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </article>
        )}
        {(c.stage === "pro" || offseason) && team && (
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
