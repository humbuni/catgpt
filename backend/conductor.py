"""`Conductor` – thin OO wrapper around the OpenAI Agents SDK.

The class hides SDK details from the FastAPI layer and centralises all
environment-dependent configuration (API key, model, system prompt).
"""

from __future__ import annotations

import os
from typing import Dict, List

import dotenv
import openai
from agents import Agent, Runner, RunResultStreaming  # type: ignore


class Conductor:
    """Create and run a CatGPT Agent using the Agents SDK."""

    def __init__(
        self,
        *,
        system_prompt: str | None = None,
        model_name: str | None = None,
    ) -> None:
        # ---------------------------------------------------------------------
        # Load env only once per process. Safe to call multiple times because
        # dotenv will silently ignore if already loaded.
        # ---------------------------------------------------------------------
        dotenv.load_dotenv()

        # API key --------------------------------------------------------------
        openai.api_key = os.getenv("OPENAI_API_KEY")
        if not openai.api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable missing")

        # Prompt & model -------------------------------------------------------
        self.system_prompt: str = system_prompt or os.getenv(
            "CAT_SYSTEM_PROMPT",
            "You are CatGPT, a witty cat that speaks in short, playful sentences.",
        )

        self.model_name: str = model_name or os.getenv("OPENAI_MODEL", "gpt-4.1")

        # Create the Agent immediately (no lazy init).
        self.agent: Agent = Agent(
            name="catgpt",
            instructions=self.system_prompt,
            model=self.model_name,
        )

    # ---------------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------------

    def run_stream(self, messages: List[Dict[str, str]]) -> RunResultStreaming:
        """Run the given message list through the Agent in streaming mode."""

        return Runner.run_streamed(self.agent, input=messages)
