import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { MonacoBinding } from "y-monaco";
import { connectYDoc } from "./ws-yjs"; // if you used the helper from earlier

const getRoom = () =>
  new URL(location.href).searchParams.get("room") || "default-room";

export default function App() {
  const room = useMemo(getRoom, []);
  const { ytext, ws } = useMemo(() => connectYDoc(room), [room]);
  const [connected, setConnected] = useState<boolean>(false);
  const editorRef = useRef<any>(null);

  // Track WS status (for the green/red dot)
  useEffect(() => {
    if (!ws) return;
    const handleOpen = () => setConnected(true);
    const handleClose = () => setConnected(false);
    const handleError = () => setConnected(false);

    ws.addEventListener("open", handleOpen);
    ws.addEventListener("close", handleClose);
    ws.addEventListener("error", handleError);

    return () => {
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("close", handleClose);
      ws.removeEventListener("error", handleError);
    };
  }, [ws]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    const model =
      editor.getModel() ??
      monaco.editor.createModel(
        "// Start typing and open this URL in another tab with the same ?room=...\n",
        "typescript"
      );

    new MonacoBinding(ytext, model, new Set([editor]), undefined);
    // optional editor options tweaks:
    editor.updateOptions({ fontSize: 14, minimap: { enabled: false } });
  };

  // Copy the current URL (includes ?room=…) so you can share
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      alert("Share link copied!");
    } catch {
      // fallback
      prompt("Copy this link:", location.href);
    }
  };

  // Clear the shared document
  const clearDoc = () => {
    const len = ytext.length;
    if (len > 0) ytext.delete(0, len);
  };

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">TinyCollab</span>

        <span className="kv">
          Room: <code>{room}</code>
        </span>

        <span className="kv">
          WS: <span className={`dot ${connected ? "ok" : "bad"}`} />
          {connected ? "connected" : "disconnected"}
        </span>

        <button className="btn secondary" onClick={copyLink}>
          Copy link
        </button>
        <button className="btn" onClick={clearDoc}>
          Clear doc
        </button>
      </div>

      <div className="editor-wrap">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          onMount={onMount}
          options={{ automaticLayout: true, minimap: { enabled: false } }}
        />
      </div>
    </div>
  );
}
