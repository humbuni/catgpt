import asyncio
import os
import shutil

from agents.mcp import MCPServerStdio
from flowagents.base import BaseAgent

import mlflow

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
            instructions="Use the tools to read the filesystem and answer questions based on those files. Assume that any requested file is a relative path and if it doesn't start with 'agent-files/' add prefix that to the path.",
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
