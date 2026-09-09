# Antigravity

agy-slack is tuned for Google Antigravity CLI, the Antigravity SDK, and Gemini CLI v0.59 (see [GEMINI.md](./GEMINI.md)).

## Config locations

| Scope | Path |
|---|---|
| Global | `~/.gemini/config/mcp_config.json` |
| Legacy / IDE | `~/.gemini/antigravity/mcp_config.json` |
| Workspace | `.agents/mcp_config.json` |

Field names that differ from Claude Desktop / Cursor:

- Remote servers use **`serverUrl`**, not `url`.
- `disabledTools` is a string array of tool names.
- `headers` is valid on remote servers (not needed for local stdio).
- OAuth on remote servers uses redirect `https://antigravity.google/oauth-callback`. Slack's hosted MCP does not support Dynamic Client Registration; this server is local stdio instead.

## Interactive manager

In the CLI prompt, type `/mcp` and press Enter. You should see a status ring for `agy-slack`. Reload after `agy-slack install`.

## Permissions

Antigravity runs MCP tools in **Ask mode** by default. Combined with `SLACK_MCP_MODE=confirm`, a send requires:

1. You approving the tool call in Antigravity
2. The model passing `confirm=true` after showing the preview

That is intentional.

## SDK

```python
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.types import McpStdioServer

config = LocalAgentConfig(
    mcp_servers=[
        McpStdioServer(
            name="agy-slack",
            command="npx",
            args=["-y", "github:salahuddinuqaili/agy-slack"],
            env={
                "SLACK_USER_TOKEN": "...",
                "SLACK_MCP_MODE": "confirm",
            },
        )
    ]
)
```

## Stdio vs HTTP

Prefer **stdio**. It is what `npx` + Ask mode expect. Use `--http` only when you need `serverUrl` on a loopback port.
