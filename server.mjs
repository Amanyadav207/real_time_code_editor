import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";

const server = http.createServer();
const wss = new WebSocketServer({ server });

const rooms = new Map();
const getRoom = (name) => {
  if (!rooms.has(name)) rooms.set(name, { doc: new Y.Doc(), clients: new Set() });
  return rooms.get(name);
};

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", "ws://localhost");
  const roomName = url.searchParams.get("room") || "default-room";
  const room = getRoom(roomName);

  room.clients.add(ws);
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  console.log(`[WS] 🔗 Connected → Room "${roomName}" | Total clients: ${room.clients.size}`);

  // Send current doc state to the new client
  const encoded = Y.encodeStateAsUpdate(room.doc);
  ws.send(Buffer.from(encoded));
  console.log(`[WS] 📤 Sent initial doc state (${encoded.byteLength} bytes)`);

  ws.on("message", (data) => {
    if (typeof data === "string") return; // ignore stray text messages
    const update = new Uint8Array(data);
    Y.applyUpdate(room.doc, update);

    // Broadcast to others
    room.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) client.send(update);
    });

    console.log(`[WS] 🔁 Update received from client (${update.byteLength} bytes) | Room: ${roomName}`);
  });

  ws.on("close", () => {
    room.clients.delete(ws);
    console.log(`[WS] ❌ Disconnected → Room "${roomName}" | Remaining: ${room.clients.size}`);
    if (room.clients.size === 0) rooms.delete(roomName);
  });

  ws.on("error", (err) => {
    console.error(`[WS] ⚠️ Error: ${err.message}`);
  });
});

// Heartbeat (keeps idle sockets alive)
const HEARTBEAT_MS = 60000;
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.warn("[WS] 💀 Terminating stale connection");
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(interval));

const PORT = 1234;
server.listen(PORT, () => {
  console.log(`🚀 Custom Yjs WS server running on ws://localhost:${PORT}`);
});
