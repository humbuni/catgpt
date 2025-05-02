from flowagents.base import BaseAgent
from agents import RunResult, Runner


class AssistantAgent(BaseAgent):
    def __init__(self, name: str):
        super().__init__(
            name = name,
            instructions="You are an assistant agent.",
        )

    async def execute(self, instruction: str) -> RunResult:
        """Executes a given task."""
        # Implement task execution logic here
        return await Runner.run(starting_agent=self.agent, input=instruction)
