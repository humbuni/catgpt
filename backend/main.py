"""FastAPI application for CatGPT backend.

This service exposes a single POST /chat endpoint that proxies a chat
conversation to the OpenAI chat completion API and streams the answer
back to the caller as Server-Sent Events.
"""

from __future__ import annotations

import os

import dotenv
import openai
from typing import Dict, List

# Use the async client provided by the OpenAI Python SDK v1+
# Pass the already validated API key explicitly so that the async client
# works even if the environment variable is later unset.
client = openai.AsyncOpenAI(api_key=openai.api_key)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.responses import StreamingResponse

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

dotenv.load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise RuntimeError("OPENAI_API_KEY environment variable missing")

SYSTEM_PROMPT = os.getenv(
    "CAT_SYSTEM_PROMPT",
    "You are CatGPT, a witty cat that speaks in short, playful sentences.",
)

# Model to use – defaults to GPT-4.1 but can be overridden via env var.
MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4.1")

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    """Schema for a chat request coming from the frontend.

    The frontend now only sends the latest user message together with a
    `session_id`. The backend keeps the full conversation in memory and will
    append the assistant response before caching it again.
    """

    session_id: str
    message: dict[str, str]


app = FastAPI(title="CatGPT Backend")

# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------
# Maps a `session_id` string to the list of messages exchanged so far
# (excluding the system prompt).

sessions: Dict[str, List[dict[str, str]]] = {}

# Allow any origin (for demo purposes). In production, restrict this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _stream_openai(stream):
    """Translate the OpenAI SDK's async generator into SSE bytes."""

    async for chunk in stream:
        delta = chunk.choices[0].delta.content  # type: ignore[attr-defined]
        if delta:
            yield f"data:{delta}\n\n"

    yield "data:[DONE]\n\n"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/chat")
async def chat(req: ChatRequest):
    """Chat endpoint that keeps per-session conversation state in memory.

    The frontend sends only the latest user message together with a
    `session_id`. The backend looks up the previous history for that session,
    appends the new user message, forwards everything to OpenAI, streams the
    assistant's answer back to the client, and finally stores the assistant
    message in the session history.
    """

    session_id = req.session_id.strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id cannot be empty")

    # Validate the incoming user message.
    if not req.message or not req.message.get("content"):
        raise HTTPException(status_code=400, detail="message cannot be empty")

    # Make sure the role is set – default to "user" for convenience.
    user_message: dict[str, str] = {
        "role": req.message.get("role", "user"),
        "content": req.message["content"],
    }

    if user_message["role"] not in {"user", "assistant"}:
        raise HTTPException(status_code=400, detail="invalid role")

    # Retrieve the stored history (if any) for this session.
    history = sessions.get(session_id, [])

    # Build the message list we send to OpenAI: system prompt + history + new message
    full_messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history,
        user_message,
    ]

    try:
        stream = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=full_messages,
            stream=True,
            temperature=0.7,
        )
    except openai.OpenAIError as exc:  # type: ignore[attr-defined]
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    async def event_generator():
        """Async generator that streams chunks and finally updates the session."""

        assistant_content = ""
        async for chunk in stream:
            delta = chunk.choices[0].delta.content  # type: ignore[attr-defined]
            if delta:
                assistant_content += delta
                yield f"data:{delta}\n\n"

        # Conversation finished – update session with both user and assistant messages.
        sessions[session_id] = [
            *history,
            user_message,
            {"role": "assistant", "content": assistant_content},
        ]

        yield "data:[DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
