import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { VyroStore } from "~/components/vyro-store/vyro-store";
import { getBaller } from "~/data/characters";
import { cityFor } from "~/data/cities";
import { CHAPTERS } from "~/data/story";
import { getVenue } from "~/data/venues";
import { getAudio } from "~/game/audio";
import type { City, Poi, Resident } from "~/game/city";
import { PLACES } from "~/game/city-world";
import { readCareer, useCareer, type Career } from "~/hooks/use-career";
import { kairoLook, useProgress } from "~/hooks/use-progress";
import { useSettings } from "~/hooks/use-settings";
import type { Route } from "./+types/city";
import styles from "./city.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "The City — EBL 2" }];
}

const COURTS: { ballerId: string; venueId: string; x: number; z: number }[] = [
  { ballerId: "deuce", venueId: "pier-9", ...PLACES.courts[3] },
  { ballerId: "brick", venueId: "the-cage", ...PLACES.courts[2] },
  { ballerId: "silk", venueId: "neon-alley", ...PLACES.courts[0] },
  { ballerId: "queen", venueId: "queensway", ...PLACES.courts[1] },
];

/** Once you're drafted you live in your team's city until you retire */
function homeTeam(c: Career) {
  return c.teamId && (c.stage === "pro" || c.stage === "offseason" || c.stage === "done") ? c.teamId : null;
}

export default function CityRoute() {
  const navigate = useNavigate();
  const [progress] = useProgress();
  const [settings] = useSettings();
  const [career] = useCareer();
  const [params] = useSearchParams();
  const theme = cityFor(params.get("home") ?? homeTeam(career));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const cityRef = useRef<City | null>(null);
  const [prompt, setPrompt] = useState<Poi | null>(null);
  const [zone, setZone] = useState(theme.city);
  const [shop, setShop] = useState<false | "vyro" | "vanta">(false);
  const [ready, setReady] = useState(false);
  const look = kairoLook(progress);
  const lookKey = JSON.stringify(look);

  const next = CHAPTERS.find((c) => !progress.beaten.includes(c.id)) ?? CHAPTERS[CHAPTERS.length - 1];
  const leagueOpen = settings.unlockAll || progress.beaten.includes("ch5");

  const pois = useMemo<Poi[]>(
    () => [
      ...COURTS.map((c) => {
        const b = getBaller(c.ballerId);
        return {
          id: `court-${c.ballerId}`,
          kind: "court" as const,
          label: `${getVenue(c.venueId).name} Court`,
          action: `Run 1v1 vs ${b.nickname}`,
          x: c.x,
          z: c.z,
          r: 7,
          color: b.accent,
        };
      }),
      {
        id: "story",
        kind: "story",
        label: "Story",
        action: `Chapter ${next.number}: ${next.title}`,
        x: PLACES.story.x,
        z: PLACES.story.z,
        r: 3,
        color: "#ffc93a",
      },
      {
        id: "shop",
        kind: "shop",
        label: "VYRO Athletics",
        action: "Shop VYRO: Waples signature shoes & gear",
        x: PLACES.shop.x,
        z: PLACES.shop.z,
        r: 5,
        color: "#8b5cf6",
      },
      {
        id: "vanta",
        kind: "vanta",
        label: "VANTA",
        action: "Shop VANTA: Built different.",
        x: PLACES.vanta.x,
        z: PLACES.vanta.z,
        r: 5,
        color: "#f4f4f6",
      },
      {
        id: "crib",
        kind: "crib",
        label: "Harbor Loft",
        action: "Enter the Crib",
        x: PLACES.crib.x,
        z: PLACES.crib.z,
        r: 5,
        color: "#3ad7ff",
      },
      {
        id: "arena",
        kind: "arena",
        label: "EBL Arena",
        action: "EBL Career",
        x: PLACES.arena.x,
        z: PLACES.arena.z,
        r: 6,
        color: "#b88cff",
      },
      {
        id: "online",
        kind: "online",
        label: "Rec Center",
        action: "Co-op & Online",
        x: PLACES.rec.x,
        z: PLACES.rec.z,
        r: 5,
        color: "#ff8a3a",
      },
      {
        id: "roster",
        kind: "roster",
        label: "Hall of Fame",
        action: "View the roster",
        x: PLACES.fame.x,
        z: PLACES.fame.z,
        r: 5,
        color: "#e8ecf4",
      },
    ],
    [next.number, next.title, leagueOpen],
  );

  const residents: Resident[] = COURTS.map((c) => {
    const inward = Math.atan2(-c.x, -c.z);
    return { ballerId: c.ballerId, x: c.x - Math.sign(c.x) * 4.5, z: c.z, yaw: inward };
  });

  const onInteract = (p: Poi) => {
    getAudio().ensure();
    getAudio().play("confirm");
    if (p.kind === "court") {
      const c = COURTS.find((x) => `court-${x.ballerId}` === p.id)!;
      navigate(`/play?opp=${c.ballerId}&venue=${c.venueId}&auto=1&from=city`);
    } else if (p.kind === "story") navigate(`/story/${next.id}`);
    else if (p.kind === "shop") setShop("vyro");
    else if (p.kind === "vanta") setShop("vanta");
    else if (p.kind === "crib") navigate("/crib");
    else if (p.kind === "arena") navigate("/career");
    else if (p.kind === "online") navigate("/online");
    else if (p.kind === "roster") navigate("/roster");
  };
  const interactRef = useRef(onInteract);
  interactRef.current = onInteract;

  useEffect(() => {
    let cancelled = false;
    import("~/game/city").then(({ City }) => {
      if (cancelled || !canvasRef.current) return;
      cityRef.current = new City(
        canvasRef.current,
        { look, useHiggsfield: settings.useHiggsfield, shadows: settings.shadows, pois, residents, theme: cityFor(params.get("home") ?? homeTeam(readCareer())) },
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

  // Live-update Kairo's outfit when gear changes
  useEffect(() => {
    cityRef.current?.setLook(look);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey]);

  useEffect(() => {
    if (cityRef.current) cityRef.current.paused = !!shop;
  }, [shop]);

  return (
    <main className={styles.page}>
      <canvas ref={canvasRef} className={styles.canvas} />
      {!ready && (
        <div className={styles.loading}>
          Loading {theme.city}, {theme.state}…
        </div>
      )}
      <header className={styles.top}>
        <Link to="/" className={styles.menu}>
          ☰ Menu
        </Link>
        <div className={styles.zone}>
          <span>
            {theme.city}, {theme.state}
          </span>
          <strong>{zone}</strong>
        </div>
        <div className={styles.wallet}>₵ {(progress.crowns ?? 0).toLocaleString()}</div>
      </header>
      <canvas ref={mapRef} className={styles.minimap} width={180} height={180} />
      {prompt && !shop && (
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
      {shop && <VyroStore brand={shop} onClose={() => setShop(false)} />}
    </main>
  );
}
