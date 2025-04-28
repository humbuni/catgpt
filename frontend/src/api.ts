const BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Send a chat message and return the assistant's full reply.
 */
export async function chat(sessionId: string, message: Message): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) {
    throw new Error(`Unexpected response ${res.status}`);
  }
  const data = await res.json();
  return data.content;
}
