import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Dialogue } from "~/components/dialogue/dialogue";
import { toRatings } from "~/data/attributes";
import { HS_GAMES, registerMyBaller } from "~/data/career";
import "~/data/cast";
import { getBaller } from "~/data/characters";
import type { Line } from "~/data/story";
import { getAudio } from "~/game/audio";
import { CAMPUS } from "~/game/campus-world";
import type { City, Poi, Resident } from "~/game/city";
import { useCareer } from "~/hooks/use-career";
import { useProgress } from "~/hooks/use-progress";
import { useSettings } from "~/hooks/use-settings";
import type { Route } from "./+types/campus";
import styles from "./city.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Peachtree Heights High — EBL 2" }];
}

const D = CAMPUS.doors;

/** Free-roam Peachtree Heights High (Atlanta) between games in the high-school chapter */
export default function CampusRoute() {
  const navigate = useNavigate();
  const [career] = useCareer();
  const [progress] = useProgress();
  const [settings] = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const cityRef = useRef<City | null>(null);
  const [prompt, setPrompt] = useState<Poi | null>(null);
  const [zone, setZone] = useState("Peachtree Heights High");
  const [ready, setReady] = useState(false);
  const [talk, setTalk] = useState<{ title: string; lines: Line[] } | null>(null);

  // Your created player in the Panthers' home whites
  const me = career.me;
  if (me && career.attrs) registerMyBaller(me, toRatings(career.attrs), "#f2f4f8", "#8ec3ee");
  const look = me ? getBaller("me").look : null;
  const first = me?.name.split(" ")[0] ?? "Rookie";
  const game = HS_GAMES[Math.min(career.hsGame, HS_GAMES.length - 1)];
  const championship = career.hsGame >= 2;

  const pois = useMemo<Poi[]>(
    () => [
      {
        id: "gym",
        kind: "door",
        label: "Panthers Gymnasium",
        action: career.hsGame < HS_GAMES.length ? `Play: ${game.label}` : "Season's over. Shoot around",
        ...D.gym,
        r: 5,
        color: "#8ec3ee",
      },
      {
        id: "weights",
        kind: "door",
        label: "Weight Room",
        action: "Upgrade your attributes",
        ...D.weights,
        r: 4,
        color: "#ffd24a",
      },
      {
        id: "coach",
        kind: "door",
        label: "Coach Bell's Office",
        action: "Practice (+12 SP)",
        ...D.coach,
        r: 4,
        color: "#6ddc9a",
      },
      {
        id: "classes",
        kind: "door",
        label: "Main Entrance",
        action: "Talk to Jaailyah",
        ...D.classes,
        r: 5,
        color: "#ff9ec7",
      },
      {
        id: "courts",
        kind: "door",
        label: "Outdoor Courts",
        action: "Pickup run with classmates (+SP)",
        ...D.courts,
        r: 5,
        color: "#ff8a3a",
      },
      { id: "lot", kind: "door", label: "Student Parking", action: "Talk to Zay", ...D.lot, r: 4, color: "#e8742a" },
      { id: "bus", kind: "door", label: "Bus Stop", action: "Leave campus", ...D.bus, r: 4, color: "#e8ecf4" },
    ],
    [career.hsGame, game.label],
  );

  const residents: Resident[] = [
    { ballerId: "cast-jaailyah", x: D.classes.x + 3, z: D.classes.z + 1.5, yaw: Math.PI * 0.9, noBall: true },
    { ballerId: "rival-dre", x: D.lot.x + 3.5, z: D.lot.z + 3, yaw: -Math.PI * 0.75, noBall: true },
    { ballerId: "cast-teammate", x: CAMPUS.courts.x - 6, z: CAMPUS.courts.z + 3, yaw: Math.PI / 2 },
    { ballerId: "hs-westside", x: CAMPUS.courts.x + 7, z: CAMPUS.courts.z - 5, yaw: -Math.PI / 2 },
    { ballerId: "cast-hscoach", x: D.coach.x + 2.5, z: D.coach.z - 0.5, yaw: Math.PI, noBall: true },
  ];

  const onInteract = (p: Poi) => {
    getAudio().ensure();
    getAudio().play("confirm");
    if (p.id === "gym") navigate("/career?go=game");
    else if (p.id === "weights") navigate("/career?go=build");
    else if (p.id === "coach" || p.id === "courts") navigate("/career?go=practice");
    else if (p.id === "classes")
      setTalk({
        title: "Main Entrance",
        lines: [
          { who: "imani", text: `Hey, ${first}. You're late for chemistry. Again.` },
          {
            who: "imani",
            text: championship
              ? "Everyone's talking about you and my brother on Friday. You nervous?"
              : "Walk me to the library?",
            choices: [
              {
                text: "Only if you're in the stands.",
                reply: [{ who: "imani", text: "Front row. With a sign. A big one." }],
              },
              { text: "Let's go. Chemistry can wait.", reply: [{ who: "imani", text: "It really can't. But okay." }] },
            ],
          },
        ],
      });
    else if (p.id === "lot")
      setTalk({
        title: "Student Parking",
        lines: [
          {
            who: "dre",
            text: championship
              ? "Friday. City Championship. Bring your whole family to watch."
              : "Nice car? Oh wait, you take the bus.",
          },
          { who: "dre", text: "And stay away from my sister." },
        ],
      });
    else if (p.id === "bus") navigate("/career");
  };
  const interactRef = useRef(onInteract);
  interactRef.current = onInteract;

  useEffect(() => {
    let cancelled = false;
    import("~/game/city").then(({ City }) => {
      if (cancelled || !canvasRef.current) return;
      cityRef.current = new City(
        canvasRef.current,
        {
          look,
          useHiggsfield: false,
          shadows: settings.shadows,
          pois,
          residents,
          world: "campus",
          spawn: CAMPUS.spawn,
        },
        { prompt: setPrompt, interact: (p) => interactRef.current(p), zone: setZone },
        mapRef.current,
      );
      if (import.meta.env.DEV) (window as unknown as { __city: City }).__city = cityRef.current;
      setReady(true);
    });
    return () => {
      cancelled = true;
      cityRef.current?.dispose();
      cityRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cityRef.current) cityRef.current.paused = !!talk;
  }, [talk]);

  return (
    <main className={styles.page}>
      <canvas ref={canvasRef} className={styles.canvas} />
      {!ready && <div className={styles.loading}>Loading Peachtree Heights High…</div>}
      <header className={styles.top}>
        <Link to="/career" className={styles.menu}>
          ← Career
        </Link>
        <div className={styles.zone}>
          <span>Peachtree Heights High · Atlanta, GA</span>
          <strong>{zone}</strong>
        </div>
        <div className={styles.wallet}>₵ {(progress.crowns ?? 0).toLocaleString()}</div>
      </header>
      <canvas ref={mapRef} className={styles.minimap} width={180} height={180} />
      {prompt && !talk && (
        <button
          className={styles.prompt}
          style={{ "--accent": prompt.color } as React.CSSProperties}
          onClick={() => onInteract(prompt)}
        >
          <kbd>E</kbd>
          <span>
            <small>{prompt.label}</small>
            {prompt.action}
          </span>
        </button>
      )}
      <p className={styles.help}>WASD move · Shift sprint · drag / Q R to turn camera · E interact</p>
      {talk && (
        <>
          <Dialogue
            lines={talk.lines}
            title={talk.title}
            chooser="me"
            names={{ me: first }}
            stage={{ set: "court", venueId: "hs-gym" }}
            onDone={() => setTalk(null)}
          />
        </>
      )}
    </main>
  );
}
