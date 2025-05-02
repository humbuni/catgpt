import asyncio
import os
import shutil

from agents.mcp import MCPServerStdio
from flowagents.base import BaseAgent

import mlflow

# Enable auto tracing for OpenAI Agents SDK
mlflow.openai.autolog()

# Optional: Set a tracking URI and an experiment
mlflow.set_tracking_uri("http://localhost:8080")
mlflow.set_experiment("OpenAI Agent")

class FileSystemAgent(BaseAgent):
    def __init__(self, name: str):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        samples_dir = os.path.join(current_dir, "../agent-files")

        self.server = MCPServerStdio(
            name=name,
            params={
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem", samples_dir],
            },
        )
        super().__init__(
            name="File System Assistant",
            instructions="Use the tools to read the filesystem and answer questions based on those files. Only attempt to read files under " + samples_dir,
            mcp_servers=[self.server],
        )

    def __enter__(self):
        self.server.__enter__()
        return super().__enter__()

    def __exit__(self, exc_type, exc_value, traceback):
        self.server.__exit__(exc_type, exc_value, traceback)
        super().__exit__(exc_type, exc_value, traceback)

    async def __aenter__(self):
        await self.server.__aenter__()
        return await super().__aenter__()

    async def __aexit__(self, exc_type, exc_value, traceback):
        await self.server.__aexit__(exc_type, exc_value, traceback)
        await super().__aexit__(exc_type, exc_value, traceback)

async def main():
    async with FileSystemAgent(name="filesystem") as agent:
        result = await agent.execute("according to the file policies.txt, what do I need to file the expense from expense.txt?")  # Example usage
        print(result.final_output)

if __name__ == "__main__":
    # Let's make sure the user has npx installed
    if not shutil.which("npx"):
        raise RuntimeError("npx is not installed. Please install it with `npm install -g npx`.")

    asyncio.run(main())
