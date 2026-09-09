"""Attach agy-slack to an Antigravity SDK agent.

Copy, then replace the token. Prefer SLACK_MCP_MODE=confirm so nothing
posts until both the model and you agree.
"""

from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.types import McpStdioServer

config = LocalAgentConfig(
    mcp_servers=[
        McpStdioServer(
            name="agy-slack",
            command="npx",
            args=["-y", "github:salahuddinuqaili/agy-slack"],
            env={
                "SLACK_USER_TOKEN": "xoxp-...",
                "SLACK_MCP_MODE": "confirm",
            },
        )
    ]
)

# agent = Agent(config=config)
# agent.run("Catch me up on #eng from this morning.")
