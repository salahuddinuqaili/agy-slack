# Contributing

## Principles

1. **Fewer, better tools.** If a new Slack method can be an argument on an existing tool, do that. Do not wrap the Web API 1:1.
2. **Descriptions are for the model.** Write when to use, when not to use, and which name formats are accepted.
3. **Keep output compact.** Names, not IDs. Markdown, not JSON dumps (unless `SLACK_MCP_OUTPUT=json`).
4. **No stealth tokens.** User (`xoxp`) and bot (`xoxb`) only.
5. **Tests first for parsers.** Time, permalinks, entity resolution, and confirm-mode writes all have unit tests.

## Setup

```bash
npm install
npm test
npm run build
```

Demo adapter tests do not need a Slack token.

## Pull requests

- Keep the tool catalog (`src/core/catalog.ts`) as the single source of descriptions.
- If you add a write, it must go through `gateWrite`.
- Do not log tokens, cookies, or authorization headers.
