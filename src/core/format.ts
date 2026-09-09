import { formatClock, formatDay } from "./time";
import { mrkdwnToMarkdown } from "./mrkdwn";
import type {
  AuthInfo,
  OutputFormat,
  SlackChannel,
  SlackMessage,
  SlackUser,
  ToolResult,
} from "./types";

export function resultOf(text: string, structured?: unknown, isError = false): ToolResult {
  return { text, structured, isError };
}

export function asOutput(format: OutputFormat, markdown: string, structured: unknown): ToolResult {
  if (format === "json") {
    return resultOf(JSON.stringify(structured, null, 2), structured);
  }
  return resultOf(markdown, structured);
}

export function displayName(user: SlackUser | undefined, fallback?: string): string {
  if (!user) return fallback ? `@${fallback}` : "@unknown";
  const handle = user.displayName || user.name;
  return `@${handle}`;
}

export function userMap(users: SlackUser[]): Map<string, SlackUser> {
  return new Map(users.map((u) => [u.id, u]));
}

export function mentionify(text: string, users: Map<string, SlackUser>): string {
  return text.replace(/<@([A-Z0-9]+)>/g, (_, id: string) => displayName(users.get(id), id));
}

export function formatMessages(opts: {
  channel: SlackChannel;
  messages: SlackMessage[];
  users: SlackUser[];
  tz: string;
  title?: string;
}): string {
  const users = userMap(opts.users);
  const heading = opts.title ?? channelLabel(opts.channel);
  if (!opts.messages.length) {
    return `${heading}\n\n(no messages in range)`;
  }
  const chronological = [...opts.messages].sort((a, b) => Number(a.ts) - Number(b.ts));
  const lines: string[] = [
    `${heading} · ${chronological.length} message${chronological.length === 1 ? "" : "s"}`,
    "",
  ];
  let lastDay = "";
  for (const msg of chronological) {
    const ts = Number(msg.ts);
    const day = formatDay(ts, opts.tz);
    if (day !== lastDay) {
      lines.push(`— ${day} —`);
      lastDay = day;
    }
    const who = displayName(users.get(msg.user ?? ""), msg.user);
    const clock = formatClock(ts, opts.tz);
    const body = mrkdwnToMarkdown(mentionify(msg.text || "", users)).trim() || "(file or empty)";
    const meta: string[] = [];
    if (msg.replyCount) meta.push(`${msg.replyCount} ${msg.replyCount === 1 ? "reply" : "replies"}`);
    if (msg.reactions?.length) {
      meta.push(msg.reactions.map((r) => `:${r.name}:×${r.count}`).join(" "));
    }
    if (msg.isPinned) meta.push("pinned");
    if (msg.files?.length) meta.push(msg.files.map((f) => `file:${f.name}`).join(" "));
    lines.push(`${clock}  ${who}  ·  ${msg.ts}`);
    for (const paragraph of body.split("\n")) {
      lines.push(`  ${paragraph}`);
    }
    if (meta.length) lines.push(`  ${meta.join(" · ")}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export function channelLabel(channel: SlackChannel): string {
  if (channel.isIm) return `dm:${channel.name}`;
  if (channel.isMpim) return channel.name.startsWith("mpdm") ? channel.name : `gdm:${channel.name}`;
  return `#${channel.name}`;
}

export function formatChannelList(channels: SlackChannel[], users: SlackUser[]): string {
  if (!channels.length) return "No channels matched.";
  const um = userMap(users);
  const lines = ["channel  unread  members  topic", "-------  ------  -------  -----"];
  for (const c of channels) {
    const name = c.isIm
      ? `dm ${displayName(um.get(c.user ?? ""), c.name)}`
      : `${c.isPrivate ? "priv " : "#"}${c.name}`;
    const unread = c.unreadCount ? String(c.unreadCount) : ".";
    const members = c.memberCount != null ? String(c.memberCount) : ".";
    const topic = (c.topic || c.purpose || "").replace(/\s+/g, " ").slice(0, 60);
    lines.push(`${name.padEnd(22)} ${unread.padStart(6)}  ${members.padStart(7)}  ${topic}`);
  }
  return lines.join("\n");
}

export function formatUsers(users: SlackUser[]): string {
  if (!users.length) return "No people matched.";
  return users
    .map((u) => {
      const status = u.statusText ? ` · ${u.statusEmoji ?? ""} ${u.statusText}`.trim() : "";
      const title = u.title ? ` — ${u.title}` : "";
      const tz = u.tz ? ` · ${u.tz}` : "";
      return `${displayName(u)}  ${u.realName}${title}${tz}${status}  ·  ${u.id}`;
    })
    .join("\n");
}

export function formatWhoami(auth: AuthInfo, extra: Record<string, unknown>): string {
  const lines = [
    `${auth.user}  ·  ${auth.team}`,
    `user_id  ${auth.userId}`,
    `team_id  ${auth.teamId}`,
    `token    ${auth.tokenKind}`,
  ];
  for (const [k, v] of Object.entries(extra)) {
    lines.push(`${k.padEnd(8)}${stringify(v)}`);
  }
  return lines.join("\n");
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (v == null) return "—";
  return JSON.stringify(v);
}
