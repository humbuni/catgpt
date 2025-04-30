import asyncio
from typing import Any
from conductor import Conductor

import logging
import json

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

result =  None

async def main():
    agent = Conductor()

    user_message: dict[str, str] = {
        "role": "user",
        "content": "I have an invoice (typically a pdf file). Help me decide based on company policy (under policies.txt) if I can approve and submit it for payment. If so, do it. If not, explain why it cannot be approved. Write a draft email to notify the customer if the invoice was approved, or if it was rejected, in which case explain why."
    }
    result = await agent.run_async(messages = [user_message])

    logger.info(result.final_output.json())

if __name__ == "__main__":
    asyncio.run(main())