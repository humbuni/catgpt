import { useEffect, useRef, useState, useId } from "react";
import { Message, chat, FlowResponse } from "./api";

// Renderer for a linear flow of agents
function FlowRenderer({ flow }: { flow: FlowResponse }) {
  const uniquePrefix = useId();
  return (
    <div className="accordion" id={`flowAccordion-${uniquePrefix}`}>
      {flow.agents.map((agent, idx) => (
        <div key={idx} className="accordion-item">
          <h2 className="accordion-header" id={`heading-${uniquePrefix}-${idx}`}>
            <button
              className="accordion-button"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target={`#collapse-${uniquePrefix}-${idx}`}
              aria-expanded="true"
              aria-controls={`collapse-${uniquePrefix}-${idx}`}
            >
              {agent.name} <span className="badge bg-secondary ms-2">{agent.type}</span>
            </button>
          </h2>
          <div
            id={`collapse-${uniquePrefix}-${idx}`}
            className="accordion-collapse collapse"
            aria-labelledby={`heading-${uniquePrefix}-${idx}`}
            data-bs-parent={`#flowAccordion-${uniquePrefix}`}
          >
            <div className="accordion-body">
              <h6>Instructions</h6>
              <p>{agent.instructions}</p>
              {/* <button
                className="btn btn-outline-primary btn-sm me-2"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#inputSchema-${idx}`}
                aria-expanded="false"
                aria-controls={`inputSchema-${idx}`}
              >
                View Input Schema
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#outputSchema-${idx}`}
                aria-expanded="false"
                aria-controls={`outputSchema-${idx}`}
              >
                View Output Schema
              </button>
              <div className="collapse mt-2" id={`inputSchema-${idx}`}>
                <pre className="bg-light border rounded p-2">{JSON.stringify(JSON.parse(agent.input_schema), null, 2)}</pre>
              </div>
              <div className="collapse mt-2" id={`outputSchema-${idx}`}>
                <pre className="bg-light border rounded p-2">{JSON.stringify(JSON.parse(agent.output_schema), null, 2)}</pre>
              </div> */}
            </div>
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
    <div className="container chat d-flex flex-column flex-grow-1 vh-100">
      <div className="row flex-grow-1 overflow-hidden">
        <div className="col">
          <div
            className="msgs overflow-auto flex-grow-1 p-3 bg-light rounded"
            ref={msgsContainerRef}
            onScroll={handleScroll}
          >
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
                  {m.role === "assistant" && typeof m.content === "object" && m.content.agents ? (
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
        </div>
      </div>

      <div className="row mt-3">
        <div className="col">
          <div className="input-group flex-grow-0 align-items-end">
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
    </div>
  );
}
