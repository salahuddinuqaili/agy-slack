import type {
  AuthInfo,
  SlackAdapter,
  SlackChannel,
  SlackFile,
  SlackMessage,
  SlackReaction,
  SlackUser,
} from "./types";

interface TokenSet {
  bot?: string;
  user?: string;
}

export function tokensFromEnv(
  env: Record<string, string | undefined> = process.env,
): TokenSet {
  const bot = first(env.SLACK_BOT_TOKEN, startsWith("xoxb", env.SLACK_TOKEN));
  const user = first(env.SLACK_USER_TOKEN, startsWith("xoxp", env.SLACK_TOKEN));
  const fallback = env.SLACK_TOKEN;
  return {
    bot: bot ?? (fallback?.startsWith("xoxb-") ? fallback : undefined),
    user: user ?? (fallback?.startsWith("xoxp-") ? fallback : undefined),
  };
}

function first(...vals: (string | undefined)[]) {
  return vals.find((v) => v && v.trim());
}

function startsWith(prefix: string, value?: string) {
  return value?.startsWith(prefix) ? value : undefined;
}

export class SlackApiError extends Error {
  constructor(
    public method: string,
    public slackError: string,
  ) {
    super(`Slack ${method} failed: ${slackError}`);
  }
}

export class LiveAdapter implements SlackAdapter {
  private userCache: { at: number; users: SlackUser[] } | null = null;
  private channelCache: { at: number; channels: SlackChannel[] } | null = null;

  constructor(private tokens: TokenSet) {
    if (!tokens.bot && !tokens.user) {
      throw new Error(
        "No Slack token. Set SLACK_USER_TOKEN (xoxp, recommended) and/or SLACK_BOT_TOKEN (xoxb), or run with --demo.",
      );
    }
  }

  hasSearch() {
    return Boolean(this.tokens.user);
  }

  tokenSummary() {
    return { bot: Boolean(this.tokens.bot), user: Boolean(this.tokens.user), demo: false };
  }

  async auth(): Promise<AuthInfo> {
    const token = this.tokens.user || this.tokens.bot!;
    const data = await this.api(token, "auth.test", {});
    return {
      ok: true,
      userId: String(data.user_id ?? ""),
      user: String(data.user ?? ""),
      teamId: String(data.team_id ?? ""),
      team: String(data.team ?? ""),
      url: data.url ? String(data.url) : undefined,
      botId: data.bot_id ? String(data.bot_id) : undefined,
      tokenKind: this.tokens.user ? "user" : "bot",
    };
  }

  async teamInfo() {
    const data = await this.api(this.readToken(), "team.info", {});
    const team = (data.team ?? {}) as Record<string, unknown>;
    return {
      id: String(team.id ?? ""),
      name: String(team.name ?? ""),
      domain: team.domain ? String(team.domain) : undefined,
    };
  }

  async listUsers(): Promise<SlackUser[]> {
    if (this.userCache && Date.now() - this.userCache.at < 5 * 60_000) return this.userCache.users;
    const users: SlackUser[] = [];
    let cursor: string | undefined;
    do {
      const data = await this.api(this.readToken(), "users.list", {
        limit: 1000,
        cursor,
      });
      for (const raw of (data.members as Record<string, unknown>[] | undefined) ?? []) {
        if (raw.deleted) continue;
        const profile = (raw.profile ?? {}) as Record<string, unknown>;
        users.push({
          id: String(raw.id),
          name: String(raw.name ?? ""),
          realName: String(raw.real_name ?? profile.real_name ?? raw.name ?? ""),
          displayName: String(profile.display_name || raw.name || ""),
          email: profile.email ? String(profile.email) : undefined,
          title: profile.title ? String(profile.title) : undefined,
          tz: raw.tz ? String(raw.tz) : undefined,
          isBot: Boolean(raw.is_bot),
          isAdmin: Boolean(raw.is_admin),
          statusEmoji: profile.status_emoji
            ? String(profile.status_emoji).replaceAll(":", "")
            : undefined,
          statusText: profile.status_text ? String(profile.status_text) : undefined,
          deleted: Boolean(raw.deleted),
        });
      }
      cursor = (data.response_metadata as { next_cursor?: string } | undefined)?.next_cursor || undefined;
    } while (cursor);
    this.userCache = { at: Date.now(), users };
    return users;
  }

  async listChannels(): Promise<SlackChannel[]> {
    if (this.channelCache && Date.now() - this.channelCache.at < 60_000) {
      return this.channelCache.channels;
    }
    const channels: SlackChannel[] = [];
    let cursor: string | undefined;
    do {
      const data = await this.api(this.readToken(), "conversations.list", {
        types: "public_channel,private_channel,mpim,im",
        exclude_archived: false,
        limit: 1000,
        cursor,
      });
      for (const raw of (data.channels as Record<string, unknown>[] | undefined) ?? []) {
        channels.push(mapChannel(raw));
      }
      cursor = (data.response_metadata as { next_cursor?: string } | undefined)?.next_cursor || undefined;
    } while (cursor);
    this.channelCache = { at: Date.now(), channels };
    return channels;
  }

  async getChannel(id: string) {
    const data = await this.api(this.readToken(), "conversations.info", { channel: id });
    return mapChannel((data.channel ?? {}) as Record<string, unknown>);
  }

  async history(opts: {
    channel: string;
    oldest?: number;
    latest?: number;
    limit: number;
    cursor?: string;
  }) {
    const data = await this.api(this.readToken(), "conversations.history", {
      channel: opts.channel,
      oldest: opts.oldest,
      latest: opts.latest,
      limit: opts.limit,
      cursor: opts.cursor,
      inclusive: true,
    });
    const messages = ((data.messages as Record<string, unknown>[] | undefined) ?? []).map((m) =>
      mapMessage(m, opts.channel),
    );
    const nextCursor = (data.response_metadata as { next_cursor?: string } | undefined)?.next_cursor;
    return { messages, nextCursor: nextCursor || undefined };
  }

  async replies(opts: { channel: string; ts: string; limit: number }) {
    const data = await this.api(this.readToken(), "conversations.replies", {
      channel: opts.channel,
      ts: opts.ts,
      limit: opts.limit,
    });
    const messages = ((data.messages as Record<string, unknown>[] | undefined) ?? []).map((m) =>
      mapMessage(m, opts.channel),
    );
    return { messages };
  }

  async search(opts: { query: string; count: number; sort: "timestamp" | "score" }) {
    if (!this.tokens.user) {
      return { messages: [], total: 0, canSearch: false };
    }
    const data = await this.api(this.tokens.user, "search.messages", {
      query: opts.query,
      count: opts.count,
      sort: opts.sort === "score" ? "score" : "timestamp",
      sort_dir: "desc",
    });
    const payload = (data.messages ?? {}) as {
      matches?: Record<string, unknown>[];
      total?: number;
    };
    const messages = (payload.matches ?? []).map((m) => {
      const channel = (m.channel ?? {}) as Record<string, unknown>;
      return mapMessage(m, String(channel.id ?? m.channel ?? ""));
    });
    return { messages, total: payload.total ?? messages.length, canSearch: true };
  }

  async postMessage(opts: { channel: string; text: string; threadTs?: string }) {
    const data = await this.api(this.writeToken(), "chat.postMessage", {
      channel: opts.channel,
      text: opts.text,
      thread_ts: opts.threadTs,
      mrkdwn: true,
      unfurl_links: false,
    });
    return mapMessage((data.message ?? data) as Record<string, unknown>, opts.channel);
  }

  async updateMessage(opts: { channel: string; ts: string; text: string }) {
    const data = await this.api(this.writeToken(), "chat.update", {
      channel: opts.channel,
      ts: opts.ts,
      text: opts.text,
    });
    return mapMessage((data.message ?? data) as Record<string, unknown>, opts.channel);
  }

  async deleteMessage(opts: { channel: string; ts: string }) {
    await this.api(this.writeToken(), "chat.delete", { channel: opts.channel, ts: opts.ts });
  }

  async react(opts: {
    channel: string;
    ts: string;
    emoji: string;
    action: "add" | "remove";
  }) {
    const method = opts.action === "remove" ? "reactions.remove" : "reactions.add";
    await this.api(this.writeToken(), method, {
      channel: opts.channel,
      timestamp: opts.ts,
      name: opts.emoji,
    });
  }

  async unreads() {
    const channels = await this.listChannels();
    const hot = channels.filter((c) => (c.unreadCount ?? 0) > 0 && c.isMember);
    const out: { channel: SlackChannel; messages: SlackMessage[]; mentionCount: number }[] = [];
    for (const channel of hot.slice(0, 15)) {
      const { messages } = await this.history({
        channel: channel.id,
        limit: Math.min(channel.unreadCount || 5, 15),
      });
      out.push({ channel, messages, mentionCount: 0 });
    }
    return out;
  }

  async listPins(channel: string) {
    const data = await this.api(this.readToken(), "pins.list", { channel });
    const items = (data.items as Record<string, unknown>[] | undefined) ?? [];
    return items
      .filter((i) => i.type === "message")
      .map((i) => mapMessage((i.message ?? {}) as Record<string, unknown>, channel));
  }

  async pin(opts: { channel: string; ts: string; action: "add" | "remove" }) {
    const method = opts.action === "remove" ? "pins.remove" : "pins.add";
    await this.api(this.writeToken(), method, { channel: opts.channel, timestamp: opts.ts });
  }

  async createChannel(opts: { name: string; isPrivate?: boolean; topic?: string }) {
    const data = await this.api(this.writeToken(), "conversations.create", {
      name: opts.name,
      is_private: Boolean(opts.isPrivate),
    });
    const channel = mapChannel((data.channel ?? {}) as Record<string, unknown>);
    if (opts.topic) await this.setTopic({ channel: channel.id, topic: opts.topic });
    this.channelCache = null;
    return channel;
  }

  async setTopic(opts: { channel: string; topic: string }) {
    await this.api(this.writeToken(), "conversations.setTopic", {
      channel: opts.channel,
      topic: opts.topic,
    });
  }

  async setStatus(opts: { text: string; emoji?: string; expiration?: number }) {
    const token = this.tokens.user;
    if (!token) throw new Error("Setting status requires SLACK_USER_TOKEN (xoxp).");
    await this.api(token, "users.profile.set", {
      profile: {
        status_text: opts.text,
        status_emoji: opts.emoji ? `:${opts.emoji}:` : "",
        status_expiration: opts.expiration ?? 0,
      },
    });
  }

  async clearStatus() {
    await this.setStatus({ text: "", emoji: "", expiration: 0 });
  }

  async upload(opts: {
    filename: string;
    content: string;
    channel?: string;
    title?: string;
    comment?: string;
  }) {
    const token = this.writeToken();
    const bytes = new TextEncoder().encode(opts.content);
    const start = await this.api(token, "files.getUploadURLExternal", {
      filename: opts.filename,
      length: bytes.length,
    });
    const uploadUrl = String(start.upload_url);
    const fileId = String(start.file_id);
    const put = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes,
    });
    if (!put.ok) throw new Error(`File upload PUT failed (${put.status})`);
    await this.api(token, "files.completeUploadExternal", {
      files: [{ id: fileId, title: opts.title ?? opts.filename }],
      channel_id: opts.channel,
      initial_comment: opts.comment,
    });
    return {
      id: fileId,
      name: opts.filename,
      title: opts.title ?? opts.filename,
      size: bytes.length,
      mimetype: "text/plain",
    } satisfies SlackFile;
  }

  async permalink(opts: { channel: string; ts: string }) {
    const data = await this.api(this.readToken(), "chat.getPermalink", {
      channel: opts.channel,
      message_ts: opts.ts,
    });
    return String(data.permalink);
  }

  async openDm(userId: string) {
    const data = await this.api(this.writeToken(), "conversations.open", {
      users: userId,
    });
    const channel = mapChannel((data.channel ?? {}) as Record<string, unknown>);
    this.channelCache = null;
    return channel;
  }

  private readToken() {
    return this.tokens.user || this.tokens.bot!;
  }

  private writeToken() {
    return this.tokens.bot || this.tokens.user!;
  }

  private async api(
    token: string,
    method: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== "") payload[k] = v;
    }
    let attempt = 0;
    while (true) {
      const res = await fetch(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 429 && attempt < 3) {
        const wait = Number(res.headers.get("Retry-After") ?? "1") * 1000;
        await sleep(wait);
        attempt += 1;
        continue;
      }
      const data = (await res.json()) as Record<string, unknown>;
      if (!data.ok) throw new SlackApiError(method, String(data.error ?? "unknown_error"));
      return data;
    }
  }
}

function mapChannel(raw: Record<string, unknown>): SlackChannel {
  const topic = raw.topic as { value?: string } | undefined;
  const purpose = raw.purpose as { value?: string } | undefined;
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? raw.user ?? raw.id ?? ""),
    nameNormalized: String(raw.name_normalized ?? raw.name ?? "").toLowerCase(),
    topic: topic?.value || undefined,
    purpose: purpose?.value || undefined,
    isPrivate: Boolean(raw.is_private),
    isIm: Boolean(raw.is_im),
    isMpim: Boolean(raw.is_mpim),
    isMember: raw.is_member == null ? true : Boolean(raw.is_member),
    isArchived: Boolean(raw.is_archived),
    memberCount: typeof raw.num_members === "number" ? raw.num_members : undefined,
    unreadCount:
      typeof raw.unread_count_display === "number"
        ? raw.unread_count_display
        : typeof raw.unread_count === "number"
          ? raw.unread_count
          : undefined,
    user: raw.user ? String(raw.user) : undefined,
  };
}

function mapMessage(raw: Record<string, unknown>, channel: string): SlackMessage {
  const reactions = (raw.reactions as Record<string, unknown>[] | undefined)?.map((r) => ({
    name: String(r.name),
    count: Number(r.count ?? 0),
    users: (r.users as string[] | undefined) ?? [],
  })) as SlackReaction[] | undefined;
  const files = (raw.files as Record<string, unknown>[] | undefined)?.map((f) => ({
    id: String(f.id),
    name: String(f.name ?? "file"),
    title: f.title ? String(f.title) : undefined,
    mimetype: f.mimetype ? String(f.mimetype) : undefined,
    size: typeof f.size === "number" ? f.size : undefined,
    url: f.url_private ? String(f.url_private) : undefined,
    user: f.user ? String(f.user) : undefined,
  }));
  return {
    ts: String(raw.ts ?? ""),
    channel: String(raw.channel ?? channel),
    user: raw.user ? String(raw.user) : undefined,
    text: String(raw.text ?? ""),
    threadTs: raw.thread_ts && raw.thread_ts !== raw.ts ? String(raw.thread_ts) : undefined,
    replyCount: typeof raw.reply_count === "number" ? raw.reply_count : undefined,
    replyUsers: raw.reply_users as string[] | undefined,
    reactions,
    files,
    permalink: raw.permalink ? String(raw.permalink) : undefined,
    isPinned: Boolean(raw.pinned_to),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
