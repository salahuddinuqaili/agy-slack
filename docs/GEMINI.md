# Gemini CLI v0.59

agy-slack talks stdio MCP. That is what Gemini CLI v0.59 expects. The
config file, HTTP field name, and confirm gate are **not** the same as
Antigravity CLI.

| | Gemini CLI v0.59 | Antigravity CLI |
|---|---|---|
| Binary | `gemini` | `agy` |
| User config | `~/.gemini/settings.json` | `~/.gemini/config/mcp_config.json` |
| Project config | `.gemini/settings.json` | `.agents/mcp_config.json` |
| Stdio | `command` / `args` / `env` | same |
| Streamable HTTP | **`httpUrl`** | **`serverUrl`** |
| SSE | `url` | n/a |
| Tool confirm | `trust: false` (default) | Ask mode |
| Env expansion | `$VAR` / `${VAR}` | literal values |
| Extension | `gemini extensions install <repo>` | n/a |
| Slash commands | `/slack:catchup` etc. | n/a |

Copying an Antigravity snippet into Gemini CLI will not load the server.

## Installation (v0.59)

### 1. Confirm the CLI

```bash
gemini --version
```

Need **0.59.0 or newer**. Install from [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli).

### 2. Create a Slack user token

At [api.slack.com/apps](https://api.slack.com/apps) generate a user token (`xoxp-`).
Search and DMs require it. A bot token (`xoxb-`) can post as the app but cannot search.

Suggested user scopes: `search:read`, `channels:history`, `groups:history`,
`im:history`, `mpim:history`, `channels:read`, `users:read`, `chat:write`.

### 3. Install the Gemini extension (preferred)

This is the path that matches how GitHub's own MCP ships for Gemini CLI.

```bash
gemini extensions install https://github.com/salahuddinuqaili/agy-slack
```

Gemini prompts for `SLACK_USER_TOKEN` (keychain), loads `GEMINI.md` as session
context, and registers slash commands. Leave safety mode as `confirm`.

If the extension is installed but disabled:

```bash
gemini extensions enable agy-slack
```

| Command | What it does |
|---|---|
| `/slack:catchup` | Unreads + mentions. Does not send. |
| `/slack:standup` | Yesterday / today / blockers. |
| `/slack:search …` | Search, then quote the thread. |
| `/slack:draft …` | Read a permalink, draft a reply. |
| `/slack:who` | Identity, token kind, safety mode. |

The extension declares every env var Gemini will pass (`SLACK_USER_TOKEN` is
`sensitive: true`). Undeclared `*TOKEN*` process env is redacted.

### 4. Trust the folder

v0.59 **fails closed** on untrusted workspaces and filters `mcpServers`
(see [google-gemini/gemini-cli#29099](https://github.com/google-gemini/gemini-cli/pull/29099)).
When Gemini asks to trust this folder, accept. Otherwise the server shows as
Disconnected.

### 5. Reload and verify

Restart Gemini CLI, or type `/mcp` in the TUI:

```bash
gemini mcp list
```

You should see `agy-slack` connected. The name is hyphenated on purpose —
`agy_slack` breaks Gemini’s `mcp_{server}_{tool}` policy parser.

### 6. First prompt

```
Catch me up on #eng from this morning.
```

or `/slack:catchup`. A send is previewed. Confirm in Gemini’s tool gate, then
again with `confirm=true`. That double gate is intentional.

## Without the extension

Same server, no session context or slash commands. Writes
`~/.gemini/settings.json` (user) or `.gemini/settings.json` (project).

```bash
export SLACK_USER_TOKEN=xoxp-...
npx github:salahuddinuqaili/agy-slack install --client gemini
```

Or the native Gemini command (user scope):

```bash
gemini mcp add -s user \
  -e SLACK_USER_TOKEN=$SLACK_USER_TOKEN \
  -e SLACK_MCP_MODE=confirm \
  --timeout 60000 \
  agy-slack npx -- -y github:salahuddinuqaili/agy-slack
```

`--` is required so `-y` is an argument to `npx`, not to `gemini mcp add`.
Then `/mcp`. Trust the folder if asked.

## settings.json shape

The installer merges this into your existing settings (theme, models, etc. stay):

```json
{
  "mcpServers": {
    "agy-slack": {
      "command": "npx",
      "args": ["-y", "github:salahuddinuqaili/agy-slack"],
      "env": {
        "SLACK_MCP_MODE": "confirm",
        "SLACK_USER_TOKEN": "$SLACK_USER_TOKEN",
        "SLACK_BOT_TOKEN": "$SLACK_BOT_TOKEN"
      },
      "timeout": 60000,
      "trust": false
    }
  }
}
```

- **`$SLACK_USER_TOKEN`** is expanded from your shell env at runtime. Gemini redacts `*TOKEN*` process env unless the key is listed here — listing it is required.
- **`timeout: 60000`** — Slack user lists on large workspaces are paginated; the Gemini default is fine, 60s is safer.
- **`trust: false`** — Gemini will confirm each tool call. Combined with `SLACK_MCP_MODE=confirm`, a send needs both Gemini's approval and `confirm=true`. That is intentional.
- **Server name is `agy-slack` (hyphen).** Gemini fully-qualified tool names are `mcp_{server}_{tool}`. Underscores in the server name break the policy parser.

Project-only install:

```bash
npx github:salahuddinuqaili/agy-slack install --client gemini --workspace .
```

writes `.gemini/settings.json` in that repo.

## HTTP (`httpUrl`)

```bash
npx github:salahuddinuqaili/agy-slack serve --http --port 8787
```

```json
{
  "mcpServers": {
    "agy-slack": {
      "httpUrl": "http://127.0.0.1:8787/mcp",
      "timeout": 60000,
      "trust": false
    }
  }
}
```

Do not use `url` (that's SSE) or `serverUrl` (that's Antigravity).

Native:

```bash
gemini mcp add -s user --transport http --timeout 60000 \
  agy-slack http://127.0.0.1:8787/mcp
```

## Withhold writes

Gemini's field is `excludeTools`, not Antigravity's `disabledTools`:

```json
{
  "mcpServers": {
    "agy-slack": {
      "command": "npx",
      "args": ["-y", "github:salahuddinuqaili/agy-slack"],
      "env": { "SLACK_USER_TOKEN": "$SLACK_USER_TOKEN", "SLACK_MCP_MODE": "readonly" },
      "excludeTools": [
        "slack_send", "slack_edit", "slack_delete",
        "slack_react", "slack_upload", "slack_create_channel",
        "slack_status"
      ],
      "timeout": 60000,
      "trust": false
    }
  }
}
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Server missing from `/mcp` | You edited `mcp_config.json`. Gemini reads **`settings.json`**. Re-run `install --client gemini`. |
| `Disconnected` on stdio | Trust the workspace. v0.59 filters MCP in restricted mode. |
| Tools named oddly | Server must be `agy-slack`, not `agy_slack`. |
| Empty search | User token (`xoxp-`) in env, and the `env` block must list `SLACK_USER_TOKEN`. |
| Double confirm on send | Expected: Gemini `trust: false` plus `SLACK_MCP_MODE=confirm`. Set `trust: true` only if you accept Gemini skipping its gate. |
| HTTP 404 / no tools | You used `url` or `serverUrl`. Gemini HTTP is **`httpUrl`**. |

Official Gemini MCP docs: [MCP servers with Gemini CLI](https://geminicli.com/docs/tools/mcp-server/).
