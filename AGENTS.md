# AGENTS.md — agy-slack

> For agents **working on this repo**. `GEMINI.md` is different: it is shipped to
> end users as the Gemini CLI extension context (`gemini-extension.json`
> `contextFileName`, and listed in package.json `files`). Do not replace it with a
> pointer; edit it only as a product change.

## Purpose
agy-slack: Slack MCP server for Antigravity CLI, Gemini CLI and VS Code Copilot.
Names not IDs, confirm before send. Public, MIT, published to npm. Owner: Sal.

## Walls and identity
- Commits are authored as **salahuddinuqaili**. Never commit as thebotgrok.
- **Confirm before commit:** show the diff and wait for Sal's OK before any new commit.
- Never force-push the default branch. Never commit secrets or `.env` files.
- Walled repos are listed in the private walls register; never read or reference them.
- Product rule: every write tool (send / edit / delete / react) defaults to
  **confirm mode** and returns a preview first. Never change that default.
- Never use a real Slack token in tests or examples. Use the demo workspace
  (`SLACK_MCP_DEMO=1`, fictional Northstar).
- Publishing to npm is Sal's action only.

## How to run
```sh
npm install
npm run build
node dist/index.js serve --demo     # or: npm run demo
node dist/index.js doctor --demo
```

## How to test
```sh
npm test           # tsx --test src/core/*.test.ts src/install.test.ts
npm run typecheck
npm run build
```
CI (`.github/workflows/ci.yml`) runs these on Node 20 and 22.

## Done = evidence
"Done" only with a pointer: a green CI run URL, pasted test output, or an artifact
path. No pointer, not done. Anything unverified is labelled unverified.

## Packaging rule
Short-lived branch (≤ 7 days) → one PR → **squash-merge only after the lila stamp**
→ delete the branch. No direct pushes to the default branch.
