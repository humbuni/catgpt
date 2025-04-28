"""`Conductor` – thin OO wrapper around the OpenAI Agents SDK.

The class hides SDK details from the FastAPI layer and centralises all
environment-dependent configuration (API key, model, system prompt).
"""

from __future__ import annotations

from typing import Dict, List
from agents import Agent, Runner, RunResultStreaming, RunConfig

import mlflow

# Enable auto-tracing for OpenAI
# server needs to be started: mlflow server --host 127.0.0.1 --port 8080
mlflow.openai.autolog()

# Optional: Set a tracking URI and an experiment
mlflow.set_tracking_uri("http://localhost:8080")
mlflow.set_experiment("catgpt")

class Conductor:
    """Create and run a CatGPT Agent using the Agents SDK."""

    def __init__(
        self,
        *,
        system_prompt: str | None = None,
        model_name: str | None = None,
    ) -> None:

        history_tutor_agent = Agent(
            name="History Tutor",
            handoff_description="Specialist agent for historical questions",
            instructions="You provide assistance with historical queries. Explain important events and context clearly.",
            model = "gpt-4.1"
        )

        math_tutor_agent = Agent(
            name="Math Tutor",
            handoff_description="Specialist agent for math questions",
            instructions="You provide help with math problems. Explain your reasoning at each step and include examples",
            model = "gpt-4.1"
        )

        # Create the Agent immediately (no lazy init).
        self.agent: Agent = Agent(
            name="catgpt",
            instructions="You are an agent that can assemble a team of agents to solve and execute a task. You are given a task and in order to execute it, you must plan on how to execute it with the help of your team. The team members you can get help from are the following:" \
            "1. Assistant Agent: a generalist agent capable of thinking and reasoning over text and images. You can have multiple instances of this agent, with specific instructions to help them focus on a particular topic or sub task." \
            "2. File browsing agent capable of accessing files on a computer." \
            "3. Computer using agent capable of using a computer to do any generic task on a computer, such as accessing the web and searching for information, or using any app. If there's a repetitve task, " \
            "4. Web search agent capable of searching the web." \
            "Output the plan using json. You must return a valid json object. The plan must include the following properties:" \
            # "Output the plan using markdown syntax. The plan must include the following sections:" \
            "1. prerequisites: input or anything you need from the user, such as location of data to handle, sources of information, etc." \
            "2. agents: detailed setup for each agent in the team, including fields name, type and instructions for each agent, input_schema and output_schema. Input and output must be descripted using json schema. Please add descriptions for each field as well as a description for the object itself.",
            # "As you prepare the plan, do not hesitate to specify pre-requirements if you think there are any to accomplish the task. Plan must specify each agents you will use and instructions for them to be able to accomplish their task. You cannot use an assistant no listed above. Once your plan is ready, write it down as and confirmation to the user to execute it.",
            model = "o3",
            handoffs = [history_tutor_agent, math_tutor_agent],
        )

    # ---------------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------------


    async def run_async(self, messages: List[Dict[str, str]]) -> RunResult:
        """Run the given message list through the Agent asynchronously."""
        # Uses the async Runner API; must be called within an event loop
        return await Runner.run(self.agent, input=messages)
