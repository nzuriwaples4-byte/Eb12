import { useSearchParams } from "react-router";
import { Dialogue } from "~/components/dialogue/dialogue";
import { RapBooth } from "~/components/rap-booth/rap-booth";
import { RAP_QUEST } from "~/data/rap";
import { SchoolSelect } from "~/components/school-select/school-select";
import {
  COLLEGES,
  DATES,
  dreCollege,
  FINALE,
  LIFE_EVENTS,
  PRESSERS,
  SCENES,
  registerMyBaller,
  sceneSet,
  type SceneCtx,
} from "~/data/career";
import { getTeam } from "~/data/ebl";
import { getChapter } from "~/data/story";
import { getVenue } from "~/data/venues";
import type { AssetId } from "~/data/higgsfield-assets";
import { getBaller } from "~/data/characters";

/** Dev-only: render any cutscene at a given line, for screenshots. */
export default function DevScene() {
  const [q] = useSearchParams();
  const at = Number(q.get("at") ?? 0);
  const ctx: SceneCtx = {
    me: {
      name: "Jordan Reed",
      nickname: "Launch",
      archetype: "slasher",
      heightIn: 77,
      skin: "#6b4430",
      hair: "fade",
      hairColor: "#140f0c",
      number: "7",
    },
    team: getTeam("hou"),
    college: COLLEGES[1],
    hsWins: 3,
    collegeWins: 3,
    pick: 3,
    wins: 8,
    losses: 3,
    fans: 40,
    love: 3,
  };
  const sk = q.get("s") ?? "";
  const colors =
    sk.startsWith("hs") || sk === "collegeOffers"
      ? ["#f2f4f8", "#8ec3ee"]
      : sk.startsWith("college")
        ? [ctx.college!.primary, ctx.college!.secondary]
        : [ctx.team!.primary, ctx.team!.secondary];
  registerMyBaller(
    ctx.me,
    { speed: 80, shooting: 75, three: 70, finishing: 82, dunk: 84, handles: 78, defense: 70, block: 60 },
    colors[0],
    colors[1],
  );
  const staged = q.get("flat") !== "1";
  const ch = q.get("ch");
  if (ch) {
    const c = getChapter(ch)!;
    const part = (q.get("part") ?? "intro") as "intro" | "win" | "lose";
    return (
      <Dialogue
        instant
        lines={c[part]}
        startAt={at}
        title={`Chapter ${c.number} · ${c.title}`}
        background={getBaller(c.opponentId).portrait as AssetId}
        backgroundTint={getVenue(c.venueId).accent}
        stage={staged ? { set: "court", venueId: c.venueId } : undefined}
        onDone={() => {}}
      />
    );
  }
  const s = q.get("s") ?? "hsIntro";
  const g = Number(q.get("g") ?? 0);
  if (s === "rap") {
    const n = Number(q.get("step") ?? 0);
    return (
      <RapBooth
        song={RAP_QUEST[n].song}
        artist={`LAUNCH · Mic Check ${n + 1}/${RAP_QUEST.length}`}
        demo={Number(q.get("demo") ?? 7)}
        onDone={() => {}}
      />
    );
  }
  if (s === "schools")
    return (
      <SchoolSelect
        colleges={COLLEGES}
        hsWins={Number(q.get("wins") ?? 2)}
        rivalId={dreCollege().id}
        onSign={() => {}}
      />
    );
  const lines =
    s === "hsWin"
      ? SCENES.hsWinAfter(ctx, g)
      : s === "hsLoss"
        ? SCENES.hsLoss(g)
        : s === "collegeAfter"
          ? SCENES.collegeAfter(ctx, g)
          : s === "collegeOffers"
            ? SCENES.collegeOffers(ctx)
            : s.startsWith("rapIntro")
              ? RAP_QUEST[Number(s.slice(8))].intro(ctx)
              : s.startsWith("rapAfter")
                ? RAP_QUEST[Number(s.slice(8))].after(ctx, 0.9)
                : s === "hsPregame" || s === "collegePregame"
                  ? SCENES[s](ctx)
                  : s === "hsIntro"
                    ? SCENES.hsIntro(ctx)
                    : s === "collegeIntro"
                      ? SCENES.collegeIntro(ctx)
                      : s === "draft"
                        ? SCENES.draft(ctx)
                        : s === "proIntro"
                          ? SCENES.proIntro(ctx)
                          : s === "champion"
                            ? FINALE.champion(ctx)
                            : s.startsWith("date")
                              ? DATES[Number(s.slice(4))](ctx)
                              : s.startsWith("press")
                                ? PRESSERS[Number(s.slice(5))](ctx)
                                : (LIFE_EVENTS.find((e) => e.id === s)?.lines(ctx) ?? []);
  return (
    <Dialogue
      instant
      lines={lines}
      startAt={at}
      title={q.get("title") ?? s}
      background={s === "draft" ? "key-art" : "city-aerial"}
      backgroundTint={ctx.team!.primary}
      chooser="me"
      names={{ me: "Jordan" }}
      stage={
        staged
          ? sceneSet(
              s.endsWith("Pregame")
                ? s
                : s.startsWith("rap")
                  ? RAP_QUEST[Number(s.slice(8))].venueId
                  : s.startsWith("hs") || s === "collegeOffers"
                    ? "hsIntro"
                    : s === "collegeAfter"
                      ? "collegeIntro"
                      : s,
              ctx,
            )
          : undefined
      }
      onDone={() => {}}
    />
  );
}
