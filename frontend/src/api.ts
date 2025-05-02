const BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * JSON Schema definition (input/output schema)
 */
export interface JSONSchema {
  [key: string]: any;
}

/**
 * Definition of an individual agent in the flow
 */
export interface Agent {
  name: string;
  type: string;
  instructions: string;
  result: string;
  input_schema: string;
  output_schema: string;
}

/**
 * Linear flow of agents returned by the server
 */
export interface FlowResponse {
  agents: Agent[];
}

/**
 * Chat message, where content may be a user string or a flow of agents
 */
export interface Message {
  role: "user" | "assistant";
  content: string | ChatResponse;
}

/**
 * Response from the backend: assistant message and agent flow
 */
export interface ChatResponse {
  message: string;
  flow: FlowResponse;
}

/**
 * Send a chat message and return the server's response,
 * which is expected to be a JSON object with message and flow.
 */
export async function chat(
  sessionId: string,
  message: Message
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) {
    throw new Error(`Unexpected response ${res.status}`);
  }
  // Expecting a JSON object of shape { message, flow }
  const data = await res.json();
  return data as ChatResponse;
}

/**
 * Call the backend /run endpoint and return the streamed response as text.
 */
export async function run(workflow: FlowResponse): Promise<Response> {
  const res = await fetch(`${BASE_URL}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workflow),
  });
  if (!res.body) {
    throw new Error("No response body for streaming");
  }
  return res;
}
