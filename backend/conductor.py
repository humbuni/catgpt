"""`Conductor` – thin OO wrapper around the OpenAI Agents SDK.

The class hides SDK details from the FastAPI layer and centralises all
environment-dependent configuration (API key, model, system prompt).
"""

from __future__ import annotations

from typing import Dict, List
from agents import Agent, Runner, RunResultStreaming

# import mlflow

# Enable auto-tracing for OpenAI
# server needs to be started: mlflow server --host 127.0.0.1 --port 8080
# mlflow.openai.autolog()

# Optional: Set a tracking URI and an experiment
# mlflow.set_tracking_uri("http://localhost:8080")
# mlflow.set_experiment("catgpt")

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
            instructions = "You determine which agent to use based on the user's homework question",
            model = "gpt-4.1",
            handoffs = [history_tutor_agent, math_tutor_agent],
        )

    # ---------------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------------

    def run_stream(self, messages: List[Dict[str, str]]) -> RunResultStreaming:
        """Run the given message list through the Agent in streaming mode."""

        return Runner.run_streamed(self.agent, input=messages)
