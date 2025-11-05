import * as Y from "yjs";

type WSState = {
  ydoc: Y.Doc;
  ytext: Y.Text;
  open: () => void;
  ws: WebSocket | null;
};

export function connectYDoc(room: string): WSState {
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText("monaco");

  let ws: WebSocket | null = null;
  let backoff = 500;
  const MAX_BACKOFF = 8000;
  const queue: Uint8Array[] = [];

  const send = (u: Uint8Array) => {
    // queue until socket is open
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      queue.push(u);
      console.log(`[CL] queueing update (${u.byteLength} bytes), q=${queue.length}`);
      return;
    }
    ws.send(u);
    console.log(`[CL] sent update (${u.byteLength} bytes)`);
  };

  // send local Yjs updates
  ydoc.on("update", (u: Uint8Array) => {
    send(u);
  });

  const open = () => {
    const url = `ws://127.0.0.1:1234/?room=${encodeURIComponent(room)}`;
    ws = new WebSocket(url);
    ws.binaryType = "arraybuffer"; // ensures ArrayBuffer, not Blob

    ws.onopen = () => {
      console.log("[CL] ✅ WS open");
      backoff = 500;
      // flush any queued updates
      while (queue.length && ws?.readyState === WebSocket.OPEN) {
        const u = queue.shift()!;
        ws.send(u);
        console.log(`[CL] flushed (${u.byteLength} bytes), q=${queue.length}`);
      }
    };

    ws.onmessage = async (e: MessageEvent) => {
      // Some browsers deliver Blob if binaryType wasn't set early enough; be safe:
      const data =
        e.data instanceof ArrayBuffer
          ? new Uint8Array(e.data)
          : e.data instanceof Blob
          ? new Uint8Array(await e.data.arrayBuffer())
          : new Uint8Array(); // ignore text frames

      if (data.byteLength > 0) {
        console.log(`[CL] 📥 apply update (${data.byteLength} bytes)`);
        Y.applyUpdate(ydoc, data);
      }
    };

    ws.onclose = (ev) => {
      console.warn(`[CL] ❌ WS closed code=${ev.code} reason="${ev.reason}"`);
      setTimeout(open, (backoff = Math.min(backoff * 2, MAX_BACKOFF)));
    };

    ws.onerror = (err) => {
      console.error("[CL] ⚠️ WS error", err);
      try { ws?.close(); } catch {}
    };
  };

  open();

  return { ydoc, ytext, open, ws };
}
