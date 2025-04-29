import asyncio
import os
import shutil

from agents import Agent, Runner, gen_trace_id, trace
from agents.mcp import MCPServer, MCPServerStdio

import mlflow

# Enable auto tracing for OpenAI Agents SDK
mlflow.openai.autolog()

# Optional: Set a tracking URI and an experiment
mlflow.set_tracking_uri("http://localhost:8080")
mlflow.set_experiment("OpenAI Agent")

class FileSystemAgent:
    def __init__(self, samples_dir: str):
        self.samples_dir = samples_dir
        self.server = MCPServerStdio(
            name="Filesystem Server, via npx",
            params={
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem", self.samples_dir],
            },
        )
        self.agent = Agent(
            name="Assistant",
            instructions="Use the tools to read the filesystem and answer questions based on those files. Only attempt to read files under " + samples_dir,
            mcp_servers=[self.server],
        )

    async def run(self, message: str):
        async with self.server as server:
            print(f"Running: {message}")
            result = await Runner.run(starting_agent=self.agent, input=message)
            print(result.final_output)


async def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    samples_dir = os.path.join(current_dir, "agent-files")

    agent = FileSystemAgent(samples_dir)
    await agent.run("according to the file policies.txt, what do I need to file the expense from expense.txt?")  # Example usage
    # await agent.run("list all the files")  # Example usage


if __name__ == "__main__":
    # Let's make sure the user has npx installed
    if not shutil.which("npx"):
        raise RuntimeError("npx is not installed. Please install it with `npm install -g npx`.")

    asyncio.run(main())
