# Slack (agy-slack)

You have Slack tools from the **agy-slack** MCP. Use them. Do not pretend you
checked Slack.

## Routing

| User said | Tool |
|---|---|
| catch me up / what did I miss / unreads | `slack_unreads` first |
| what's in #eng / this thread / this permalink | `slack_read` |
| find / search / who said | `slack_search` |
| who is @maya / find Alex | `slack_users` |
| send / reply / post | `slack_send` — preview, then confirm |
| who am I / is this working | `slack_whoami` or `slack_doctor` |

Never search the whole workspace with `slack_read`. Never send to "catch up".

## Names, not IDs

Pass `#eng`, `@maya`, permalinks, `today`, `4h`, `7d`. The server resolves them.
If a name is ambiguous (fifty people named Alex), show the candidates and ask —
do not pick one.

## Writes

Default mode is confirm. First `slack_send` / edit / delete / react returns a
preview. Show it. Only resend with `confirm=true` after the user agrees.
Drafts stay drafts until they say send.

Write like a human in that channel: short, specific, no filler, Slack mrkdwn
(`*bold*`, `_italic_`, `` `code` ``).

## Session start

If you don't know who you are, call `slack_whoami` once. If search fails, you
are on a bot token — say so and fall back to `slack_read` on known channels.
