import asyncio

from agents import RunResult, trace

from flowagents.base import BaseAgent
from flowagents.conductor import AgentDefinition, AgentWorkflow, ConductorAgent
from flowagents.assistant import AssistantAgent
from flowagents.filesystem import FileSystemAgent

import logging

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

import mlflow

# Enable auto-tracing for OpenAI
# server needs to be started: mlflow server --host 127.0.0.1 --port 8080
mlflow.openai.autolog()

# Optional: Set a tracking URI and an experiment
mlflow.set_tracking_uri("http://localhost:8080")
mlflow.set_experiment("catgpt")

class Message:
    role: str

async def main():
    with trace(workflow_name="test_workflow"):
        conductor = ConductorAgent()

        user_message: dict[str, str] = {
            "role": "user",
            # "content": "I have an invoice (file invoice.txt). Help me decide based on company policy (in policies.txt) if I can approve and submit it for payment. If so, do it. If not, explain why it cannot be approved. Write a draft email to notify the customer if the invoice was approved, or if it was rejected, in which case explain why. If approved, submit the invoice at http://submit-invoice.com.",
            # "content": "I have an expense (file expense.txt). Based on the file policies.txt, draft an email to ask for approval if needed. In all cases, submit the expense report on aka.ms/msexpense",
            "content": "I have an expense (file expense.txt). Based on the file policies.txt, decide if an approval is needed. If so, draft an email to ask for approval. In all cases, submit the expense report on aka.ms/msexpense",
        }
        result = await conductor.run_async(messages = [user_message])

        workflow: AgentWorkflow = result.final_output

        agent: BaseAgent = None
        result: RunResult = None
        for agentStep in workflow.agents:
            logger.info(f"Agent Name: {agentStep.name}")
            logger.info(f"Agent Type: {agentStep.type}")
            logger.info(f"Agent Instructions: {agentStep.instructions}")

            if(agentStep.type == "filesystem"):
                agent = FileSystemAgent(name = agentStep.name)
            elif(agentStep.type == "assistant"):
                agent = AssistantAgent(name = agentStep.name)
            else:
                raise ValueError(f"Unknown agent type: {agentStep.type}")

            await agent.__aenter__()

            if(result == None):
                input = [{"role": "user", "content": agentStep.instructions}]
            else:
                input = result.to_input_list() + [{"role": "user", "content": agentStep.instructions}]

            logger.info(f"Agent Input: {input}")
            result = await agent.execute(input)

            logger.info(f"Agent Result: {result.final_output}")
            await agent.__aexit__(None, None, None)
            logger.info(f"*******************************************************")

if __name__ == "__main__":
    asyncio.run(main())