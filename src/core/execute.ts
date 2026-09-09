import { TOOLS, getTool } from "./catalog";
import type { ServerConfig, SlackAdapter, SlackChannel, ToolArgs, ToolResult } from "./types";
import { parseExpiration, parseTimeRange } from "./time";
import { resolveChannelRef, UserDirectory } from "./resolve";
import type { SlackUser } from "./types";
import {
  asOutput,
  channelLabel,
  formatChannelList,
  formatMessages,
  formatUsers,
  formatWhoami,
  resultOf,
} from "./format";
import { formatConfirmation, gateWrite } from "./safety";
import { markdownToMrkdwn, slugifyChannel } from "./mrkdwn";

export interface ExecuteContext {
  adapter: SlackAdapter;
  config: ServerConfig;
  now?: Date;
  directory?: UserDirectory;
}

export async function executeTool(
  name: string,
  args: ToolArgs,
  ctx: ExecuteContext,
): Promise<ToolResult> {
  try {
    return await executeUnsafe(name, args, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return resultOf(message, { error: message }, true);
  }
}

async function executeUnsafe(
  name: string,
  args: ToolArgs,
  ctx: ExecuteContext,
): Promise<ToolResult> {
  switch (name) {
    case "slack_whoami":
      return whoami(ctx);
    case "slack_channels":
      return channels(args, ctx);
    case "slack_users":
      return users(args, ctx);
    case "slack_read":
      return read(args, ctx);
    case "slack_search":
      return search(args, ctx);
    case "slack_unreads":
      return unreads(args, ctx);
    case "slack_send":
      return send(args, ctx);
    case "slack_edit":
      return edit(args, ctx);
    case "slack_delete":
      return del(args, ctx);
    case "slack_react":
      return react(args, ctx);
    case "slack_upload":
      return upload(args, ctx);
    case "slack_create_channel":
      return createChannel(args, ctx);
    case "slack_pins":
      return pins(args, ctx);
    case "slack_status":
      return status(args, ctx);
    case "slack_doctor":
      return doctor(ctx);
    default:
      return resultOf(`Unknown tool ${name}. Known: ${TOOLS.map((t) => t.name).join(", ")}`, undefined, true);
  }
}

function str(args: ToolArgs, key: string): string | undefined {
  const v = args[key];
  if (v == null || v === "") return undefined;
  return String(v);
}

function bool(args: ToolArgs, key: string): boolean {
  const v = args[key];
  return v === true || v === "true";
}

function num(args: ToolArgs, key: string, fallback: number, max: number): number {
  const v = Number(args[key]);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.min(max, Math.floor(v));
}

async function whoami(ctx: ExecuteContext): Promise<ToolResult> {
  const auth = await ctx.adapter.auth();
  const tokens = ctx.adapter.tokenSummary();
  const extra = {
    mode: ctx.config.mode,
    output: ctx.config.output,
    search: ctx.adapter.hasSearch() ? "available" : "unavailable (need xoxp user token)",
    demo: tokens.demo,
    allow: ctx.config.allowChannels.join(",") || "all",
    deny: ctx.config.denyChannels.join(",") || "none",
    tz: ctx.config.tz,
    tools: TOOLS.length,
  };
  return asOutput(ctx.config.output, formatWhoami(auth, extra), { auth, ...extra });
}

async function channels(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const query = str(args, "query")?.toLowerCase();
  const includeArchived = bool(args, "include_archived");
  const limit = num(args, "limit", 50, 200);
  const users = await ctx.adapter.listUsers();
  let list = await ctx.adapter.listChannels();
  if (!includeArchived) list = list.filter((c) => !c.isArchived);
  if (query) {
    const q = query.replace(/^#/, "");
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.topic || "").toLowerCase().includes(q) ||
        (c.purpose || "").toLowerCase().includes(q),
    );
  }
  list = list.slice(0, limit);
  return asOutput(ctx.config.output, formatChannelList(list, users), { channels: list });
}

async function directoryOf(ctx: ExecuteContext, users?: SlackUser[]): Promise<UserDirectory> {
  if (ctx.directory) return ctx.directory;
  ctx.directory = new UserDirectory(users ?? (await ctx.adapter.listUsers()));
  return ctx.directory;
}

async function users(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const query = str(args, "query");
  const limit = num(args, "limit", 20, 100);
  const all = await ctx.adapter.listUsers();
  const dir = await directoryOf(ctx, all);
  const matched = query ? dir.search(query, { limit }).map((h) => h.user) : all.filter((u) => !u.deleted);
  const slice = matched.slice(0, limit);
  return asOutput(ctx.config.output, formatUsers(slice), { users: slice });
}

async function loadResolved(channelArg: string, ctx: ExecuteContext) {
  const [channels, users] = await Promise.all([
    ctx.adapter.listChannels(),
    ctx.adapter.listUsers(),
  ]);
  const dir = await directoryOf(ctx, users);
  const resolved = resolveChannelRef(channelArg, channels, dir);
  if (resolved.channel.id.startsWith("pending-im:") && resolved.channel.user) {
    const dm = await ctx.adapter.openDm(resolved.channel.user);
    return { ...resolved, channel: dm, users, channels };
  }
  return { ...resolved, users, channels };
}

async function read(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const channelArg = str(args, "channel");
  if (!channelArg) return resultOf("channel is required", undefined, true);
  const resolved = await loadResolved(channelArg, ctx);
  const threadTs = str(args, "thread_ts") || resolved.threadTs;
  const limit = num(args, "limit", ctx.config.maxMessages, 200);
  const range = parseTimeRange({
    since: str(args, "since"),
    latest: str(args, "latest"),
    now: ctx.now,
    tz: ctx.config.tz,
  });

  if (threadTs) {
    const { messages } = await ctx.adapter.replies({
      channel: resolved.channel.id,
      ts: threadTs,
      limit,
    });
    const md = formatMessages({
      channel: resolved.channel,
      messages,
      users: resolved.users,
      tz: ctx.config.tz,
      title: `${channelLabel(resolved.channel)} thread ${threadTs}`,
    });
    return asOutput(ctx.config.output, md, { channel: resolved.channel, threadTs, messages });
  }

  const { messages, nextCursor } = await ctx.adapter.history({
    channel: resolved.channel.id,
    oldest: range.oldest,
    latest: range.latest,
    limit,
  });
  const md = formatMessages({
    channel: resolved.channel,
    messages,
    users: resolved.users,
    tz: ctx.config.tz,
    title: `${channelLabel(resolved.channel)} · ${range.label}`,
  });
  return asOutput(ctx.config.output, nextCursor ? `${md}\n\nnext_cursor: ${nextCursor}` : md, {
    channel: resolved.channel,
    messages,
    nextCursor,
  });
}

async function search(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const query = str(args, "query");
  if (!query) return resultOf("query is required", undefined, true);
  if (!ctx.adapter.hasSearch()) {
    return resultOf(
      "Search needs a user token (xoxp-). Bot tokens cannot call search.messages. Set SLACK_USER_TOKEN, or read specific channels with slack_read.",
      { canSearch: false },
      true,
    );
  }
  const sort = str(args, "sort") === "score" ? "score" : "timestamp";
  const limit = num(args, "limit", 20, 50);
  const { messages, total, canSearch } = await ctx.adapter.search({ query, count: limit, sort });
  const users = await ctx.adapter.listUsers();
  const channels = await ctx.adapter.listChannels();
  const grouped = new Map<string, typeof messages>();
  for (const m of messages) {
    const arr = grouped.get(m.channel) ?? [];
    arr.push(m);
    grouped.set(m.channel, arr);
  }
  const parts = [`search “${query}” · ${messages.length} of ${total}`];
  for (const [cid, msgs] of grouped) {
    const ch = channels.find((c) => c.id === cid) ?? {
      id: cid,
      name: cid,
      nameNormalized: cid.toLowerCase(),
    };
    parts.push("");
    parts.push(
      formatMessages({
        channel: ch as SlackChannel,
        messages: msgs,
        users,
        tz: ctx.config.tz,
      }),
    );
  }
  return asOutput(ctx.config.output, parts.join("\n"), { query, total, canSearch, messages });
}

async function unreads(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const filter = str(args, "channel");
  let rows = await ctx.adapter.unreads();
  if (filter) {
    const resolved = await loadResolved(filter, ctx);
    rows = rows.filter((r) => r.channel.id === resolved.channel.id);
  }
  const users = await ctx.adapter.listUsers();
  if (!rows.length) {
    return asOutput(ctx.config.output, "Caught up. No unread channels.", { unreads: [] });
  }
  const parts = [`catch-up · ${rows.length} conversation${rows.length === 1 ? "" : "s"} with unreads`];
  for (const row of rows) {
    parts.push("");
    parts.push(
      formatMessages({
        channel: row.channel,
        messages: row.messages,
        users,
        tz: ctx.config.tz,
        title: `${channelLabel(row.channel)} · ${row.channel.unreadCount ?? row.messages.length} unread`,
      }),
    );
  }
  return asOutput(ctx.config.output, parts.join("\n"), { unreads: rows });
}

async function send(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const channelArg = str(args, "channel");
  const text = str(args, "text");
  if (!channelArg || !text) return resultOf("channel and text are required", undefined, true);
  const resolved = await loadResolved(channelArg, ctx);
  const threadTs = str(args, "thread_ts") || resolved.threadTs;
  const body = markdownToMrkdwn(text);
  const preview = `POST ${channelLabel(resolved.channel)}${threadTs ? ` thread ${threadTs}` : ""}\n\n${body}`;
  const gate = gateWrite({
    tool: "slack_send",
    args,
    config: ctx.config,
    channel: resolved.channel,
    preview,
  });
  if (gate?.blocked) return resultOf(gate.blocked, undefined, true);
  if (gate?.confirm) return resultOf(formatConfirmation(gate.confirm), gate.confirm);
  const msg = await ctx.adapter.postMessage({
    channel: resolved.channel.id,
    text: body,
    threadTs,
  });
  const link = await ctx.adapter.permalink({ channel: resolved.channel.id, ts: msg.ts });
  return asOutput(ctx.config.output, `sent · ${msg.ts}\n${link}`, { message: msg, permalink: link });
}

async function edit(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const channelArg = str(args, "channel");
  const ts = str(args, "ts");
  const text = str(args, "text");
  if (!channelArg || !ts || !text) return resultOf("channel, ts, and text are required", undefined, true);
  const resolved = await loadResolved(channelArg, ctx);
  const body = markdownToMrkdwn(text);
  const preview = `EDIT ${channelLabel(resolved.channel)} ${ts}\n\n${body}`;
  const gate = gateWrite({
    tool: "slack_edit",
    args,
    config: ctx.config,
    channel: resolved.channel,
    preview,
  });
  if (gate?.blocked) return resultOf(gate.blocked, undefined, true);
  if (gate?.confirm) return resultOf(formatConfirmation(gate.confirm), gate.confirm);
  const msg = await ctx.adapter.updateMessage({
    channel: resolved.channel.id,
    ts,
    text: body,
  });
  return asOutput(ctx.config.output, `edited · ${msg.ts}`, { message: msg });
}

async function del(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const channelArg = str(args, "channel");
  const ts = str(args, "ts");
  if (!channelArg || !ts) return resultOf("channel and ts are required", undefined, true);
  const resolved = await loadResolved(channelArg, ctx);
  const preview = `DELETE ${channelLabel(resolved.channel)} ${ts}`;
  const gate = gateWrite({
    tool: "slack_delete",
    args,
    config: ctx.config,
    channel: resolved.channel,
    preview,
  });
  if (gate?.blocked) return resultOf(gate.blocked, undefined, true);
  if (gate?.confirm) return resultOf(formatConfirmation(gate.confirm), gate.confirm);
  await ctx.adapter.deleteMessage({ channel: resolved.channel.id, ts });
  return asOutput(ctx.config.output, `deleted · ${ts}`, { ts });
}

async function react(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const channelArg = str(args, "channel");
  const ts = str(args, "ts");
  const emoji = str(args, "emoji")?.replaceAll(":", "");
  if (!channelArg || !ts || !emoji) return resultOf("channel, ts, and emoji are required", undefined, true);
  const action = str(args, "action") === "remove" ? "remove" : "add";
  const resolved = await loadResolved(channelArg, ctx);
  const preview = `${action.toUpperCase()} :${emoji}: on ${channelLabel(resolved.channel)} ${ts}`;
  const gate = gateWrite({
    tool: "slack_react",
    args,
    config: ctx.config,
    channel: resolved.channel,
    preview,
  });
  if (gate?.blocked) return resultOf(gate.blocked, undefined, true);
  if (gate?.confirm) return resultOf(formatConfirmation(gate.confirm), gate.confirm);
  await ctx.adapter.react({ channel: resolved.channel.id, ts, emoji, action });
  return asOutput(ctx.config.output, `${action} :${emoji}: · ${ts}`, { ts, emoji, action });
}

async function upload(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const channelArg = str(args, "channel");
  const filename = str(args, "filename");
  const content = str(args, "content");
  if (!channelArg || !filename || content == null) {
    return resultOf("channel, filename, and content are required", undefined, true);
  }
  const resolved = await loadResolved(channelArg, ctx);
  const preview = `UPLOAD ${filename} (${content.length} bytes) → ${channelLabel(resolved.channel)}`;
  const gate = gateWrite({
    tool: "slack_upload",
    args,
    config: ctx.config,
    channel: resolved.channel,
    preview,
  });
  if (gate?.blocked) return resultOf(gate.blocked, undefined, true);
  if (gate?.confirm) return resultOf(formatConfirmation(gate.confirm), gate.confirm);
  const file = await ctx.adapter.upload({
    filename,
    content,
    channel: resolved.channel.id,
    title: str(args, "title"),
    comment: str(args, "comment"),
  });
  return asOutput(ctx.config.output, `uploaded ${file.name} · ${file.id}`, { file });
}

async function createChannel(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const name = str(args, "name");
  if (!name) return resultOf("name is required", undefined, true);
  const slug = slugifyChannel(name);
  const isPrivate = bool(args, "is_private");
  const topic = str(args, "topic");
  const preview = `CREATE ${isPrivate ? "private" : "public"} #${slug}${topic ? `\ntopic: ${topic}` : ""}`;
  const gate = gateWrite({
    tool: "slack_create_channel",
    args,
    config: ctx.config,
    preview,
  });
  if (gate?.blocked) return resultOf(gate.blocked, undefined, true);
  if (gate?.confirm) return resultOf(formatConfirmation(gate.confirm), gate.confirm);
  const channel = await ctx.adapter.createChannel({ name: slug, isPrivate, topic });
  return asOutput(ctx.config.output, `created ${channelLabel(channel)} · ${channel.id}`, { channel });
}

async function pins(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const channelArg = str(args, "channel");
  if (!channelArg) return resultOf("channel is required", undefined, true);
  const action = str(args, "action") || "list";
  const resolved = await loadResolved(channelArg, ctx);
  if (action === "list") {
    const messages = await ctx.adapter.listPins(resolved.channel.id);
    const users = await ctx.adapter.listUsers();
    const md = formatMessages({
      channel: resolved.channel,
      messages,
      users,
      tz: ctx.config.tz,
      title: `${channelLabel(resolved.channel)} pins`,
    });
    return asOutput(ctx.config.output, md, { messages });
  }
  const ts = str(args, "ts");
  if (!ts) return resultOf("ts is required for add/remove", undefined, true);
  const preview = `${action.toUpperCase()} PIN ${channelLabel(resolved.channel)} ${ts}`;
  const gate = gateWrite({
    tool: "slack_pins",
    args,
    config: ctx.config,
    channel: resolved.channel,
    preview,
  });
  if (gate?.blocked) return resultOf(gate.blocked, undefined, true);
  if (gate?.confirm) return resultOf(formatConfirmation(gate.confirm), gate.confirm);
  await ctx.adapter.pin({
    channel: resolved.channel.id,
    ts,
    action: action === "remove" ? "remove" : "add",
  });
  return asOutput(ctx.config.output, `${action} pin · ${ts}`, { ts, action });
}

async function status(args: ToolArgs, ctx: ExecuteContext): Promise<ToolResult> {
  const text = str(args, "text") ?? "";
  const emoji = str(args, "emoji")?.replaceAll(":", "");
  const preview = text
    ? `SET STATUS ${emoji ? `:${emoji}: ` : ""}${text}`
    : "CLEAR STATUS";
  const gate = gateWrite({ tool: "slack_status", args, config: ctx.config, preview });
  if (gate?.blocked) return resultOf(gate.blocked, undefined, true);
  if (gate?.confirm) return resultOf(formatConfirmation(gate.confirm), gate.confirm);
  if (!text) {
    await ctx.adapter.clearStatus();
    return asOutput(ctx.config.output, "status cleared", { text: "" });
  }
  const expiration = parseExpiration(str(args, "expiration"), ctx.now ?? new Date(), ctx.config.tz);
  await ctx.adapter.setStatus({ text, emoji, expiration });
  return asOutput(ctx.config.output, `status set · ${text}`, { text, emoji, expiration });
}

async function doctor(ctx: ExecuteContext): Promise<ToolResult> {
  const auth = await ctx.adapter.auth();
  const tokens = ctx.adapter.tokenSummary();
  const lines = [
    "agy-slack doctor",
    "",
    `workspace   ${auth.team} (${auth.teamId})`,
    `user        ${auth.user} (${auth.userId})`,
    `token       ${auth.tokenKind}`,
    `bot token   ${tokens.bot ? "yes" : "no"}`,
    `user token  ${tokens.user ? "yes" : "no"}`,
    `demo        ${tokens.demo ? "yes" : "no"}`,
    `search      ${ctx.adapter.hasSearch() ? "ok" : "missing xoxp user token"}`,
    `mode        ${ctx.config.mode}`,
    `tz          ${ctx.config.tz}`,
    `allow       ${ctx.config.allowChannels.join(", ") || "(all)"}`,
    `deny        ${ctx.config.denyChannels.join(", ") || "(none)"}`,
    `tools       ${TOOLS.length}`,
  ];
  if (!tokens.demo && !tokens.user) {
    lines.push(
      "",
      "hint  A bot token cannot search or read DMs. Add SLACK_USER_TOKEN (xoxp) with search:read.",
    );
  }
  if (ctx.config.mode === "write") {
    lines.push("", "warn  SLACK_MCP_MODE=write sends without a preview. confirm is safer in Antigravity Ask mode.");
  }
  return asOutput(ctx.config.output, lines.join("\n"), { auth, tokens, config: ctx.config });
}

export function toolNames(): string[] {
  return TOOLS.map((t) => t.name);
}

export { getTool };
