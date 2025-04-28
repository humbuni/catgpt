import { useEffect, useRef, useState } from "react";
import { Message, chat, FlowResponse } from "./api";

// Renderer for a linear flow of agents
function FlowRenderer({ flow }: { flow: FlowResponse }) {
  return (
    <div className="w-100">
      {flow.agents.map((agent, idx) => (
        <div key={idx} className="card mb-3">
          <div className="card-header">
            {agent.name} <small className="text-muted">({agent.type})</small>
          </div>
          <div className="card-body">
            <p><strong>Instructions:</strong> {agent.instructions}</p>
            <p><strong>Input Schema:</strong></p>
            <pre className="bg-light border rounded p-2">{JSON.stringify(agent.input_schema, null, 2)}</pre>
            <p><strong>Output Schema:</strong></p>
            <pre className="bg-light border rounded p-2">{JSON.stringify(agent.output_schema, null, 2)}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}

export interface ChatProps {
  sessionId: string;
  messages: Message[];
  setMessages: (msgs: Message[]) => void;
}

export default function Chat({ sessionId, messages, setMessages }: ChatProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // refs for scrolling --------------------------------------------------
  const msgsContainerRef = useRef<HTMLDivElement>(null);
  const lastUserRef = useRef<HTMLDivElement>(null);
  // keep track whether we should auto-scroll (true when user at bottom)
  const autoScrollRef = useRef(true);

  async function send() {
    const content = input.trim();
    if (!content || loading) return;

    const userMessage: Message = { role: "user", content };
    const baseMessages = [...messages, userMessage];
    setMessages(baseMessages);
    setInput("");
    // ensure we auto-scroll for the user's new message
    autoScrollRef.current = true;

    setLoading(true);
    try {
      const flow = await chat(sessionId, userMessage);
      setMessages([
        ...baseMessages,
        { role: "assistant", content: flow },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
    <div className="chat d-flex flex-column flex-grow-1">
      <div className="msgs overflow-auto flex-grow-1 p-3 bg-light rounded" ref={msgsContainerRef} onScroll={handleScroll}>
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
              {m.role === "assistant" && typeof m.content !== "string" ? (
                <FlowRenderer flow={m.content} />
              ) : (
                <div className="bubble">{m.content}</div>
              )}
            </div>
          );
        })}
        {loading && (
          <div key="loading" className="msg assistant">
            <div className="bubble">
              <span className="thinking">🤔</span>
            </div>
          </div>
        )}
      </div>

      <div className="inputRow">
        <div className="input-group flex-grow-1 align-items-end">
          <textarea
            className="form-control"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask anything…"
            rows={2}
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={send}
            disabled={loading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
