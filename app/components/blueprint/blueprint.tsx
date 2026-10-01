import { Glyph } from "~/components/glyph/glyph";
import { useMemo, useState } from "react";
import {
  ATTRS,
  GROUPS,
  caps as capsFor,
  heightLabel,
  overallOf,
  startAttrs,
  type AttrGroup,
  type Attrs,
} from "~/data/attributes";
import { registerMyBaller, type Archetype, type MyPlayer } from "~/data/career";
import type { HairStyle } from "~/data/characters";
import { getAudio } from "~/game/audio";
import { ShowcaseCanvas } from "../showcase-canvas/showcase-canvas";
import styles from "./blueprint.module.css";

type Pos = "PG" | "SG" | "SF" | "PF" | "C";
type Skill = "Finishing" | "Shooting" | "Playmaking" | "Defense";

const POSITIONS: { id: Pos; label: string; min: number; max: number }[] = [
  { id: "PG", label: "Point Guard", min: 70, max: 77 },
  { id: "SG", label: "Shooting Guard", min: 74, max: 79 },
  { id: "SF", label: "Small Forward", min: 77, max: 82 },
  { id: "PF", label: "Power Forward", min: 79, max: 84 },
  { id: "C", label: "Center", min: 81, max: 88 },
];
const SKILLS: Skill[] = ["Finishing", "Shooting", "Playmaking", "Defense"];

const NAMES: Record<Pos, Record<Skill, string>> = {
  PG: { Finishing: "Launchpad", Shooting: "Splash Guard", Playmaking: "Maestro", Defense: "Pickpocket" },
  SG: { Finishing: "Blur", Shooting: "Microwave", Playmaking: "Combo Creator", Defense: "Hawk" },
  SF: {
    Finishing: "Wing Slasher",
    Shooting: "Three-Level Scorer",
    Playmaking: "Point Forward",
    Defense: "Two-Way Wing",
  },
  PF: { Finishing: "Rim Runner", Shooting: "Stretch Four", Playmaking: "Swiss Army", Defense: "Enforcer" },
  C: { Finishing: "Paint Beast", Shooting: "Stretch Big", Playmaking: "Hub", Defense: "Rim Protector" },
};

function archetypeFor(pos: Pos, skill: Skill): Archetype {
  const big = pos === "C" || pos === "PF";
  if (skill === "Finishing") return big ? "big" : "slasher";
  if (skill === "Shooting") return "sniper";
  if (skill === "Playmaking") return "floor-general";
  return big ? "big" : "lockdown";
}

function blurb(pos: Pos, skill: Skill, h: number) {
  const hl = heightLabel(h);
  const map: Record<Skill, string> = {
    Finishing: `A ${hl} attacker with a quick first step who lives at the rim and finishes through contact.`,
    Shooting: `A ${hl} shot-maker with a pure release. Give him a sliver of space and it's three points.`,
    Playmaking: `A ${hl} table-setter with a tight handle who sees passing lanes before they open.`,
    Defense: `A ${hl} stopper who takes the other team's best player and makes every catch a fight.`,
  };
  return map[skill] + (pos === "C" ? " Anchors the paint on both ends." : "");
}

const SKINS = ["#f0cfb0", "#e2b894", "#c68c63", "#a86f4c", "#8f5d3e", "#6b4430", "#4a2d20", "#3e2519"];
const HAIRS: { id: HairStyle; label: string }[] = [
  { id: "fade", label: "Fade" },
  { id: "twists", label: "Twists" },
  { id: "braids", label: "Braid" },
  { id: "afro-puff", label: "Afro Puff" },
  { id: "silver-part", label: "Middle Part" },
  { id: "shaved", label: "Shaved" },
  { id: "cap", label: "Snapback" },
];
const HAIR_COLORS = ["#140f0c", "#3a2a1c", "#7a4a22", "#d9dde6", "#e8c15a", "#2fc6ff"];

const BADGES: { name: string; attr: (typeof ATTRS)[number]["id"]; tiers: [number, number, number, number] }[] = [
  { name: "Posterizer", attr: "drivingDunk", tiers: [70, 78, 86, 93] },
  { name: "Acrobat", attr: "layup", tiers: [70, 78, 86, 93] },
  { name: "Deadeye", attr: "three", tiers: [70, 78, 86, 93] },
  { name: "Mid-Range Maestro", attr: "mid", tiers: [70, 78, 86, 93] },
  { name: "Ankle Breaker", attr: "handle", tiers: [72, 80, 87, 94] },
  { name: "Dimer", attr: "pass", tiers: [70, 78, 86, 93] },
  { name: "Clamps", attr: "perimeter", tiers: [70, 78, 86, 93] },
  { name: "Glove", attr: "steal", tiers: [70, 78, 86, 93] },
  { name: "Rim Protector", attr: "block", tiers: [70, 78, 86, 93] },
  { name: "Rebound Chaser", attr: "dreb", tiers: [70, 78, 86, 93] },
  { name: "Brick Wall", attr: "strength", tiers: [70, 78, 86, 93] },
  { name: "Lightning Launch", attr: "speed", tiers: [72, 80, 87, 94] },
];
const TIER = ["—", "Bronze", "Silver", "Gold", "Hall of Fame"];
const TIER_COLOR = ["#555", "#c98a4a", "#c9d3e8", "#ffd24a", "#b88cff"];

interface Props {
  onFinish(p: MyPlayer, attrs: Attrs): void;
  onBack(): void;
  /** Prefill from the Vitals step */
  initial?: { name: string; number: string; pos: Pos; hand: "R" | "L" };
}

/** 2K-style "Signature Blueprint" player creator with a live 3D preview */
export function Blueprint({ onFinish, onBack, initial }: Props) {
  const [posI, setPosI] = useState(
    Math.max(
      0,
      POSITIONS.findIndex((p) => p.id === initial?.pos),
    ),
  );
  const [skillI, setSkillI] = useState(0);
  const [tab, setTab] = useState<"attrs" | "badges" | "body">("attrs");
  const pos = POSITIONS[posI];
  const skill = SKILLS[skillI];
  const [height, setHeight] = useState(76);
  const h = Math.min(pos.max, Math.max(pos.min, height));
  const [name, setName] = useState(initial?.name ?? "Jordan Reed");
  const [nick, setNick] = useState("Launch");
  const [number, setNumber] = useState(initial?.number ?? "7");
  const [skin, setSkin] = useState(SKINS[5]);
  const [hair, setHair] = useState<HairStyle>("fade");
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0]);

  const arch = archetypeFor(pos.id, skill);
  const caps = useMemo(() => capsFor(arch, h), [arch, h]);
  const start = useMemo(() => startAttrs(arch, h), [arch, h]);
  const potential = overallOf(caps, arch);
  const weight = Math.round(165 + (h - 70) * 5.5 + (arch === "big" ? 25 : 0));
  const wingspan = h + (arch === "big" || arch === "lockdown" ? 5 : 3);

  const me: MyPlayer = {
    name,
    nickname: nick || name.split(" ")[0],
    archetype: arch,
    heightIn: h,
    skin,
    hair,
    hairColor,
    number,
    position: pos.id,
    hand: initial?.hand ?? "R",
  };
  const preview = useMemo(
    () =>
      registerMyBaller(
        me,
        { speed: 70, shooting: 70, three: 70, finishing: 70, dunk: 70, handles: 70, defense: 70, block: 70 },
        "#1f5a3c",
        "#f2f4f8",
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h, skin, hair, hairColor, number, arch],
  );
  const previewKey = `${h}-${skin}-${hair}-${hairColor}-${number}-${arch}`;

  const cycle = (set: (f: (n: number) => number) => void, len: number, d: number) => {
    getAudio().ensure();
    getAudio().play("click");
    set((n) => (n + d + len) % len);
  };

  const groupsOrder: AttrGroup[] = ["finishing", "shooting", "playmaking", "rebounding", "defense", "physicals"];

  return (
    <main className={styles.root}>
      <h1 className={styles.brand}>
        <span>EBL</span> × BUILDER
      </h1>
      <aside className={styles.left}>
        <h2>Signature Blueprint</h2>
        <div className={styles.picker}>
          <label>Position</label>
          <div>
            <button onClick={() => cycle(setPosI, POSITIONS.length, -1)}>◀</button>
            <strong>{pos.label}</strong>
            <button onClick={() => cycle(setPosI, POSITIONS.length, 1)}>▶</button>
          </div>
        </div>
        <div className={styles.picker}>
          <label>Best Skill</label>
          <div>
            <button onClick={() => cycle(setSkillI, SKILLS.length, -1)}>◀</button>
            <strong>{skill}</strong>
            <button onClick={() => cycle(setSkillI, SKILLS.length, 1)}>▶</button>
          </div>
        </div>
        <div className={styles.picker}>
          <label>Archetype</label>
          <div>
            <button onClick={() => cycle(setSkillI, SKILLS.length, -1)}>◀</button>
            <strong>{NAMES[pos.id][skill]}</strong>
            <button onClick={() => cycle(setSkillI, SKILLS.length, 1)}>▶</button>
          </div>
        </div>
        <p className={styles.blurb}>{blurb(pos.id, skill, h)}</p>
        <button className={styles.secondary} onClick={() => setTab("body")}>
          Customize Build
        </button>
        <button
          className={styles.finish}
          onClick={() => {
            getAudio().play("confirm");
            onFinish(me, start);
          }}
        >
          ⓧ Finish
        </button>
        <p className={styles.note}>
          <b>Note:</b> you start as a high-school senior. Win games and practice to earn Skill Points and grow toward
          these caps.
        </p>
        <button className={styles.back} onClick={onBack} data-pad-back>
          <Glyph action="back" /> Back
        </button>
      </aside>

      <section className={styles.center}>
        <nav className={styles.tabs}>
          {(
            [
              ["attrs", "Attributes"],
              ["badges", "Badges"],
              ["body", "Body & Look"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} data-active={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === "attrs" && (
          <>
            <h3 className={styles.sub}>Signature Blueprints</h3>
            <p className={styles.subText}>
              Filter by <b>Position</b> and <b>Best Skill</b> to find your <b>Archetype</b> and start your journey.
            </p>
            <div className={styles.grid}>
              {groupsOrder.map((g) => (
                <div key={g} className={styles.group} style={{ "--c": GROUPS[g].color } as React.CSSProperties}>
                  <h4>{GROUPS[g].label}</h4>
                  {ATTRS.filter((a) => a.group === g).map((a) => (
                    <div key={a.id} className={styles.row}>
                      <span>{a.label}</span>
                      <b>
                        {start[a.id]}
                        <i> / {caps[a.id]}</i>
                      </b>
                      <div className={styles.meter}>
                        <div className={styles.meterCap} style={{ width: `${caps[a.id]}%` }} />
                        <div className={styles.meterVal} style={{ width: `${start[a.id]}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "badges" && (
          <div className={styles.badges}>
            {BADGES.map((b) => {
              const cap = caps[b.attr];
              const tier = b.tiers.filter((t) => cap >= t).length;
              return (
                <div key={b.name} className={styles.badge} style={{ "--t": TIER_COLOR[tier] } as React.CSSProperties}>
                  <span className={styles.hex}>◆</span>
                  <strong>{b.name}</strong>
                  <em>Max tier: {TIER[tier]}</em>
                </div>
              );
            })}
          </div>
        )}
        {tab === "body" && (
          <div className={styles.body}>
            <label>
              Name <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Nickname <input value={nick} maxLength={14} onChange={(e) => setNick(e.target.value)} />
            </label>
            <label>
              Jersey #{" "}
              <input value={number} maxLength={2} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} />
            </label>
            <label>
              Height {heightLabel(h)}
              <input
                type="range"
                min={pos.min}
                max={pos.max}
                value={h}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </label>
            <div>
              <span>Skin tone</span>
              <div className={styles.swatches}>
                {SKINS.map((c) => (
                  <button
                    key={c}
                    style={{ background: c }}
                    data-on={skin === c}
                    onClick={() => setSkin(c)}
                    aria-label={`Skin ${c}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <span>Hair</span>
              <div className={styles.chips}>
                {HAIRS.map((x) => (
                  <button key={x.id} data-on={hair === x.id} onClick={() => setHair(x.id)}>
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span>Hair color</span>
              <div className={styles.swatches}>
                {HAIR_COLORS.map((c) => (
                  <button
                    key={c}
                    style={{ background: c }}
                    data-on={hairColor === c}
                    onClick={() => setHairColor(c)}
                    aria-label={`Hair ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className={styles.right}>
        <div className={styles.potential}>
          <span>Potential Overall</span>
          <strong>{potential}</strong>
        </div>
        <p className={styles.dims}>
          POS: <b>{pos.id}</b> / HT: <b>{heightLabel(h)}</b> / WT: <b>{weight} lbs</b> / WS:{" "}
          <b>{heightLabel(wingspan)}</b>
        </p>
        <div className={styles.stage}>
          <ShowcaseCanvas key={previewKey} ballers={[preview]} focusId={null} />
        </div>
        <p className={styles.tag}>{NAMES[pos.id][skill]}</p>
      </section>
    </main>
  );
}
