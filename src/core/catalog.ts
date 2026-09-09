import type { ToolDef } from "./types";

export const SERVER_NAME = "agy-slack";
export const SERVER_VERSION = "1.3.0";

export const TOOLS: ToolDef[] = [
  {
    name: "slack_whoami",
    title: "Who am I",
    group: "workspace",
    write: false,
    description:
      "Return the authenticated Slack identity, workspace, token kind (bot/user/demo), safety mode, and which capabilities are available (search, DMs, posting). Call this first in a new session.",
    args: [],
  },
  {
    name: "slack_channels",
    title: "List channels",
    group: "read",
    write: false,
    description:
      "List or filter Slack channels and DMs. Accepts a name prefix or #name. Returns id, name, topic, unread count, privacy, and membership. Use before reading if you do not already know the channel.",
    args: [
      {
        name: "query",
        type: "string",
        description: "Optional name prefix or substring, e.g. eng or #incidents",
      },
      {
        name: "include_archived",
        type: "boolean",
        description: "Include archived channels (default false)",
      },
      {
        name: "limit",
        type: "number",
        description: "Max results (default 50, max 200)",
      },
    ],
  },
  {
    name: "slack_users",
    title: "Find people",
    group: "read",
    write: false,
    description:
      "Find people by name, @handle, email, or user ID. Returns display name, title, timezone, status, and id. Use this to resolve @mentions before sending DMs or reading a user's messages.",
    args: [
      {
        name: "query",
        type: "string",
        description: "Name, @handle, email, or U-id. Empty lists a compact roster.",
      },
      {
        name: "limit",
        type: "number",
        description: "Max results (default 20)",
      },
    ],
  },
  {
    name: "slack_read",
    title: "Read conversation",
    group: "read",
    write: false,
    description: `Read a channel, DM, or thread as compact markdown (names, not raw IDs).

channel accepts: #eng, C123, @maya (opens/reads that DM), or a Slack permalink.
since/latest accept: "today", "yesterday", "4h", "7d", "1w", ISO dates, unix seconds.
Pass thread_ts (or a permalink with /p…) to read a thread instead of channel history.

Do not use this to search the whole workspace — use slack_search.
Do not use this for a cross-channel catch-up — use slack_unreads.`,
    args: [
      {
        name: "channel",
        type: "string",
        required: true,
        description: "#name, channel id, @user for a DM, or permalink",
      },
      {
        name: "since",
        type: "string",
        description: 'Oldest bound: "today", "4h", "7d", "yesterday", ISO date',
      },
      {
        name: "latest",
        type: "string",
        description: "Newest bound (default now)",
      },
      {
        name: "thread_ts",
        type: "string",
        description: "Thread timestamp. If omitted, channel history is returned.",
      },
      {
        name: "limit",
        type: "number",
        description: "Max messages (default 40, max 200)",
      },
    ],
  },
  {
    name: "slack_search",
    title: "Search Slack",
    group: "read",
    write: false,
    description: `Search messages across the workspace. Requires a user token (xoxp) in live mode; demo mode always works.

Supports Slack modifiers: in:#eng from:@maya has:link has:pin before:2026-09-01 after:yesterday is:thread.

If search is unavailable (bot-token-only), this tool says so and suggests slack_read on likely channels instead of silently returning nothing.`,
    args: [
      {
        name: "query",
        type: "string",
        required: true,
        description: 'Search query, e.g. "auth rotation in:#eng from:@maya"',
      },
      {
        name: "sort",
        type: "string",
        enum: ["timestamp", "score"],
        description: "timestamp (newest) or score (relevance). Default timestamp.",
      },
      {
        name: "limit",
        type: "number",
        description: "Max results (default 20)",
      },
    ],
  },
  {
    name: "slack_unreads",
    title: "Catch up",
    group: "read",
    write: false,
    description:
      "Workspace catch-up: unread channels and DMs, plus recent mentions, packed as compact markdown. Prefer this when the user says catch me up, what did I miss, or what's unread. Optional channel filter.",
    args: [
      {
        name: "channel",
        type: "string",
        description: "Optional #channel to restrict the catch-up",
      },
    ],
  },
  {
    name: "slack_send",
    title: "Send message",
    group: "write",
    write: true,
    description: `Post a message or thread reply. channel accepts #name, id, @user (DM), or permalink.

In confirm mode (default) the first call returns a preview and a confirmation token; call again with confirm=true to actually send. In readonly mode this is blocked. In write mode it sends immediately.

Write Slack-flavored text: *bold*, _italic_, \`code\`, <url|label>, <@U123> or @name (resolved for you).`,
    args: [
      {
        name: "channel",
        type: "string",
        required: true,
        description: "#channel, id, @user, or permalink",
      },
      {
        name: "text",
        type: "string",
        required: true,
        description: "Message text (mrkdwn)",
      },
      {
        name: "thread_ts",
        type: "string",
        description: "Reply in this thread",
      },
      {
        name: "confirm",
        type: "boolean",
        description: "Required in confirm mode to actually send",
      },
    ],
  },
  {
    name: "slack_edit",
    title: "Edit message",
    group: "write",
    write: true,
    description:
      "Edit a message you can change. Requires channel + ts + new text. Same confirm/readonly rules as slack_send.",
    args: [
      {
        name: "channel",
        type: "string",
        required: true,
        description: "#channel, id, or permalink",
      },
      {
        name: "ts",
        type: "string",
        required: true,
        description: "Message timestamp",
      },
      {
        name: "text",
        type: "string",
        required: true,
        description: "Replacement text",
      },
      {
        name: "confirm",
        type: "boolean",
        description: "Required in confirm mode",
      },
    ],
  },
  {
    name: "slack_delete",
    title: "Delete message",
    group: "write",
    write: true,
    description:
      "Delete a message. Destructive. Always confirm-gated unless SLACK_MCP_MODE=write. Prefer editing when the user asked to fix a typo.",
    args: [
      {
        name: "channel",
        type: "string",
        required: true,
        description: "#channel, id, or permalink",
      },
      {
        name: "ts",
        type: "string",
        required: true,
        description: "Message timestamp",
      },
      {
        name: "confirm",
        type: "boolean",
        description: "Required in confirm mode",
      },
    ],
  },
  {
    name: "slack_react",
    title: "React",
    group: "write",
    write: true,
    description:
      "Add or remove an emoji reaction on a message. emoji is a name without colons (white_check_mark, eyes, +1). Confirm-gated like other writes.",
    args: [
      {
        name: "channel",
        type: "string",
        required: true,
        description: "#channel, id, or permalink",
      },
      {
        name: "ts",
        type: "string",
        required: true,
        description: "Message timestamp",
      },
      {
        name: "emoji",
        type: "string",
        required: true,
        description: "Emoji name without colons",
      },
      {
        name: "action",
        type: "string",
        enum: ["add", "remove"],
        description: "add (default) or remove",
      },
      {
        name: "confirm",
        type: "boolean",
        description: "Required in confirm mode",
      },
    ],
  },
  {
    name: "slack_upload",
    title: "Upload file",
    group: "write",
    write: true,
    description:
      "Upload a small text/markdown/json file into a channel. For binary files, tell the user to drag-drop in Slack — this tool is for agent-authored notes, diffs, and logs. Confirm-gated.",
    args: [
      {
        name: "channel",
        type: "string",
        required: true,
        description: "#channel, id, or @user",
      },
      {
        name: "filename",
        type: "string",
        required: true,
        description: "File name including extension",
      },
      {
        name: "content",
        type: "string",
        required: true,
        description: "UTF-8 file contents",
      },
      {
        name: "title",
        type: "string",
        description: "Optional title",
      },
      {
        name: "comment",
        type: "string",
        description: "Optional message to share with the file",
      },
      {
        name: "confirm",
        type: "boolean",
        description: "Required in confirm mode",
      },
    ],
  },
  {
    name: "slack_create_channel",
    title: "Create channel",
    group: "write",
    write: true,
    description:
      "Create a public or private channel and optionally set its topic. Name is slugified. Confirm-gated.",
    args: [
      {
        name: "name",
        type: "string",
        required: true,
        description: "Channel name without #",
      },
      {
        name: "topic",
        type: "string",
        description: "Optional topic",
      },
      {
        name: "is_private",
        type: "boolean",
        description: "Create a private channel (default false)",
      },
      {
        name: "confirm",
        type: "boolean",
        description: "Required in confirm mode",
      },
    ],
  },
  {
    name: "slack_pins",
    title: "Pins",
    group: "write",
    write: true,
    description:
      "List, add, or remove pins in a channel. Listing is a read; add/remove are writes and confirm-gated.",
    args: [
      {
        name: "channel",
        type: "string",
        required: true,
        description: "#channel, id, or permalink",
      },
      {
        name: "action",
        type: "string",
        enum: ["list", "add", "remove"],
        description: "list (default), add, or remove",
      },
      {
        name: "ts",
        type: "string",
        description: "Message timestamp (required for add/remove)",
      },
      {
        name: "confirm",
        type: "boolean",
        description: "Required in confirm mode for add/remove",
      },
    ],
  },
  {
    name: "slack_status",
    title: "Set status",
    group: "write",
    write: true,
    description:
      "Set or clear the authenticated user's Slack status. Pass empty text to clear. Confirm-gated.",
    args: [
      {
        name: "text",
        type: "string",
        description: "Status text. Empty or omitted clears the status.",
      },
      {
        name: "emoji",
        type: "string",
        description: "Emoji name without colons",
      },
      {
        name: "expiration",
        type: "string",
        description: 'When it expires: "1h", "today", unix, or ISO',
      },
      {
        name: "confirm",
        type: "boolean",
        description: "Required in confirm mode",
      },
    ],
  },
  {
    name: "slack_doctor",
    title: "Doctor",
    group: "meta",
    write: false,
    description:
      "Diagnose this MCP: token kind, missing scopes, search availability, safety mode, channel allow/deny lists, and Gemini/Antigravity config hints. Use when something fails or at install time.",
    args: [],
  },
];

export const PROMPTS = [
  {
    name: "catch_up",
    title: "Catch me up",
    description: "Unread channels, DMs, and mentions packed for a standup-quality brief.",
    arguments: [
      {
        name: "channel",
        description: "Optional #channel to restrict the brief",
        required: false,
      },
    ],
  },
  {
    name: "standup",
    title: "Draft standup",
    description: "Draft yesterday/today standup bullets from #eng and DMs.",
    arguments: [
      {
        name: "channel",
        description: "Home channel (default #eng)",
        required: false,
      },
    ],
  },
  {
    name: "find_decision",
    title: "Find a decision",
    description: "Search then read the surrounding thread to recover a decision.",
    arguments: [
      { name: "query", description: "What was decided", required: true },
    ],
  },
  {
    name: "draft_reply",
    title: "Draft a reply",
    description: "Read a thread and draft a reply in the channel's voice. Does not send.",
    arguments: [
      { name: "permalink", description: "Slack permalink or channel + ts", required: true },
    ],
  },
  {
    name: "incident_brief",
    title: "Incident brief",
    description: "Pull #incidents (or a named channel) into a timeline + owners + open questions.",
    arguments: [
      {
        name: "channel",
        description: "Incident channel (default #incidents)",
        required: false,
      },
    ],
  },
];

export function getTool(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}
