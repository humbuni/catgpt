import { useEffect, useRef, useState, useId } from "react";
import { Message, chat, FlowResponse } from "./api";

// Renderer for a linear flow of agents
function FlowRenderer({ flow }: { flow: FlowResponse | null }) {
  const uniquePrefix = useId();
  return (
    <div className="accordion" id={`flowAccordion-${uniquePrefix}`}>
      {flow && flow.agents.map((agent, idx) => (
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
  runMessages: string[];
  isRunning: boolean;
  handleRun: () => void;
}

export function ChatMessagesPanel({ messages, loading, input, setInput, send }: any) {
  const msgsContainerRef = useRef<HTMLDivElement>(null);
  const lastUserRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

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
    autoScrollRef.current = dist < 100;
  }

  return (
    <div className="d-flex flex-column h-100">
      <div
        className="msgs overflow-auto flex-grow-1 p-3 bg-light rounded"
        ref={msgsContainerRef}
        onScroll={handleScroll}
      >
        {messages.map((m: Message, i: number) => {
          const isLastUser =
            m.role === "user" &&
            messages.slice(i + 1).every((mm: Message) => mm.role !== "user");
          return (
            <div
              key={i}
              className={`msg ${m.role}`}
              ref={isLastUser ? lastUserRef : undefined}
            >
              <div className="bubble">{typeof m.content === "string" ? m.content : "[Agent flow]"}</div>
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

export default function Chat({ sessionId, messages, setMessages, runMessages, isRunning, handleRun }: ChatProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState<FlowResponse | null>(null);

  async function send() {
    const content = input.trim();
    if (!content || loading) return;

    const userMessage: Message = { role: "user", content };
    const baseMessages = [...messages, userMessage];
    setMessages(baseMessages);
    setInput("");

    setLoading(true);
    try {
      const chatResponse = await chat(sessionId, userMessage);
      setFlow(chatResponse.flow);
      // Append assistant message to the messages array
      const assistantMessage: Message = { role: "assistant", content: chatResponse.message };
      setMessages([...messages, userMessage, assistantMessage]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container chat d-flex flex-column flex-grow-1 vh-100">
      <div className="row flex-grow-1 overflow-hidden">
        <div className="col-8 pe-2">
          <FlowRenderer flow={flow} />
          {/* Run button and streamed output */}
          <div className="run-section mt-3">
            <button className="btn btn-success" onClick={handleRun} disabled={isRunning}>
              {isRunning ? "Running..." : "Run"}
            </button>
            <div className="run-output mt-2 bg-dark text-light p-2 rounded" style={{ minHeight: 40 }}>
              {runMessages.map((msg, idx) => (
                <div key={idx} style={{ whiteSpace: "pre-wrap" }}>{msg}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-4 ps-2">
          <ChatMessagesPanel
            messages={messages}
            loading={loading}
            input={input}
            setInput={setInput}
            send={send}
          />
        </div>
      </div>
    </div>
  );
}
