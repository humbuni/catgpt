"""FastAPI application for CatGPT backend.

This service exposes a single POST /chat endpoint that proxies a chat
conversation to the OpenAI chat completion API and streams the answer
back to the caller as Server-Sent Events.
"""

from __future__ import annotations

from typing import Dict, List

from openai.types.responses import ResponseTextDeltaEvent

# Conductor class wraps the Agents SDK.
# Attempt relative import when running as a package (e.g., `uvicorn backend.main:app`).
# Fallback to a same-directory import when executing directly.
try:
    from .conductor import Conductor  # type: ignore
except ImportError:  # pragma: no cover
    from conductor import Conductor  # type: ignore

# Single, long-lived instance reused across requests.
_conductor = Conductor()
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from starlette.responses import StreamingResponse

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

    # Retrieve the stored history (if any) for this session (no system prompt).
    history = sessions.get(session_id, [])

    # Build input for the agent SDK (history + latest user message).
    agent_input: List[dict[str, str]] = [*history, user_message]

    try:
        result = _conductor.run_stream(agent_input)
    except Exception as exc:  # pragma: no cover – catch any SDK error
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    async def event_generator():
        """Stream deltas from the Agent SDK as Server-Sent Events."""

        async for event in result.stream_events():
            # We only care about raw response delta events.
            if (
                event.type == "raw_response_event"
                and isinstance(event.data, ResponseTextDeltaEvent)
            ):
                delta: str | None = event.data.delta  # type: ignore[attr-defined]
                if delta:
                    yield f"data:{delta}\n\n"

        # After the stream is complete, persist the full conversation for the session.
        sessions[session_id] = result.to_input_list()

        # Notify client we're done.
        yield "data:[DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
