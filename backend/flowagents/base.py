from agents import Agent, ModelSettings, RunConfig, RunResult, RunResultStreaming, Runner, TResponseInputItem
from pydantic import BaseModel

class AgentExecutionResult(BaseModel):
    status: dict[str, str] = {}
    response: dict[str, str] = {}

class BaseAgent:
    def __init__(self, name: str, instructions: str, tools=None, mcp_servers=None, model="gpt-4.1", model_settings: ModelSettings=ModelSettings()):
        self.agent = Agent(
            name=name,
            instructions=instructions + " Result should follow markdown syntax.",
            tools=tools or [],
            mcp_servers=mcp_servers or [],
            model=model,
            model_settings=model_settings
        )

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        pass

    async def execute(self, instruction: str | list[TResponseInputItem]) -> RunResult:
        return await Runner.run(starting_agent=self.agent, input=instruction, max_turns=100)

    async def execute_stream(self, instruction: str | list[TResponseInputItem]) -> RunResultStreaming:
        return Runner.run_streamed(starting_agent=self.agent, input=instruction, max_turns=100, run_config=RunConfig(tracing_disabled=True))