import { useEffect, useRef, useState } from "react";
import { Message, chatStream } from "./api";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const streaming = useRef(false);

  // refs for scrolling --------------------------------------------------
  const msgsContainerRef = useRef<HTMLDivElement>(null);
  const lastUserRef = useRef<HTMLDivElement>(null);
  // keep track whether we should auto-scroll (true when user at bottom)
  const autoScrollRef = useRef(true);

  async function send() {
    const content = input.trim();
    if (!content || streaming.current) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");

    // ensure we auto-scroll for the user's new message
    autoScrollRef.current = true;

    streaming.current = true;
    let assistantContent = "";

    try {
      for await (const chunk of chatStream(nextMessages)) {
        assistantContent += chunk;
        setMessages([
          ...nextMessages,
          { role: "assistant", content: assistantContent },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      streaming.current = false;
    }
  }

  // Auto-scroll when messages change, if allowed
  useEffect(() => {
    if (autoScrollRef.current && lastUserRef.current) {
      lastUserRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages]);

  // Detect user scroll position to enable / disable auto-scroll
  function handleScroll() {
    const container = msgsContainerRef.current;
    const anchor = lastUserRef.current;
    if (!container || !anchor) return;
    const anchorTop = anchor.offsetTop;
    const dist = Math.abs(container.scrollTop - anchorTop);
    autoScrollRef.current = dist < 100; // within 100px considered near anchor
  }

  return (
    <div className="chat">
      <div className="msgs" ref={msgsContainerRef} onScroll={handleScroll}>
        {messages.map((m, i) => {
          const isLastUser =
            m.role === "user" &&
            // check if there's no later user message
            messages.slice(i + 1).every((mm) => mm.role !== "user");
          return (
            <div
              key={i}
              className={`msg ${m.role}`}
              ref={isLastUser ? lastUserRef : undefined}
            >
              <div className="bubble">{m.content}</div>
            </div>
          );
        })}
      </div>

      <div className="inputRow">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Ask anything…"
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
