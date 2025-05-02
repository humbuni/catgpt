from agents import Agent, Runner, TResponseInputItem

class BaseAgent:
    def __init__(self, name: str, instructions: str, tools=None, mcp_servers=None, model="gpt-4.1"):
        self.agent = Agent(
            name=name,
            instructions=instructions,
            tools=tools or [],
            mcp_servers=mcp_servers or [],
            model=model
        )

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        pass

    async def execute(self, instruction: str | list[TResponseInputItem]):
        return await Runner.run(starting_agent=self.agent, input=instruction)