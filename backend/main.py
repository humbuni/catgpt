"""FastAPI application for CatGPT backend.

This service exposes a single POST /chat endpoint that proxies a chat
conversation to the OpenAI chat completion API and streams the answer
back to the caller as Server-Sent Events.
"""

from __future__ import annotations

import os

import dotenv
import openai

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
    messages: list[dict]


app = FastAPI(title="CatGPT Backend")

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
    """Proxy a chat conversation to OpenAI and stream the answer."""

    if not req.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    full_messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *req.messages,
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

    return StreamingResponse(_stream_openai(stream), media_type="text/event-stream")
