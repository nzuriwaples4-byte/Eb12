import { useEffect, useMemo, useState } from "react";
import { ATTRS, GROUPS, heightLabel, overallOf, upgradeCost, type AttrId, type Attrs } from "~/data/attributes";
import { ARCHETYPES, type Archetype } from "~/data/career";
import { getAudio } from "~/game/audio";
import styles from "./attribute-builder.module.css";

interface Props {
  name: string;
  nickname: string;
  archetype: Archetype;
  heightIn: number;
  attrs: Attrs;
  caps: Attrs;
  sp: number;
  title?: string;
  /** Called with the new attributes and SP spent */
  onConfirm(next: Attrs, spent: number): void;
  onClose?(): void;
}

/** 2K-style attribute upgrade screen */
export function AttributeBuilder({
  name,
  nickname,
  archetype,
  heightIn,
  attrs,
  caps,
  sp,
  title = "Attribute Upgrades",
  onConfirm,
  onClose,
}: Props) {
  const [pending, setPending] = useState<Attrs>(attrs);
  const [sel, setSel] = useState(0);
  useEffect(() => setPending(attrs), [attrs]);

  const spent = useMemo(() => {
    let total = 0;
    for (const a of ATTRS) for (let v = attrs[a.id]; v < pending[a.id]; v++) total += upgradeCost(v);
    return total;
  }, [attrs, pending]);
  const left = sp - spent;
  const ovr = overallOf(pending, archetype);
  const maxOvr = overallOf(caps, archetype);

  const bump = (id: AttrId, dir: 1 | -1) => {
    setPending((p) => {
      const v = p[id];
      if (dir > 0) {
        if (v >= caps[id] || upgradeCost(v) > left) {
          getAudio().play("block");
          return p;
        }
        getAudio().play("click");
        return { ...p, [id]: v + 1 };
      }
      if (v <= attrs[id]) return p;
      getAudio().play("click");
      return { ...p, [id]: v - 1 };
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const id = ATTRS[sel].id;
      if (e.code === "ArrowRight" || e.code === "KeyD") setSel((s) => Math.min(ATTRS.length - 1, s + 1));
      else if (e.code === "ArrowLeft" || e.code === "KeyA") setSel((s) => Math.max(0, s - 1));
      else if (e.code === "ArrowUp" || e.code === "KeyW") bump(id, 1);
      else if (e.code === "ArrowDown" || e.code === "KeyS") bump(id, -1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, left, pending]);

  const selAttr = ATTRS[sel];

  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <h2>
            <span className={styles.logo}>EBL</span> {title}
          </h2>
          <p>
            ⓘ Earn <strong>SKILL POINTS</strong> from games and practice to upgrade toward your max caps.
          </p>
        </div>
        <div className={styles.ovr}>
          <strong>{ovr}</strong>
          <span>{maxOvr} MAX</span>
        </div>
        <div className={styles.card}>
          <p>
            HT <b>{heightLabel(heightIn)}</b> <i>|</i> {ARCHETYPES[archetype].label.toUpperCase()}
          </p>
          <p>
            {name} <i>|</i> <b>“{nickname}”</b>
          </p>
          <p className={styles.sp}>
            SP <b>{left}</b>
          </p>
        </div>
      </header>

      <div className={styles.bars} role="listbox" aria-label="Attributes">
        {ATTRS.map((a, i) => {
          const g = GROUPS[a.group];
          const cur = attrs[a.id];
          const next = pending[a.id];
          const cap = caps[a.id];
          const firstOfGroup = i === 0 || ATTRS[i - 1].group !== a.group;
          return (
            <button
              key={a.id}
              className={styles.bar}
              data-sel={i === sel}
              data-gap={firstOfGroup && i > 0}
              style={{ "--c": g.color, "--g": g.glow } as React.CSSProperties}
              onClick={() => {
                setSel(i);
                bump(a.id, 1);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setSel(i);
                bump(a.id, -1);
              }}
              aria-label={`${a.label} ${next} of ${cap}`}
            >
              <span className={styles.cap}>
                <b>{cap}</b>
                <small>Max</small>
              </span>
              <span className={styles.track}>
                <span className={styles.empty} style={{ height: `${100 - cap}%` }} />
                <span className={styles.pending} style={{ height: `${next}%` }} />
                <span className={styles.fill} style={{ height: `${cur}%` }} />
                <span className={styles.label}>{a.label}</span>
              </span>
              <span className={styles.val}>{next}</span>
            </button>
          );
        })}
      </div>

      <footer className={styles.foot}>
        <div className={styles.detail} style={{ "--c": GROUPS[selAttr.group].color } as React.CSSProperties}>
          <span>{GROUPS[selAttr.group].label}</span>
          <strong>{selAttr.label}</strong>
          <em>
            {pending[selAttr.id]} / {caps[selAttr.id]} · next point costs {upgradeCost(pending[selAttr.id])} SP
          </em>
        </div>
        <p className={styles.help}>← → select · ↑ upgrade · ↓ undo · click to upgrade, right-click to undo</p>
        <div className={styles.actions}>
          {onClose && (
            <button className={styles.ghost} onClick={onClose}>
              Back
            </button>
          )}
          <button className={styles.ghost} onClick={() => setPending(attrs)} disabled={!spent}>
            Reset
          </button>
          <button
            className={styles.confirm}
            disabled={!spent}
            onClick={() => {
              getAudio().play("confirm");
              onConfirm(pending, spent);
            }}
          >
            Confirm ({spent} SP)
          </button>
        </div>
      </footer>
    </section>
  );
}
