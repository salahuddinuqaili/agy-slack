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

## Preferred: Gemini extension

This is the path that matches how GitHub's own MCP ships for Gemini CLI.

```bash
gemini extensions install https://github.com/salahuddinuqaili/agy-slack
```

Gemini prompts for the user token (keychain), loads `GEMINI.md` as session
context, and registers slash commands:

| Command | What it does |
|---|---|
| `/slack:catchup` | Unreads + mentions. Does not send. |
| `/slack:standup` | Yesterday / today / blockers. |
| `/slack:search …` | Search, then quote the thread. |
| `/slack:draft …` | Read a permalink, draft a reply. |
| `/slack:who` | Identity, token kind, safety mode. |

Then:

1. Restart Gemini CLI, or type `/mcp`.
2. If v0.59 asks you to trust the folder, do it. Untrusted workspaces **fail closed** and filter `mcpServers` (see [google-gemini/gemini-cli#29099](https://github.com/google-gemini/gemini-cli/pull/29099)).
3. `gemini mcp list` should show `agy-slack` as connected.
4. Ask: *Catch me up on #eng from this morning.* or type `/slack:catchup`.

The extension declares every env var Gemini will pass (`SLACK_USER_TOKEN` is
`sensitive: true`). Undeclared `*TOKEN*` process env is redacted.

## Settings.json path

If you would rather not use extensions:

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
