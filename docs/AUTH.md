# Auth

## Tokens

| Kind | Prefix | Use |
|---|---|---|
| User | `xoxp-` | Search, DMs, status, acting as you. **Recommended.** |
| Bot | `xoxb-` | Post as the app in channels it has joined. |

Set one or both:

```bash
export SLACK_USER_TOKEN=xoxp-...
export SLACK_BOT_TOKEN=xoxb-...
```

`SLACK_TOKEN` is accepted as an alias and classified by prefix.

## What we will not do

Browser session tokens (`xoxc` + `d` cookie) work in some community servers and violate Slack's terms. agy-slack will not add them.

## App creation

1. [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch.
2. OAuth & Permissions → User Token Scopes (see README).
3. Install to workspace.
4. Copy the user token. Invite the bot to private channels with `/invite`.

## Doctor

```bash
npx github:salahuddinuqaili/agy-slack doctor
```
