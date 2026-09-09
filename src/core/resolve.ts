import type { SlackChannel, SlackUser } from "./types";

export interface PermalinkRef {
  channel: string;
  ts: string;
  threadTs?: string;
}

export interface ResolvedChannel {
  channel: SlackChannel;
  threadTs?: string;
  messageTs?: string;
}

const PERMALINK_RE =
  /\/archives\/([A-Z0-9]+)(?:\/p(\d{16}))?(?:\?.*\bthread_ts=(\d+\.\d+))?/i;

export function parsePermalink(input: string): PermalinkRef | undefined {
  const m = PERMALINK_RE.exec(input);
  if (!m) return undefined;
  const channel = m[1];
  const packed = m[2];
  const threadTs = m[3];
  const ts = packed ? `${packed.slice(0, 10)}.${packed.slice(10)}` : undefined;
  if (!ts) return { channel, ts: threadTs ?? "" };
  return { channel, ts, threadTs };
}

export function slackifyTs(ts: string): string {
  const t = ts.trim();
  if (/^\d{16}$/.test(t)) return `${t.slice(0, 10)}.${t.slice(10)}`;
  if (/^p\d{16}$/i.test(t)) return `${t.slice(1, 11)}.${t.slice(11)}`;
  return t;
}

export function normalizeName(input: string): string {
  return input.trim().replace(/^[#@]/, "").toLowerCase();
}

export function findUser(users: SlackUser[], query: string): SlackUser | undefined {
  const q = query.trim();
  if (!q) return undefined;
  const idHit = users.find((u) => u.id === q);
  if (idHit) return idHit;
  const n = normalizeName(q);
  const scored = users
    .map((u) => ({ u, s: userScore(u, n, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored[0]?.u;
}

function userScore(u: SlackUser, n: string, raw: string): number {
  if (u.id === raw) return 100;
  const name = u.name.toLowerCase();
  const display = (u.displayName || "").toLowerCase();
  const real = (u.realName || "").toLowerCase();
  const email = (u.email || "").toLowerCase();
  if (name === n || display === n) return 90;
  if (email === n || email.split("@")[0] === n) return 80;
  if (real === n) return 75;
  if (name.startsWith(n) || display.startsWith(n)) return 60;
  if (real.startsWith(n)) return 50;
  if (name.includes(n) || display.includes(n) || real.includes(n)) return 30;
  if (email.includes(n)) return 20;
  return 0;
}

export function findChannel(
  channels: SlackChannel[],
  query: string,
): SlackChannel | undefined {
  const q = query.trim();
  if (!q) return undefined;
  const byId = channels.find((c) => c.id === q);
  if (byId) return byId;
  const n = normalizeName(q);
  const exact = channels.find(
    (c) => c.name.toLowerCase() === n || c.nameNormalized.toLowerCase() === n,
  );
  if (exact) return exact;
  const starts = channels.filter(
    (c) =>
      c.name.toLowerCase().startsWith(n) || c.nameNormalized.toLowerCase().startsWith(n),
  );
  if (starts.length === 1) return starts[0];
  const includes = channels.filter(
    (c) =>
      c.name.toLowerCase().includes(n) ||
      (c.topic || "").toLowerCase().includes(n) ||
      (c.purpose || "").toLowerCase().includes(n),
  );
  return includes[0];
}

export function resolveChannelRef(
  input: string,
  channels: SlackChannel[],
  users: SlackUser[],
): ResolvedChannel {
  const trimmed = input.trim();
  const permalink = parsePermalink(trimmed);
  if (permalink) {
    const channel =
      findChannel(channels, permalink.channel) ??
      ({
        id: permalink.channel,
        name: permalink.channel,
        nameNormalized: permalink.channel.toLowerCase(),
      } satisfies SlackChannel);
    return {
      channel,
      threadTs: permalink.threadTs,
      messageTs: permalink.ts || undefined,
    };
  }

  if (trimmed.startsWith("@") || /^U[A-Z0-9]+$/i.test(trimmed)) {
    const user = findUser(users, trimmed);
    if (!user) {
      throw new Error(`No user matching "${trimmed}". Try slack_users first.`);
    }
    const dm = channels.find((c) => c.isIm && c.user === user.id);
    if (!dm) {
      return {
        channel: {
          id: `pending-im:${user.id}`,
          name: user.name,
          nameNormalized: user.name.toLowerCase(),
          isIm: true,
          user: user.id,
        },
      };
    }
    return { channel: dm };
  }

  const channel = findChannel(channels, trimmed);
  if (!channel) {
    throw new Error(
      `No channel matching "${trimmed}". Use #name, a C-id, @user for a DM, or a permalink.`,
    );
  }
  return { channel };
}

export function channelAllowed(
  channel: SlackChannel,
  allow: string[],
  deny: string[],
): { ok: boolean; reason?: string } {
  const names = new Set(
    [channel.id, `#${channel.name}`, channel.name, channel.user]
      .filter(Boolean)
      .map((s) => s!.toLowerCase()),
  );
  const match = (list: string[]) =>
    list.some((item) => names.has(item.replace(/^#/, "").toLowerCase()) || names.has(item.toLowerCase()));
  if (deny.length && match(deny)) {
    return { ok: false, reason: `#${channel.name} is on SLACK_MCP_DENY_CHANNELS` };
  }
  if (allow.length && !match(allow)) {
    return { ok: false, reason: `#${channel.name} is not on SLACK_MCP_ALLOW_CHANNELS` };
  }
  return { ok: true };
}
