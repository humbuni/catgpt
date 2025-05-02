from backend.agents.filesystem import FileSystemAgent
from backend.agents.baseAgent import BaseAgent
import os
from agents import RunResult, Runner


class ComputerUseAgent(BaseAgent):
    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        samples_dir = os.path.join(current_dir, "agent-files")

        fileSystemAgent = FileSystemAgent(samples_dir)

        super().__init__(
            name="Runtime Agent",
            instructions="You are an assistant agent. You determine which agent to use to accomplish the task.",
            tools=[fileSystemAgent.agent.as_tool(tool_name="filesystem", tool_description="can access and read files")],
            model="gpt-4.1"
        )

    async def execute(self, instruction: str) -> RunResult:
        """Executes a given task."""
        # Implement task execution logic here
        return await Runner.run(starting_agent=self.agent, input=instruction)
