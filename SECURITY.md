# Security

## Report a vulnerability

Email the maintainer via GitHub: [salahuddinuqaili](https://github.com/salahuddinuqaili). Do not open a public issue for token leaks or RCE.

## What this server can do

With a user token it can read DMs, search the workspace, and post as you. Treat `SLACK_USER_TOKEN` like a password.

- Prefer `SLACK_MCP_MODE=confirm` (default) or `readonly`.
- Use `SLACK_MCP_ALLOW_CHANNELS` in shared agent environments.
- Never commit tokens. The installer writes them into local config files — keep those out of git.

## What we will not add

- Browser session tokens (`xoxc` / `xoxd`) or cookie replay.
- A proxy that forwards your Slack session to a third party.
- Dynamic client registration against Slack's hosted MCP (not supported by Slack).
