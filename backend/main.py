"""FastAPI application for CatGPT backend.

This service exposes a single POST /chat endpoint that proxies a chat
conversation to the OpenAI chat completion API and streams the answer
back to the caller as Server-Sent Events.
"""

from __future__ import annotations

from typing import Any, Dict, List

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

from fastapi.responses import JSONResponse

import logging
import json

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

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

class ChatResponse(BaseModel):
    """Schema for a chat response sent to the frontend.

    The response is a JSON object with the assistant's message.
    """

    role: str
    content: Any

app = FastAPI(title="CatGPT Backend")
@app.on_event("startup")
async def startup_event():
    """Log on application startup."""
    logger.info("Starting CatGPT Backend")

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

    # Log incoming request
    logger.info(
        f"Received /chat request: session_id={req.session_id!r}, content={req.message.get('content')!r},"
        f" role={req.message.get('role', 'user')!r}"
    )
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
    logger.debug(f"Session {session_id} history length: {len(history)}")

    # Build input for the agent SDK (history + latest user message).
    agent_input: List[dict[str, str]] = [*history, user_message]

    # Invoke the Conductor asynchronously
    logger.info(f"Calling Conductor.run_async with {len(agent_input)} messages for session {session_id}")
    try:
        result = await _conductor.run_async(agent_input)
    except Exception as exc:  # pragma: no cover – catch any SDK error
        logger.exception("Conductor.run failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Accumulate full assistant response
    logger.info(f"Accumulating full response for session {session_id}")
    assistant_content = result.final_output

    # After receiving the full response, persist the conversation
    sessions[session_id] = result.to_input_list()
    logger.info(
        f"Persisted {len(sessions[session_id])} messages for session {session_id}"
    )

    # Return the full assistant message as JSON
    return JSONResponse(json.loads(assistant_content.model_dump_json()))
    # return JSONResponse(content = json.loads(ChatResponse(role = "assistant", content = assistant_content).model_dump_json()))
