import { useEffect, useRef, useState } from "react";
import { HOMETOWN } from "~/data/career";
import type { CityTheme } from "~/data/cities";
import type { EblTeam } from "~/data/ebl";
import type { FlightPhase, FlightScene } from "~/game/flight";
import { useSettings } from "~/hooks/use-settings";
import styles from "./flight.module.css";

interface Props {
  from: CityTheme;
  to: CityTheme;
  team: EblTeam;
  /** Shown on the boarding pass, e.g. "Rookie" or "Free agent" */
  tag?: string;
  /** Dev: freeze on this second for screenshots */
  at?: number;
  onDone(): void;
}

/** The charter flight to your new home city, after the draft or a trade */
export function Flight({ from, to, team, tag = "Rookie", at, onDone }: Props) {
  const [settings] = useSettings();
  const ref = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<FlightPhase>("depart");
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const flightNo = `EB ${100 + ((team.id.charCodeAt(0) * 7 + team.id.charCodeAt(2)) % 900)}`;

  useEffect(() => {
    let scene: FlightScene | null = null;
    let cancelled = false;
    import("~/game/flight").then(({ FlightScene }) => {
      if (cancelled || !ref.current) return;
      scene = new FlightScene(
        ref.current,
        { from, to, livery: [team.primary, team.secondary], label: `${team.city} ${team.name}`, shadows: settings.shadows },
        { phase: setPhase, done: () => doneRef.current() },
      );
      if (at !== undefined) {
        scene.paused = true;
        scene.seek(at);
      }
      if (import.meta.env.DEV) (window as unknown as { __flight: FlightScene }).__flight = scene;
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") doneRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      scene?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.teamId, to.teamId, team.id, at]);

  const step = phase === "depart" ? 0 : phase === "cruise" ? 1 : 2;
  return (
    <div className={styles.root} style={{ "--team": team.primary, "--team2": team.secondary } as React.CSSProperties}>
      <canvas ref={ref} className={styles.canvas} />
      <div className={styles.letterbox} />
      <section className={styles.pass} aria-label="Boarding pass">
        <header>
          <span>EBL Charter</span>
          <b>{flightNo}</b>
        </header>
        <div className={styles.route}>
          <div>
            <strong>{from.airport}</strong>
            <small>
              {from.city}, {from.state}
            </small>
          </div>
          <div className={styles.track}>
            <i style={{ left: `${[8, 50, 92][step]}%` }}>✈</i>
          </div>
          <div>
            <strong>{to.airport}</strong>
            <small>
              {to.city}, {to.state}
            </small>
          </div>
        </div>
        <footer>
          <span>Passenger</span>
          <b>{team.city} {team.name} · {tag}</b>
        </footer>
      </section>
      <div className={styles.caption} key={phase}>
        {phase === "depart" && (
          <>
            <small>Wheels up</small>
            <h2>
              Departing {from.city}, {from.state}
            </h2>
          </>
        )}
        {phase === "cruise" && (
          <>
            <small>Cruising altitude · 36,000 ft</small>
            <h2>Next stop: your new home</h2>
          </>
        )}
        {phase === "arrive" && (
          <>
            <small>{to.tagline}</small>
            <h2>
              {to.teamId === HOMETOWN.teamId ? "Welcome home to" : "Welcome to"} {to.city}, {to.state}
            </h2>
            <p>
              Home of the {team.city} {team.name} — and home for the rest of your career.
            </p>
          </>
        )}
      </div>
      <button className={styles.skip} onClick={() => doneRef.current()}>
        Skip ▸
      </button>
    </div>
  );
}
