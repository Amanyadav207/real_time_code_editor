
import http from "http";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils.js";

const server = http.createServer();
const wss = new WebSocketServer({ server });

// Handle connections and hand them to y-websocket
wss.on("connection", (conn, req) => {
  // Optional: you can parse req.url here to inspect room name, etc.
  setupWSConnection(conn, req, { gc: true });
});

const PORT = 1234;
server.listen(PORT, () => {
  console.log(`y-websocket server running on ws://localhost:${PORT}`);
});
