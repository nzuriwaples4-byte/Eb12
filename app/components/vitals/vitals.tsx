import { Glyph } from "~/components/glyph/glyph";
import { useState } from "react";
import { HOMETOWN, registerMyBaller } from "~/data/career";
import { getAudio } from "~/game/audio";
import { GymStage } from "./gym-stage";
import styles from "./vitals.module.css";

export type Pos = "PG" | "SG" | "SF" | "PF" | "C";
const POS: { id: Pos; label: string }[] = [
  { id: "PG", label: "Point Guard" },
  { id: "SG", label: "Shooting Guard" },
  { id: "SF", label: "Small Forward" },
  { id: "PF", label: "Power Forward" },
  { id: "C", label: "Center" },
];

export interface VitalsData {
  first: string;
  last: string;
  pos: Pos;
  hand: "R" | "L";
  number: string;
}

interface Props {
  initial?: Partial<VitalsData>;
  onContinue(v: VitalsData): void;
  onBack(): void;
}

/** MyCareer step 1: name, position, handedness, jersey number */
export function Vitals({ initial, onContinue, onBack }: Props) {
  const [v, setV] = useState<VitalsData>({
    first: initial?.first ?? "",
    last: initial?.last ?? "",
    pos: initial?.pos ?? "SG",
    hand: initial?.hand ?? "R",
    number: initial?.number ?? "5",
  });
  const [focus, setFocus] = useState(0);
  const set = (p: Partial<VitalsData>) => setV((x) => ({ ...x, ...p }));
  const ready = v.first.trim().length > 0 && v.last.trim().length > 0 && v.number !== "";
  const cyclePos = (d: number) => {
    getAudio().ensure();
    getAudio().play("click");
    const i = POS.findIndex((p) => p.id === v.pos);
    set({ pos: POS[(i + d + POS.length) % POS.length].id });
  };

  // Home whites with the jersey number, so the preview updates as you type
  registerMyBaller(
    {
      name: `${v.first} ${v.last}`,
      nickname: v.last || "Rookie",
      archetype: "slasher",
      heightIn: v.pos === "C" ? 83 : v.pos === "PF" ? 81 : v.pos === "SF" ? 79 : v.pos === "SG" ? 77 : 74,
      skin: "#6b4430",
      hair: "fade",
      hairColor: "#140f0c",
      number: v.number || "0",
    },
    { speed: 60, shooting: 60, three: 60, finishing: 60, dunk: 60, handles: 60, defense: 60, block: 60 },
    "#f2f4f8",
    "#c21d2a",
  );

  const rows: [string, React.ReactNode][] = [
    [
      "First name",
      <input
        key="f"
        value={v.first}
        maxLength={14}
        placeholder="NEXT GEN"
        onFocus={() => setFocus(0)}
        onChange={(e) => set({ first: e.target.value.toUpperCase() })}
      />,
    ],
    [
      "Last name",
      <input
        key="l"
        value={v.last}
        maxLength={16}
        placeholder="EBL BUILDER"
        onFocus={() => setFocus(1)}
        onChange={(e) => set({ last: e.target.value.toUpperCase() })}
      />,
    ],
    [
      "Position",
      <div key="p" className={styles.cycle} onClick={() => setFocus(2)}>
        <button onClick={() => cyclePos(-1)}>◀</button>
        <span>{POS.find((p) => p.id === v.pos)!.label}</span>
        <button onClick={() => cyclePos(1)}>▶</button>
      </div>,
    ],
    [
      "Handedness",
      <div key="h" className={styles.cycle} onClick={() => setFocus(3)}>
        <button onClick={() => set({ hand: v.hand === "R" ? "L" : "R" })}>◀</button>
        <span>{v.hand === "R" ? "Right" : "Left"}</span>
        <button onClick={() => set({ hand: v.hand === "R" ? "L" : "R" })}>▶</button>
      </div>,
    ],
    [
      "Jersey number",
      <input
        key="n"
        value={v.number}
        maxLength={2}
        onFocus={() => setFocus(4)}
        onChange={(e) => set({ number: e.target.value.replace(/\D/g, "") })}
      />,
    ],
    [
      "Hometown",
      <div key="ht" className={styles.cycle} onClick={() => setFocus(5)}>
        <span>
          {HOMETOWN.city}, {HOMETOWN.state}
        </span>
      </div>,
    ],
  ];

  return (
    <main className={styles.root}>
      <GymStage actorKey={`${v.pos}-${v.number}`} />
      <header className={styles.brand}>
        <span className={styles.logo}>
          <b>MP</b>×<i>EBL</i>
          <small>BUILDER</small>
        </span>
        <strong>VITALS</strong>
      </header>
      <aside className={styles.panel}>
        <h2>Vitals</h2>
        {rows.map(([label, field], i) => (
          <div key={label} className={styles.field} data-focus={focus === i}>
            <label>{label}</label>
            {field}
          </div>
        ))}
        <button
          className={styles.continue}
          disabled={!ready}
          onClick={() => {
            getAudio().play("confirm");
            onContinue(v);
          }}
        >
          Continue
        </button>
        <button className={styles.back} onClick={onBack} data-pad-back>
          <Glyph action="back" /> Back
        </button>
      </aside>
      <p className={styles.mark}>EBL 2</p>
    </main>
  );
}
