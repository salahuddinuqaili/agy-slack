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

export type MatchReason =
  | "id"
  | "handle"
  | "email"
  | "compact"
  | "display"
  | "real"
  | "prefix"
  | "token"
  | "contains";

export interface UserHit {
  user: SlackUser;
  score: number;
  reason: MatchReason;
}

export interface ChannelHit {
  channel: SlackChannel;
  score: number;
}

export class AmbiguousRefError extends Error {
  constructor(
    message: string,
    readonly candidates: string[],
  ) {
    super(message);
    this.name = "AmbiguousRefError";
  }
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

/** Case-fold, strip diacritics, drop a leading #/@, and squeeze whitespace. */
export function fold(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe")
    .replace(/ß/g, "ss")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/[''`´]/g, "")
    .replace(/^[#@]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactName(input: string): string {
  return fold(input).replace(/[.\-_\s]/g, "");
}

export function normalizeName(input: string): string {
  return fold(input);
}

interface IndexedUser {
  user: SlackUser;
  name: string;
  display: string;
  real: string;
  email: string;
  local: string;
  nameC: string;
  displayC: string;
  tokens: string[];
}

/** Precomputed user index. Build once per workspace snapshot, then lookup. */
export class UserDirectory {
  private readonly byId = new Map<string, SlackUser>();
  private readonly byHandle = new Map<string, SlackUser>();
  private readonly byEmail = new Map<string, SlackUser>();
  private readonly rows: IndexedUser[] = [];

  constructor(users: SlackUser[]) {
    for (const user of users) {
      this.byId.set(user.id, user);
      this.byId.set(user.id.toLowerCase(), user);
      const name = fold(user.name);
      const display = fold(user.displayName || "");
      const real = fold(user.realName || "");
      const email = fold(user.email || "");
      const local = email.split("@")[0] ?? "";
      if (!user.deleted) {
        if (name) this.byHandle.set(name, user);
        if (email) this.byEmail.set(email, user);
        if (local) this.byEmail.set(local, user);
        this.rows.push({
          user,
          name,
          display,
          real,
          email,
          local,
          nameC: name.replace(/[.\-_\s]/g, ""),
          displayC: display.replace(/[.\-_\s]/g, ""),
          tokens: real ? real.split(" ") : [],
        });
      }
    }
  }

  find(query: string): SlackUser | undefined {
    const exact = this.exact(query);
    if (exact) return exact;
    const hits = this.search(query, { limit: 8 });
    return hits[0]?.user;
  }

  require(query: string): SlackUser {
    const exact = this.exact(query);
    if (exact) return exact;
    const hits = this.search(query, { limit: 6 });
    if (!hits.length) {
      throw new Error(`No user matching "${query}". Try slack_users first.`);
    }
    if (!isUniqueEnough(hits)) {
      const candidates = hits.slice(0, 5).map(formatCandidate);
      throw new AmbiguousRefError(
        `Ambiguous user "${query}". Matches: ${candidates.join(", ")}. Pass a U-id or a more specific @handle.`,
        candidates,
      );
    }
    return hits[0].user;
  }

  private exact(query: string): SlackUser | undefined {
    const raw = query.trim();
    if (!raw) return undefined;
    const idHit = this.byId.get(raw) ?? this.byId.get(raw.toLowerCase());
    if (idHit) return idHit;
    const n = fold(raw);
    if (!n) return undefined;
    return this.byHandle.get(n) ?? this.byEmail.get(n);
  }

  search(
    query: string,
    opts: { limit?: number; includeDeleted?: boolean } = {},
  ): UserHit[] {
    const raw = query.trim();
    if (!raw) return [];
    const n = fold(raw);
    if (!n) return [];
    const c = n.replace(/[.\-_\s]/g, "");
    const limit = opts.limit ?? 50;
    const hits: UserHit[] = [];

    const idHit = this.byId.get(raw) ?? this.byId.get(raw.toLowerCase());
    if (idHit && (opts.includeDeleted || !idHit.deleted)) {
      hits.push({ user: idHit, score: 100, reason: "id" });
    }

    for (const row of this.rows) {
      if (idHit && row.user.id === idHit.id) continue;
      const scored = scoreIndexed(row, n, c);
      if (scored) hits.push(scored);
    }

    if (opts.includeDeleted && idHit?.deleted && !hits.some((h) => h.user.id === idHit.id)) {
      hits.push({ user: idHit, score: 100, reason: "id" });
    }

    hits.sort(compareHits);
    return hits.slice(0, limit);
  }
}

function asDirectory(users: SlackUser[] | UserDirectory): UserDirectory {
  return users instanceof UserDirectory ? users : new UserDirectory(users);
}

export function findUser(
  users: SlackUser[] | UserDirectory,
  query: string,
): SlackUser | undefined {
  return asDirectory(users).find(query);
}

export function findUsers(
  users: SlackUser[] | UserDirectory,
  query: string,
  opts: { limit?: number; includeDeleted?: boolean } = {},
): UserHit[] {
  return asDirectory(users).search(query, opts);
}

export function requireUser(users: SlackUser[] | UserDirectory, query: string): SlackUser {
  return asDirectory(users).require(query);
}

function formatCandidate(hit: UserHit): string {
  const handle = hit.user.displayName || hit.user.name;
  return `@${handle} (${hit.user.realName} · ${hit.user.id})`;
}

export function isUniqueEnough(hits: UserHit[]): boolean {
  if (!hits.length) return false;
  if (hits.length === 1) return hits[0].score > 0;
  const [a, b] = hits;
  if (a.reason === "id" || a.reason === "handle" || a.reason === "email") {
    return a.score > b.score;
  }
  if (a.score >= 90 && a.score - b.score >= 5) return true;
  if (a.score - b.score >= 20) return true;
  return false;
}

function scoreIndexed(row: IndexedUser, folded: string, compact: string): UserHit | undefined {
  const { user, name, display, real, email, local, nameC, displayC, tokens } = row;
  if (name === folded) return { user, score: 95, reason: "handle" };
  if (email && email === folded) return { user, score: 93, reason: "email" };
  if (local && local === folded) return { user, score: 92, reason: "email" };
  if (nameC && nameC === compact) return { user, score: 91, reason: "compact" };
  if (display && display === folded) return { user, score: 86, reason: "display" };
  if (real && real === folded) return { user, score: 84, reason: "real" };
  if (displayC && displayC === compact) return { user, score: 82, reason: "compact" };

  if (folded.length >= 2) {
    if (name.startsWith(folded) || display.startsWith(folded)) {
      return { user, score: 60 + Math.min(10, folded.length), reason: "prefix" };
    }
    if (real.startsWith(folded)) {
      return { user, score: 55, reason: "prefix" };
    }
  }

  if (folded.length >= 2 && tokens.length) {
    if (tokens.some((t) => t === folded || t.replace(/[.\-_]/g, "") === compact)) {
      return { user, score: 48, reason: "token" };
    }
  }

  if (folded.length >= 3) {
    if (name.includes(folded) || display.includes(folded) || real.includes(folded)) {
      return { user, score: 28, reason: "contains" };
    }
    if (email.includes(folded)) {
      return { user, score: 22, reason: "contains" };
    }
  }

  return undefined;
}

function compareHits(a: UserHit, b: UserHit): number {
  if (b.score !== a.score) return b.score - a.score;
  if (Boolean(a.user.isBot) !== Boolean(b.user.isBot)) return a.user.isBot ? 1 : -1;
  const aLen = a.user.name.length;
  const bLen = b.user.name.length;
  if (aLen !== bLen) return aLen - bLen;
  return a.user.id.localeCompare(b.user.id);
}

export function findChannel(
  channels: SlackChannel[],
  query: string,
): SlackChannel | undefined {
  const hits = findChannels(channels, query, { limit: 2, resolve: true });
  if (!hits.length) return undefined;
  if (hits.length === 1) return hits[0].channel;
  if (hits[0].score >= 90 && hits[0].score > hits[1].score) return hits[0].channel;
  return undefined;
}

export function findChannels(
  channels: SlackChannel[],
  query: string,
  opts: { limit?: number; resolve?: boolean } = {},
): ChannelHit[] {
  const raw = query.trim();
  if (!raw) return [];
  const n = fold(raw);
  const c = n.replace(/[.\-_\s]/g, "");
  const hits: ChannelHit[] = [];
  for (const channel of channels) {
    const score = scoreChannel(channel, raw, n, c, opts.resolve === true);
    if (score > 0) hits.push({ channel, score });
  }
  hits.sort((a, b) => b.score - a.score || a.channel.id.localeCompare(b.channel.id));
  return hits.slice(0, opts.limit ?? 50);
}

function scoreChannel(
  ch: SlackChannel,
  raw: string,
  n: string,
  c: string,
  resolve: boolean,
): number {
  if (ch.id === raw || ch.id.toLowerCase() === raw.toLowerCase()) return 100;
  const name = fold(ch.name);
  const norm = fold(ch.nameNormalized || "");
  if (name === n || norm === n) return 95;
  const nameC = name.replace(/[.\-_\s]/g, "");
  if (nameC && nameC === c) return 91;
  if (n.length >= 2 && (name.startsWith(n) || norm.startsWith(n))) {
    return 60 + Math.min(10, n.length);
  }
  if (resolve) return 0;
  if (n.length >= 3) {
    if (name.includes(n) || norm.includes(n)) return 28;
    const topic = fold(ch.topic || "");
    const purpose = fold(ch.purpose || "");
    if (topic.includes(n) || purpose.includes(n)) return 18;
  }
  return 0;
}

export function resolveChannelRef(
  input: string,
  channels: SlackChannel[],
  users: SlackUser[] | UserDirectory,
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

  const dir = asDirectory(users);
  if (trimmed.startsWith("@") || /^[UW][A-Z0-9]+$/i.test(trimmed)) {
    const user = dir.require(trimmed);
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

  const hits = findChannels(channels, trimmed, { limit: 6, resolve: true });
  if (!hits.length) {
    throw new Error(
      `No channel matching "${trimmed}". Use #name, a C-id, @user for a DM, or a permalink.`,
    );
  }
  if (hits.length > 1 && hits[0].score < 90) {
    const names = hits.slice(0, 5).map((h) =>
      h.channel.isIm ? `@${h.channel.name}` : `#${h.channel.name}`,
    );
    throw new AmbiguousRefError(
      `Ambiguous channel "${trimmed}". Matches: ${names.join(", ")}. Use a #name or C-id.`,
      names,
    );
  }
  if (hits.length > 1 && hits[0].score === hits[1].score) {
    const names = hits.slice(0, 5).map((h) => `#${h.channel.name}`);
    throw new AmbiguousRefError(
      `Ambiguous channel "${trimmed}". Matches: ${names.join(", ")}. Use a #name or C-id.`,
      names,
    );
  }
  return { channel: hits[0].channel };
}

export function channelAllowed(
  channel: SlackChannel,
  allow: string[],
  deny: string[],
): { ok: boolean; reason?: string } {
  const names = aliasesFor(channel);
  const match = (list: string[]) => list.some((item) => names.has(aliasKey(item)));
  if (deny.length && match(deny)) {
    return { ok: false, reason: `${label(channel)} is on SLACK_MCP_DENY_CHANNELS` };
  }
  if (allow.length && !match(allow)) {
    return { ok: false, reason: `${label(channel)} is not on SLACK_MCP_ALLOW_CHANNELS` };
  }
  return { ok: true };
}

function label(channel: SlackChannel): string {
  if (channel.isIm) return `@${channel.name}`;
  return `#${channel.name}`;
}

function aliasesFor(channel: SlackChannel): Set<string> {
  const raw = [
    channel.id,
    channel.name,
    channel.nameNormalized,
    `#${channel.name}`,
    `@${channel.name}`,
    channel.user,
    channel.user ? `@${channel.user}` : undefined,
  ];
  return new Set(raw.filter(Boolean).map((s) => aliasKey(s!)));
}

function aliasKey(item: string): string {
  return fold(item);
}
