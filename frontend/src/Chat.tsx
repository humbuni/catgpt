import { useEffect, useRef, useState, useId } from "react";
import ReactMarkdown from "react-markdown";
import { Message, chat, FlowResponse, run, FlowExecutionResult } from "./api";

// Renderer for a linear flow of agents
function FlowRenderer({ flow, result }: { flow: FlowResponse | null , result: FlowExecutionResult | null }) {
  const uniquePrefix = useId();
  return (
    <div
      className="flow-cards overflow-auto"
      id={`flowCards-${uniquePrefix}`}
    >
      {flow && flow.agents.map((agent, idx) => (
        <div key={idx} className="card mb-3">
          <div className="card-header d-flex align-items-center">
            <span className="fw-bold">{agent.name}</span>
            <span className="badge bg-primary ms-2">{agent.type}</span>
            <div className="flex-grow-1" />
            {result && result.status && result.status[agent.name] && (
            <span
              className={`badge ms-2 ${
                result.status[agent.name] === "completed"
                  ? "bg-success"
                  : result.status[agent.name] === "planned"
                  ? "bg-secondary"
                  : result.status[agent.name] === "running"
                  ? "bg-warning text-dark"
                  : "bg-light text-dark"
              }`}
            >
              {result.status[agent.name]}
            </span>
            )}
          </div>
          <div className="card-body">
            <h6 className="card-title">Instructions</h6>
            <div className="card-text">
              <ReactMarkdown>{agent.instructions}</ReactMarkdown>
            </div>
            {result && result.response && result.response[agent.name] && (
              <>
                <h6 className="card-title">Result</h6>
                <div className="card-text mt-2 bg-dark text-light p-2 rounded">
                  <ReactMarkdown>{result.response[agent.name]}</ReactMarkdown>
                </div>
              </>
            )}
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
              rows={10}
            />
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col">
          <button
            className="btn btn-primary"
            type="button"
            onClick={send}
            disabled={loading} >
           Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Chat({ sessionId, messages, setMessages }: ChatProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState<FlowResponse | null>(null);
  const [executionResults, setExecutionResults] = useState<FlowExecutionResult | null>(null);

  // --- Run button state ---
  const [isRunning, setIsRunning] = useState(false);

  async function handleRun() {
    if(flow) {
      setIsRunning(true);

      const response = await run(flow);
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
        let eventBoundary = buffer.indexOf("\n\n");
        while (eventBoundary !== -1) {
          const eventStr = buffer.slice(0, eventBoundary).trim();
          buffer = buffer.slice(eventBoundary + 2);
          if (eventStr.startsWith("data: ")) {
            const dataJson = eventStr.replace(/^data: /, "");
            try {
              const data = JSON.parse(dataJson) as FlowExecutionResult;
              setExecutionResults(data);
            } catch (err) {
              console.error("Failed to parse SSE data:", dataJson, err);
            }
          }
          eventBoundary = buffer.indexOf("\n\n");
        }
      }

      setIsRunning(false);
    }
  }

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
          <FlowRenderer flow={flow} result={executionResults}/>
          {flow && (
            <div className="run-section mt-3">
              <button className="btn btn-success" onClick={handleRun} disabled={isRunning}>
                {isRunning ? "Running..." : "Run"}
              </button>
            </div>
          )}
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
