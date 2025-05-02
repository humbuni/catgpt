from FileSystemAgent import FileSystemAgent
import os
from agents import Agent, RunResult, Runner


class Runtime:
    def __init__(self):

        current_dir = os.path.dirname(os.path.abspath(__file__))
        samples_dir = os.path.join(current_dir, "agent-files")

        fileSystemAgent = FileSystemAgent(samples_dir)

        self.agent: Agent = Agent(
            name="Runtime Agent",
            # instructions="You are a runtime agent that executes the plan from the Conductor agent. You are capable of executing the plan and returning the results to the Conductor agent. You can also ask for help from other agents if needed.",
            instructions="You are an assistant agent. You determine which agent to use to accomplish the task.",
            tools=[fileSystemAgent.agent.as_tool(tool_name = "filesystem", tool_description = "can access and read files")],
            model = "gpt-4.1"
        )

    async def execute(self, task) -> RunResult:
        """Executes a given task."""
        # Implement task execution logic here
        return await Runner.run(starting_agent=self.agent, input=task)
