"""FastAPI application for CatGPT backend.

This service exposes a single POST /chat endpoint that proxies a chat
conversation to the OpenAI chat completion API and streams the answer
back to the caller as Server-Sent Events.
"""

from __future__ import annotations

from typing import Any, Dict, List

from agents import RunResult
from openai.types.responses import ResponseTextDeltaEvent

# Conductor class wraps the Agents SDK.
# Attempt relative import when running as a package (e.g., `uvicorn backend.main:app`).
# Fallback to a same-directory import when executing directly.
from flowagents.base import AgentExecutionResult, BaseAgent
from flowagents.assistant import AssistantAgent
from flowagents.computerUse import ComputerUseAgent
from flowagents.filesystem import FileSystemAgent
from flowagents.conductor import AgentWorkflow, ConductorAgent, ConductorResponse  # type: ignore

# Single, long-lived instance reused across requests.
_conductor = ConductorAgent()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fastapi.responses import JSONResponse, StreamingResponse
import asyncio

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
    assistant_content: ConductorResponse = result.final_output
    _workflow = assistant_content.flow

    # After receiving the full response, persist the conversation
    sessions[session_id] = result.to_input_list()
    logger.info(
        f"Persisted {len(sessions[session_id])} messages for session {session_id}"
    )

    # Return the full assistant message as JSON
    return JSONResponse(json.loads(assistant_content.model_dump_json()))
    # return JSONResponse(content = json.loads(ChatResponse(role = "assistant", content = assistant_content).model_dump_json()))

@app.post("/run")
async def run(workflow: AgentWorkflow):
    """Run a workflow of agents and stream the results as server-sent events (SSE)."""
    async def message_stream():
        agent: BaseAgent = None
        result: RunResult = None
        agentExecution: AgentExecutionResult = AgentExecutionResult()
        for agentStep in workflow.agents:
            agentExecution.status[agentStep.name] = "planned"
            agentExecution.response[agentStep.name] = None

        for agentStep in workflow.agents:
            logger.info(f"Agent Name: {agentStep.name}")
            logger.info(f"Agent Type: {agentStep.type}")
            logger.info(f"Agent Instructions: {agentStep.instructions}")

            yield f"::result::{agentStep.name}::<newline>"

            if(agentStep.type == "filesystem"):
                agent = FileSystemAgent(name = agentStep.name)
            elif(agentStep.type == "assistant"):
                agent = AssistantAgent(name = agentStep.name)
            elif(agentStep.type == "computeruse"):
                agent = ComputerUseAgent(name = agentStep.name)
            else:
                raise ValueError(f"Unknown agent type: {agentStep.type}")

            async with agent:

                if(result == None):
                    input = [{"role": "user", "content": agentStep.instructions}]
                else:
                    input.append({"role": "user", "content": agentStep.instructions})

                # logger.info(f"Agent Input: {input}")
                result = await agent.execute_stream(input)

                async for event in result.stream_events():
                    if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
                        yield f"{event.data.delta}<newline>"
                        await asyncio.sleep(0.2)

                yield f"::end::<newline>"

                input.append({"role": "assistant", "content": result.final_output})
                await asyncio.sleep(3)


    return StreamingResponse(message_stream(), media_type="text/event-stream")
