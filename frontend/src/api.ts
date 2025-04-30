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
  content: string | FlowResponse;
}

/**
 * Send a chat message and return the server's response,
 * which is expected to be a JSON flow of agents.
 */
export async function chat(
  sessionId: string,
  message: Message
): Promise<FlowResponse> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) {
    throw new Error(`Unexpected response ${res.status}`);
  }
  // Expecting a JSON object of shape { agents: [...] }
  const data = await res.json();
  return data as FlowResponse;
}
