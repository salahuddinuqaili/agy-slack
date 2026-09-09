# Changelog

## 1.1.0 — 2026-09-09

- 1,000-user resolution suite in CI (unicode, collisions, deleted, prefix traps).
- Indexed `UserDirectory`: exact `@handle` / email / U-id lookups are O(1).
- Ambiguous names (`@Alex` with fifty Alexes) return candidates instead of a silent pick.
- `ann` no longer steals `anna` / `annabelle`. Deleted users are skipped unless you pass a U-id.
- Unicode folding: `José`, `Søren`, `Müller`, `李伟`, `O'Brien`, `j.smith.0`.
- Allow / deny lists accept `@maya` for DMs, not just `#channel`.
- Live `users.list` / `conversations.list` paginate 1,000 at a time.
- Gemini CLI v0.59 installer: writes `~/.gemini/settings.json`, `$VAR` expansion, `httpUrl`, `timeout`/`trust`, native `gemini mcp add`.

## 1.0.0 — 2026-09-09

- First public release.
- 15 agent-native Slack tools, 4 resources, 5 prompts.
- Entity resolution for `#channel`, `@user`, and permalinks.
- Time windows: `today`, `4h`, `7d`, weekdays, ISO, unix.
- Safety modes: `readonly` | `confirm` | `write`.
- Antigravity installer writing `~/.gemini/config/mcp_config.json` and `.agents/mcp_config.json`.
- Stdio + Streamable HTTP transports.
- Northstar demo workspace (`--demo`).
