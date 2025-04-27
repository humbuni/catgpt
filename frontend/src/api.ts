const BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function* chatStream(sessionId: string, message: Message) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Unexpected response ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || ""; // last partial part stays in buffer

    for (const part of parts) {
      if (part === "data:[DONE]") return;
      const [, data] = part.split("data:");
      if (data) {
        yield data;
      }
    }
  }
}
