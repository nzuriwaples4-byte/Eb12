import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AssetImage } from "~/components/asset-image/asset-image";
import { GameView } from "~/components/game-view/game-view";
import { MenuButton } from "~/components/menu-button/menu-button";
import { Results } from "~/components/results/results";
import { BALLERS, getBaller, overall } from "~/data/characters";
import { CHAPTERS } from "~/data/story";
import { STREET_VENUES } from "~/data/venues";
import { NetLink, relayUrl } from "~/game/net";
import type { MatchResult } from "~/game/types";
import { unlockedBallers, useProgress } from "~/hooks/use-progress";
import { useSettings } from "~/hooks/use-settings";
import type { Route } from "./+types/online";
import play from "./play.module.css";
import styles from "./online.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Online — Concrete Crown" }];
}

type Lobby =
  | { kind: "menu" }
  | { kind: "connecting" }
  | { kind: "room"; link: NetLink; peer: string | null }
  | { kind: "playing"; link: NetLink; host: string; guest: string; venueId: string; target: number };

/** Flip a result so side 0 is "me" (the guest plays side 1) */
function mine(r: MatchResult, role: "host" | "guest"): MatchResult {
  if (role === "host") return r;
  return { winner: r.winner === 0 ? 1 : 0, score: [r.score[1], r.score[0]], stats: [r.stats[1], r.stats[0]] };
}

export default function Online() {
  const navigate = useNavigate();
  const [progress] = useProgress();
  const [settings] = useSettings();
  const unlocked = settings.unlockAll ? new Set(BALLERS.map((b) => b.id)) : unlockedBallers(progress, CHAPTERS);
  const [me, setMe] = useState("kairo");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [lobby, setLobby] = useState<Lobby>({ kind: "menu" });
  const [venue, setVenue] = useState(STREET_VENUES[0].id);
  const [target, setTarget] = useState(11);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [runId, setRunId] = useState(0);
  const [server, setServer] = useState("");
  useEffect(() => {
    try {
      setServer(localStorage.getItem("concrete-crown.relay") ?? relayUrl());
    } catch {
      setServer(relayUrl());
    }
  }, []);
  const meRef = useRef(me);
  meRef.current = me;

  const link = lobby.kind === "room" || lobby.kind === "playing" ? lobby.link : null;

  // Lobby messages: introductions, the host's start signal, disconnects
  useEffect(() => {
    if (!link) return;
    return link.on((m) => {
      if (m.t === "peer") link.send({ t: "hello", baller: meRef.current, name: getBaller(meRef.current).nickname });
      else if (m.t === "hello") setLobby((l) => (l.kind === "room" ? { ...l, peer: m.baller } : l));
      else if (m.t === "start") {
        // First start, or the host called a rematch
        setResult(null);
        setRunId((n) => n + 1);
        setLobby({ kind: "playing", link, host: m.host, guest: m.guest, venueId: m.venueId, target: m.target });
      } else if (m.t === "left") {
        setError("Your opponent left the game.");
        setLobby((l) => (l.kind === "room" ? { ...l, peer: null } : l));
      }
    });
  }, [link]);

  useEffect(() => () => link?.close(), [link]);

  const connect = async (host: boolean) => {
    setError("");
    setLobby({ kind: "connecting" });
    try {
      const url = server.trim() || relayUrl();
      try {
        localStorage.setItem("concrete-crown.relay", url);
      } catch {
        /* storage unavailable: just don't remember it */
      }
      const l = host ? await NetLink.host(url) : await NetLink.join(code, url);
      setLobby({ kind: "room", link: l, peer: null });
    } catch (e) {
      setError(`${(e as Error).message}. Check the online server address below.`);
      setLobby({ kind: "menu" });
    }
  };

  if (lobby.kind === "playing") {
    const role = lobby.link.role;
    const myId = role === "host" ? lobby.host : lobby.guest;
    const theirId = role === "host" ? lobby.guest : lobby.host;
    return (
      <GameView
        runId={runId}
        net={lobby.link}
        config={{
          playerId: lobby.host,
          opponentId: lobby.guest,
          venueId: lobby.venueId,
          target: lobby.target,
          difficulty: 1,
          useHiggsfield: settings.useHiggsfield,
          shadows: settings.shadows,
          cameraShake: settings.cameraShake,
          mode: role === "host" ? "online-host" : "online-guest",
        }}
        objective={`Online · room ${lobby.link.code} · you are ${getBaller(myId).nickname}`}
        onFinish={(r) => setResult(mine(r, role))}
        onQuit={() => {
          lobby.link.close();
          setResult(null);
          setLobby({ kind: "menu" });
        }}
        overlay={
          result && (
            <Results
              result={result}
              playerId={myId}
              opponentId={theirId}
              actions={
                <>
                  {role === "host" && (
                    <MenuButton
                      variant="primary"
                      autoFocus
                      onClick={() => {
                        setResult(null);
                        setRunId((n) => n + 1);
                        lobby.link.send({
                          t: "start",
                          venueId: lobby.venueId,
                          target: lobby.target,
                          host: lobby.host,
                          guest: lobby.guest,
                        });
                      }}
                    >
                      Rematch
                    </MenuButton>
                  )}
                  <MenuButton
                    onClick={() => {
                      lobby.link.close();
                      navigate("/");
                    }}
                  >
                    Main menu
                  </MenuButton>
                </>
              }
            />
          )
        }
      />
    );
  }

  const peer = lobby.kind === "room" ? lobby.peer : null;
  const role = lobby.kind === "room" ? lobby.link.role : null;
  return (
    <main className={play.page}>
      <header className={play.header}>
        <Link to="/play" className={play.back} data-pad-back>
          ← Quick Match
        </Link>
        <h1>Online</h1>
        <span className={play.record}>1v1 · host runs the game</span>
      </header>

      {lobby.kind === "room" ? (
        <section className={styles.room}>
          <div className={styles.code}>
            <small>{role === "host" ? "Room code: send this to your friend" : "Joined room"}</small>
            <strong>{lobby.link.code}</strong>
          </div>
          <div className={styles.versus}>
            <Card id={role === "host" ? me : (peer ?? "")} label={role === "host" ? "You (host)" : "Host"} />
            <span className={styles.vs}>VS</span>
            <Card id={role === "guest" ? me : (peer ?? "")} label={role === "guest" ? "You" : "Guest"} />
          </div>
          {role === "host" ? (
            <>
              <div className={play.chips}>
                {STREET_VENUES.map((v) => (
                  <button
                    key={v.id}
                    data-selected={venue === v.id}
                    onClick={() => setVenue(v.id)}
                    style={{ "--accent": v.accent } as React.CSSProperties}
                  >
                    {v.name}
                    <small>{v.timeOfDay}</small>
                  </button>
                ))}
              </div>
              <div className={play.chips}>
                {[11, 15, 21].map((t) => (
                  <button key={t} data-selected={target === t} onClick={() => setTarget(t)}>
                    Game to {t}
                  </button>
                ))}
              </div>
              <MenuButton
                variant="primary"
                disabled={!peer}
                onClick={() => {
                  const start = { t: "start" as const, venueId: venue, target, host: me, guest: peer! };
                  lobby.link.send(start);
                  setLobby({ kind: "playing", link: lobby.link, host: me, guest: peer!, venueId: venue, target });
                }}
              >
                {peer ? "Ball up ▶" : "Waiting for your friend…"}
              </MenuButton>
            </>
          ) : (
            <p className={styles.wait}>{peer ? "Waiting for the host to pick a court and start…" : "Connecting…"}</p>
          )}
          {error && <p className={styles.error}>{error}</p>}
          <MenuButton
            onClick={() => {
              lobby.link.close();
              setLobby({ kind: "menu" });
            }}
          >
            Leave room
          </MenuButton>
        </section>
      ) : (
        <>
          <section>
            <h2 style={{ color: getBaller(me).accent }}>Your baller · {getBaller(me).nickname}</h2>
            <div className={play.grid}>
              {BALLERS.map((b) => {
                const locked = !unlocked.has(b.id);
                return (
                  <button
                    key={b.id}
                    className={play.baller}
                    data-selected={me === b.id}
                    disabled={locked}
                    style={{ "--accent": b.accent } as React.CSSProperties}
                    onClick={() => setMe(b.id)}
                  >
                    <div className={play.face}>
                      <AssetImage
                        asset={b.portrait}
                        alt={b.name}
                        fallbackLabel={b.nickname}
                        accent={b.accent}
                        position="50% 20%"
                      />
                    </div>
                    <span className={play.nick}>{locked ? "LOCKED" : b.nickname}</span>
                    <span className={play.ovr}>{locked ? "Beat in story" : `OVR ${overall(b)}`}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <section className={styles.actions}>
            <div>
              <h3>Host a game</h3>
              <p>Get a 4-letter code and send it to a friend.</p>
              <MenuButton variant="primary" disabled={lobby.kind === "connecting"} onClick={() => connect(true)}>
                Create room
              </MenuButton>
            </div>
            <div>
              <h3>Join a game</h3>
              <p>Type the code your friend sent you.</p>
              <div className={styles.join}>
                <input
                  value={code}
                  maxLength={4}
                  placeholder="ABCD"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && code.length === 4 && connect(false)}
                  aria-label="Room code"
                />
                <MenuButton disabled={code.length !== 4 || lobby.kind === "connecting"} onClick={() => connect(false)}>
                  Join
                </MenuButton>
              </div>
            </div>
          </section>
          <section className={styles.server}>
            <label>
              Online server
              <input value={server} onChange={(e) => setServer(e.target.value)} spellCheck={false} />
            </label>
            <small>
              The desktop game runs a server on your PC (port 8787). On the same Wi-Fi, your friend enters
              ws://YOUR-PC-IP:8787. Over the internet, both players use a public relay (npm run relay on any server).
            </small>
          </section>
          {error && <p className={styles.error}>{error}</p>}
        </>
      )}
    </main>
  );
}

function Card({ id, label }: { id: string; label: string }) {
  if (!id)
    return (
      <div className={styles.card} data-empty>
        <small>{label}</small>
        <strong>…</strong>
      </div>
    );
  const b = getBaller(id);
  return (
    <div className={styles.card} style={{ "--accent": b.accent } as React.CSSProperties}>
      <div className={styles.face}>
        <AssetImage asset={b.portrait} alt={b.name} fallbackLabel={b.nickname} accent={b.accent} position="50% 20%" />
      </div>
      <small>{label}</small>
      <strong>{b.nickname}</strong>
    </div>
  );
}
