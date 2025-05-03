import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import Chat from "./Chat";
import { Message } from "./api";

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

  return (
    <div className="appContainer">
      {/* --- main area ------------------------------------------------- */}
      <div className="main container">
        <h1 className="header">Agent flow</h1>
        <Chat
          key={activeId}
          sessionId={activeId}
          messages={activeSession.messages}
          setMessages={setActiveMessages}
        />
      </div>
    </div>
  );
}
