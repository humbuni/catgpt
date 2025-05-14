import { useEffect, useRef, useState, useId } from "react";
import ReactMarkdown from "react-markdown";
import { Message, chat, FlowResponse, run, FlowExecutionResult } from "./api";

// Renderer for a linear flow of agents
function FlowRenderer({ flow, result }: { flow: FlowResponse | null , result: FlowExecutionResult | null }) {
  const uniquePrefix = useId();
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    if (!flow || !flow.agents.length) {
      setVisibleSteps(0);
      return;
    }
    setVisibleSteps(1);
    let step = 1;
    const interval = setInterval(() => {
      step++;
      if (step > flow.agents.length) {
        clearInterval(interval);
      } else {
        setVisibleSteps(step);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [flow]);

  return (
    <div
      className="flow-cards overflow-auto"
      id={`flowCards-${uniquePrefix}`}
    >
      {flow && flow.agents.slice(0, visibleSteps).map((agent, idx) => (
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
              <span className="thinking">Thinking...</span>
            </div>
          </div>
        )}
      </div>
      <div className="row mb-3">
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
              rows={5}
            />
          </div>
        </div>
      </div>
      <div className="row mb-3">
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

      let currentResult: { [agent: string]: string } = {};
      let currentStatus: { [agent: string]: string } = {};
      flow.agents.forEach(agentStep => {
        currentStatus[agentStep.name] = "planned";
      });
      setExecutionResults({
        response: { ...currentResult },
        status: { ...currentStatus }
      });

      const response = await run(flow);
      if (!response.body) {
        setIsRunning(false);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentAgent: string | null = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          if(currentAgent) {
            currentStatus[currentAgent] = "completed";
            setExecutionResults({
              response: { ...currentResult },
              status: { ...currentStatus }
            });
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let eventBoundary = buffer.indexOf("<newline>");
        while (eventBoundary !== -1) {
          const eventStr = buffer.slice(0, eventBoundary);
          buffer = buffer.slice(eventBoundary + "<newline>".length);
          const dataStr = eventStr;
          // Custom streaming format: ::result::, {agentName}::, then data
          if (dataStr.startsWith("::result::")) {
            // New result for an agent
            const rest = dataStr.slice("::result::".length);
            const agentSepIdx = rest.indexOf("::");
            if (agentSepIdx !== -1) {
              currentAgent = rest.slice(0, agentSepIdx);
              // Start new result for this agent
              if (!(currentAgent in currentResult)) {
                currentResult[currentAgent] = "";
                currentStatus[currentAgent] = "running";
                setExecutionResults({
                  response: { ...currentResult },
                  status: { ...currentStatus }
                });
              }
            }
          } else if (dataStr.startsWith("::end::")) {
            if(currentAgent) {
              currentStatus[currentAgent] = "completed";
              setExecutionResults({
                response: { ...currentResult },
                status: { ...currentStatus }
              });
            }
          } else if (currentAgent) {
            // Append streamed data to the current agent's result
            currentResult[currentAgent] = (currentResult[currentAgent] || "") + dataStr;
            setExecutionResults({
              response: { ...currentResult },
              status: { ...currentStatus }
            });
          }
          eventBoundary = buffer.indexOf("<newline>");
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
    <div className="container-fluid chat d-flex flex-column flex-grow-1 vh-100">
      <div className="row flex-grow-1 overflow-hidden">
        <div className="col-8 pe-2">
          {flow && (
            <div className="run-section mt-3 mb-3">
              <button className="btn btn-success" onClick={handleRun} disabled={isRunning}>
                {isRunning ? "Running..." : "Run"}
              </button>
            </div>
          )}
          <FlowRenderer flow={flow} result={executionResults}/>
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
