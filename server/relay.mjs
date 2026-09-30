// Concrete Crown online relay: pairs a host and a guest in a room and
// forwards their messages. The host's browser runs the match simulation;
// this server never inspects game traffic.
//
//   npm run relay            (PORT=8787 by default)
//   ws://host:8787/?create=1 → { t: "room", code }
//   ws://host:8787/?join=ABCD → both sides get { t: "peer" }
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8787);
const rooms = new Map(); // code -> { host, guest }
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  for (;;) {
    let c = "";
    for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
}

const send = (ws, msg) => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg));

const wss = new WebSocketServer({ port: PORT });
wss.on("connection", (ws, req) => {
  const q = new URL(req.url ?? "/", "http://x").searchParams;
  let code = null;
  let role = null;
  if (q.get("create")) {
    code = newCode();
    role = "host";
    rooms.set(code, { host: ws, guest: null });
    send(ws, { t: "room", code });
  } else if (q.get("join")) {
    code = q.get("join").toUpperCase();
    const room = rooms.get(code);
    if (!room) return (send(ws, { t: "error", msg: `No game with code ${code}` }), ws.close());
    if (room.guest) return (send(ws, { t: "error", msg: "That game is full" }), ws.close());
    role = "guest";
    room.guest = ws;
    send(ws, { t: "room", code });
    send(room.host, { t: "peer" });
    send(ws, { t: "peer" });
  } else {
    return ws.close();
  }

  ws.on("message", (data) => {
    const room = rooms.get(code);
    if (!room) return;
    const other = role === "host" ? room.guest : room.host;
    if (other && other.readyState === 1) other.send(data.toString());
  });
  ws.on("close", () => {
    const room = rooms.get(code);
    if (!room) return;
    const other = role === "host" ? room.guest : room.host;
    send(other, { t: "left" });
    if (role === "host") rooms.delete(code);
    else room.guest = null;
  });
});

console.log(`Concrete Crown relay listening on ws://0.0.0.0:${PORT}`);
