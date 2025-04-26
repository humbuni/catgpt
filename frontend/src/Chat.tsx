import { useRef, useState } from "react";
import { Message, chatStream } from "./api";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const streaming = useRef(false);

  async function send() {
    const content = input.trim();
    if (!content || streaming.current) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");

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

  return (
    <div className="chat">
      <div className="msgs">
        {messages.map((m, i) => (
          <div key={i} className={m.role}>
            {m.content}
          </div>
        ))}
      </div>
      <div className="inputRow">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Ask CatGPT…"
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
