# VS Code + GitHub Copilot

VS Code is **not** Cursor. Copying a Cursor / Claude / Gemini snippet will not
load the server.

| | VS Code Copilot | Cursor | Gemini CLI v0.59 | Antigravity |
|---|---|---|---|---|
| File | `.vscode/mcp.json` · `Code/User/mcp.json` · `~/.copilot/mcp-config.json` | `~/.cursor/mcp.json` | `~/.gemini/settings.json` | `mcp_config.json` |
| Root key | **`servers`** | `mcpServers` | `mcpServers` | `mcpServers` |
| HTTP | `{ "type": "http", "url" }` | `url` | **`httpUrl`** | **`serverUrl`** |
| Secrets | `inputs` + `${input:id}` | env literals | `$VAR` | env literals |
| Where tools run | Copilot Chat **Agent** mode | Composer | TUI | TUI |

MCP shipped to all VS Code users in **1.102**. Copilot Chat must be in **Agent
mode** — MCP tools do not run in Ask mode.

## Installation

### 1. One command

```bash
npx github:salahuddinuqaili/agy-slack install --client vscode
```

Writes:

- Editor user config (`MCP: Open User Configuration`)
  - Linux: `~/.config/Code/User/mcp.json`
  - macOS: `~/Library/Application Support/Code/User/mcp.json`
  - Windows: `%APPDATA%\Code\User\mcp.json`
- Copilot Agent Host: `~/.copilot/mcp-config.json`

Project-only:

```bash
npx github:salahuddinuqaili/agy-slack install --client vscode --workspace .
```

writes `.vscode/mcp.json` (editor) and `.mcp.json` (Agent Host native).

### 2. Start the server

1. Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **MCP: List Servers**.
2. Start **agy-slack**. Trust it the first time.
3. On first start VS Code prompts for the Slack user token (`xoxp-`) and stores
   it. Do not paste tokens into `mcp.json`.
4. Open Copilot Chat and switch the mode dropdown to **Agent**.
5. Ask: *Catch me up on #eng from this morning.*

Or **MCP: Add Server** → choose stdio → `npx` → `-y github:salahuddinuqaili/agy-slack` → Global.

## mcp.json shape

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "slack_user_token",
      "description": "Slack user token (xoxp-). Required for search and DMs.",
      "password": true
    },
    {
      "type": "promptString",
      "id": "slack_bot_token",
      "description": "Optional Slack bot token (xoxb-). Leave empty if unused.",
      "password": true
    }
  ],
  "servers": {
    "agy-slack": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:salahuddinuqaili/agy-slack"],
      "env": {
        "SLACK_MCP_MODE": "confirm",
        "SLACK_USER_TOKEN": "${input:slack_user_token}",
        "SLACK_BOT_TOKEN": "${input:slack_bot_token}"
      }
    }
  }
}
```

A CodeLens **Start** button appears at the top of this file after you save it.

## HTTP (`type: http`, `url`)

```bash
npx github:salahuddinuqaili/agy-slack serve --http --port 8787
```

```json
{
  "servers": {
    "agy-slack": {
      "type": "http",
      "url": "http://127.0.0.1:8787/mcp"
    }
  }
}
```

Do not use `httpUrl` (Gemini) or `serverUrl` (Antigravity). `type: "sse"` is a
legacy SSE endpoint; streamable HTTP is `http`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Tools never appear | Copilot Chat is in Ask mode. Switch to **Agent**. |
| Server missing | You used `mcpServers`. VS Code wants **`servers`**. |
| HTTP silent | You used `httpUrl` or `serverUrl`. VS Code wants **`url`** + `type: "http"`. |
| Disconnected / no start | Trust the server (first-run prompt). **MCP: Reset Trust** if you dismissed it. |
| Empty search | Need an `xoxp-` user token via the input prompt, not a bot token. |
| Token in the JSON | Delete it. Use `${input:slack_user_token}`. |
| Sandbox auto-approves writes | Do not set `sandboxEnabled` for Slack. Writes stay confirm-gated. |

Official docs: [Add MCP servers in VS Code](https://code.visualstudio.com/docs/copilot/chat/mcp-servers).
