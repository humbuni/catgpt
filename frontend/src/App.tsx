import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import React from "react";
import Chat from "./Chat";
import { Message, run } from "./api";

interface Session {
  id: string;
  messages: Message[];
}

export default function App() {
  // ----- UI state ----------------------------------------------------
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ----- sessions ----------------------------------------------------
  const [sessions, setSessions] = useState<Session[]>(() => [
    { id: nanoid(), messages: [] },
  ]);
  const [activeId, setActiveId] = useState<string>(sessions[0].id);

  // keep active session object handy
  const activeSession = sessions.find((s) => s.id === activeId)!;

  // helper to update messages for active session
  const setActiveMessages = (msgs: Message[]) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeId ? { ...s, messages: msgs } : s)),
    );
  };

  // new chat handler
  const newChat = () => {
    const id = nanoid();
    setSessions((prev) => [...prev, { id, messages: [] }]);
    setActiveId(id);
    // keep sidebar state unchanged (no auto-collapse)
  };

  // basic title for each session is first user message or "New Chat"
  const sessionTitle = (sess: Session): string => {
    const firstUser = sess.messages.find((m) => m.role === "user");
    return firstUser ? firstUser.content.slice(0, 30) : "New Chat";
  };

  // close sidebar when window width small after selecting session
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 600) setSidebarOpen(false);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // State for streamed run messages
  const [runMessages, setRunMessages] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Handler for Run button
  const handleRun = async () => {
    setRunMessages([]);
    setIsRunning(true);
    const response = await run();
    if (!response.body) {
      setIsRunning(false);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          setRunMessages((prev) => [...prev, line.replace("data: ", "").trim()]);
        }
      }
    }
    setIsRunning(false);
  };

  return (
    <div className="appContainer">
      {/* --- sidebar -------------------------------------------------- */}
      <div className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <button
          className="collapseBtn"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? "❮" : "❯"}
        </button>

        {sidebarOpen && (
          <>
            <button className="newChatBtn" onClick={newChat} aria-label="New chat">
              ➕ New Chat
            </button>
            <ul className="sessionList">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className={s.id === activeId ? "active" : undefined}
                  onClick={() => setActiveId(s.id)}
                >
                  {sessionTitle(s)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* --- main area ------------------------------------------------- */}
      <div className="main container">
        <h1 className="header">🐱 CatGPT</h1>
        {/* Run button and streamed output moved to Chat */}
        <Chat
          key={activeId}
          sessionId={activeId}
          messages={activeSession.messages}
          setMessages={setActiveMessages}
          runMessages={runMessages}
          isRunning={isRunning}
          handleRun={handleRun}
        />
      </div>
    </div>
  );
}
