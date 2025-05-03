"""`Conductor` – thin OO wrapper around the OpenAI Agents SDK.

The class hides SDK details from the FastAPI layer and centralises all
environment-dependent configuration (API key, model, system prompt).
"""

from __future__ import annotations

from typing import Any, Dict, List
from agents import Agent, RunResult, Runner
from pydantic import BaseModel

import mlflow

# Enable auto-tracing for OpenAI
# server needs to be started: mlflow server --host 127.0.0.1 --port 8080
mlflow.openai.autolog()

# Optional: Set a tracking URI and an experiment
mlflow.set_tracking_uri("http://localhost:8080")
mlflow.set_experiment("catgpt")

class AgentDefinition(BaseModel):
    name: str
    type: str
    instructions: str
    result: str

class AgentWorkflow(BaseModel):
    agents: List[AgentDefinition]

class ConductorResponse(BaseModel):
    flow: AgentWorkflow
    message: str

class ConductorAgent:
    """Create and run a CatGPT Agent using the Agents SDK."""

    def __init__(self):

        # Create the Agent immediately (no lazy init).
        self.agent: Agent = Agent(
            name="Conductor",
            instructions="You are an agent that can assemble a team of agents to solve and execute a task. You are given a task and in order to execute it, you must plan on how to execute it with the help of your team."\
            "The team members you can get help from are the following:" \
            "1. 'assistant': a generalist agent capable of thinking and reasoning over text and images." \
            "2. 'filesystem': agent capable of accessing files on a computer." \
            "3. 'computeruse': agent capable of using a computer to do any generic task on a computer, such as accessing the web and searching for information, or using any app. If there's a repetitve task, " \
            "4. 'websearch': agent capable of searching the web." \
            "You can have multiple instances of each agent, with specific instructions to help them focus on a particular topic or sub task." \
            "Keep the result field empty. Instructions for each agent should follow markdown syntax" \
            "Include a friendly message to explained what you've done.",
            # "Output the plan using json. You must return a valid json object. The plan must include the following properties:" \
            # "Output the plan using markdown syntax. The plan must include the following sections:" \
            # "1. prerequisites: input or anything you need from the user, such as location of data to handle, sources of information, etc." \
            # "2. agents: detailed setup for each agent in the team, including fields name, type and instructions for each agent, input_schema and output_schema. Input and output must be descripted using json schema. Please add descriptions for each field as well as a description for the object itself."\
            # "Once your planned is approved by the user, you can execute it.",
            # "As you prepare the plan, do not hesitate to specify pre-requirements if you think there are any to accomplish the task. Plan must specify each agents you will use and instructions for them to be able to accomplish their task. You cannot use an assistant no listed above. Once your plan is ready, write it down as and confirmation to the user to execute it.",
            model = "o3",
            handoffs = [],
            output_type= ConductorResponse
        )

    # ---------------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------------

    async def run_async(self, messages: List[Dict[str, str]]) -> RunResult:
        """Run the given message list through the Agent asynchronously."""
        # Uses the async Runner API; must be called within an event loop
        return await Runner.run(self.agent, input=messages)
