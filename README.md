# agy-slack

**The Slack MCP purpose-built for [Google Antigravity CLI](https://antigravity.google/).**

Agent-native tools. Names instead of IDs. Confirm-before-send. One command to install.

```bash
npx github:salahuddinuqaili/agy-slack install --client antigravity
```

Then in Antigravity CLI, type `/mcp`, reload, and ask:

> Catch me up on #eng from this morning.

---

## Why this exists

Slack already has an official hosted MCP, and there are community servers that wrap 200+ raw Web API methods. Neither is a good fit for Antigravity.

| | Official Slack MCP | Raw API wrappers | **agy-slack** |
|---|---|---|---|
| Install into Antigravity | OAuth app + `serverUrl` | Generic stdio JSON | **One command, exact config paths** |
| Tool surface | Hosted, not auditable | 200+ tools, poor tool-choice | **15 agent-native tools** |
| Channel / user refs | IDs | IDs | **`#eng`, `@maya`, permalinks** |
| Time windows | Dates | Unix | **`today`, `4h`, `7d`, `yesterday`** |
| Writes | Immediate | Immediate | **`readonly` / `confirm` / `write`** |
| Output | JSON dumps | JSON dumps | **Compact markdown** |
| Try without Slack | No | No | **`--demo` Northstar workspace** |

Antigravity CLI reads `~/.gemini/config/mcp_config.json` (and workspace `.agents/mcp_config.json`), uses **`serverUrl`** (not `url`) for HTTP, and runs MCP tools in **Ask mode** by default. agy-slack is built around that.

---

## Install

### Antigravity CLI (recommended)

1. Create a [Slack app](https://api.slack.com/apps) (or reuse one). User token (`xoxp-`) is strongly recommended so search and DMs work. Bot token (`xoxb-`) is enough to post as the app in channels it has joined.
2. Run:

```bash
export SLACK_USER_TOKEN=xoxp-...
export SLACK_BOT_TOKEN=xoxb-...          # optional
export SLACK_MCP_MODE=confirm            # default

npx github:salahuddinuqaili/agy-slack install --client antigravity
```

3. In Antigravity CLI, type `/mcp` and reload. You should see **agy-slack** with 15 tools, 4 resources, and 5 prompts.

The installer writes:

- `~/.gemini/config/mcp_config.json` — global
- `~/.gemini/antigravity/mcp_config.json` — legacy path some clients still read
- `.agents/mcp_config.json` — if you pass `--workspace .`

### Manual config

```json
{
  "mcpServers": {
    "agy-slack": {
      "command": "npx",
      "args": ["-y", "github:salahuddinuqaili/agy-slack"],
      "env": {
        "SLACK_USER_TOKEN": "xoxp-...",
        "SLACK_MCP_MODE": "confirm"
      }
    }
  }
}
```

HTTP (for `serverUrl` clients):

```bash
npx github:salahuddinuqaili/agy-slack serve --http --port 8787
```

```json
{
  "mcpServers": {
    "agy-slack": {
      "serverUrl": "http://127.0.0.1:8787/mcp"
    }
  }
}
```

### Demo mode (no Slack token)

```bash
npx github:salahuddinuqaili/agy-slack demo
```

or `SLACK_MCP_DEMO=1`. Ships a fictional **Northstar** workspace so you can evaluate tools without credentials.

### Other clients

```bash
npx github:salahuddinuqaili/agy-slack install --client claude
npx github:salahuddinuqaili/agy-slack install --client cursor
npx github:salahuddinuqaili/agy-slack install --client all
```

---

## Tools

Fifteen tools. Descriptions are written for the model, not as API docs.

| Tool | What it does |
|---|---|
| `slack_whoami` | Identity, workspace, token kind, safety mode |
| `slack_channels` | List / filter channels and DMs |
| `slack_users` | Find people by name, `@handle`, email, id |
| `slack_read` | Channel, DM, or thread as compact markdown |
| `slack_search` | Workspace search (`in:#eng from:@maya has:pin`) |
| `slack_unreads` | Catch-up across unread conversations |
| `slack_send` | Post or reply (confirm-gated) |
| `slack_edit` | Edit a message |
| `slack_delete` | Delete a message |
| `slack_react` | Add / remove emoji |
| `slack_upload` | Small text/markdown/json files |
| `slack_create_channel` | Public or private channel |
| `slack_pins` | List / add / remove pins |
| `slack_status` | Set or clear your status |
| `slack_doctor` | Diagnose tokens, search, mode, allowlists |

**Resources:** `slack://workspace`, `slack://channels`, `slack://unreads`, `slack://me`

**Prompts:** `catch_up`, `standup`, `find_decision`, `draft_reply`, `incident_brief`

---

## Entity resolution

These are all valid `channel` values:

- `#eng`
- `eng`
- `C0ENG`
- `@maya` (opens/reads that DM)
- `https://northstar-labs.slack.com/archives/C0ENG/p1757416260123456`

Time windows for `since` / `latest`:

- `today`, `yesterday`, `monday`
- `4h`, `90m`, `7d`, `1w`, `last 4h`
- ISO dates, unix seconds

---

## Safety

`SLACK_MCP_MODE` is the rail Antigravity Ask mode actually needs.

| Mode | Reads | Writes |
|---|---|---|
| `readonly` | yes | blocked, with a reason |
| `confirm` (default) | yes | returns a preview; resubmit with `confirm=true` |
| `write` | yes | sends immediately |

Optional allow / deny lists:

```bash
SLACK_MCP_ALLOW_CHANNELS=#eng,#incidents,@maya
SLACK_MCP_DENY_CHANNELS=#all-hands
```

Tokens are never logged. `slack_doctor` redacts them.

---

## Slack app scopes

Minimum useful user-token scopes:

```
channels:history channels:read channels:write
groups:history groups:read groups:write
im:history im:read im:write
mpim:history mpim:read mpim:write
chat:write reactions:write
search:read
users:read users:read.email users.profile:write
files:write pins:write pins:read
```

Invite the bot to any private channel it should see (`/invite @your-app`).

This project does **not** use browser session tokens (`xoxc` / `xoxd`). That's a ToS risk and a trust problem for an MCP that sits on your agent.

---

## Antigravity notes

- Config key for remote servers is **`serverUrl`**, not `url`.
- Tools default to Ask mode. `confirm` mode plus Ask mode means nothing posts until both the model and you agree.
- Withhold tools with `disabledTools` if you want a read-only profile without env:

```json
{
  "mcpServers": {
    "agy-slack": {
      "command": "npx",
      "args": ["-y", "github:salahuddinuqaili/agy-slack"],
      "disabledTools": [
        "slack_send", "slack_edit", "slack_delete",
        "slack_react", "slack_upload", "slack_create_channel",
        "slack_status"
      ]
    }
  }
}
```

- SDK agents can attach the same process via `McpStdioServer`.

```python
from google.antigravity.types import McpStdioServer

McpStdioServer(
    name="agy-slack",
    command="npx",
    args=["-y", "github:salahuddinuqaili/agy-slack"],
    env={"SLACK_USER_TOKEN": "...", "SLACK_MCP_MODE": "confirm"},
)
```

---

## Development

```bash
git clone https://github.com/salahuddinuqaili/agy-slack
cd agy-slack
npm install
npm test
npm run build
node dist/index.js doctor --demo
```

Node 20+. MIT licensed. Not affiliated with Slack, Salesforce, or Google.

---

## License

MIT © Salahuddin Uqaili
