import type {
  AuthInfo,
  SlackAdapter,
  SlackChannel,
  SlackFile,
  SlackMessage,
  SlackUser,
} from "./types";
import { slugifyChannel } from "./mrkdwn";

const TEAM = { id: "T0NORTHSTAR", name: "Northstar", domain: "northstar-labs" };

const USERS: SlackUser[] = [
  {
    id: "U0YOU",
    name: "salahuddin",
    realName: "Salahuddin Uqaili",
    displayName: "salahuddin",
    email: "salahuddin@northstar.example",
    title: "APM",
    tz: "Europe/Berlin",
  },
  {
    id: "U0MAYA",
    name: "maya",
    realName: "Maya Chen",
    displayName: "maya",
    email: "maya@northstar.example",
    title: "VP Engineering",
    tz: "America/Los_Angeles",
    isAdmin: true,
  },
  {
    id: "U0JON",
    name: "jon",
    realName: "Jon Park",
    displayName: "jon",
    email: "jon@northstar.example",
    title: "Staff engineer",
    tz: "America/New_York",
  },
  {
    id: "U0PRIYA",
    name: "priya",
    realName: "Priya Shah",
    displayName: "priya",
    email: "priya@northstar.example",
    title: "Design",
    tz: "Europe/London",
    statusEmoji: "focus",
    statusText: "heads down on onboarding",
  },
  {
    id: "U0LUCA",
    name: "luca",
    realName: "Luca Rossi",
    displayName: "luca",
    email: "luca@northstar.example",
    title: "On-call",
    tz: "Europe/Berlin",
    statusEmoji: "rotating_light",
    statusText: "oncall",
  },
  {
    id: "U0ADA",
    name: "ada",
    realName: "Ada Okonkwo",
    displayName: "ada",
    email: "ada@northstar.example",
    title: "Product",
    tz: "Africa/Lagos",
  },
];

function tsAt(now: Date, hoursAgo: number, extraSeconds = 0): string {
  const ms = now.getTime() - hoursAgo * 3_600_000 - extraSeconds * 1000;
  const sec = Math.floor(ms / 1000);
  const frac = String(ms % 1000).padStart(3, "0") + "000";
  return `${sec}.${frac}`;
}

export interface DemoState {
  now: Date;
  users: SlackUser[];
  channels: SlackChannel[];
  messages: SlackMessage[];
  files: SlackFile[];
  status: { text: string; emoji?: string; expiration?: number };
}

export function seedDemo(now = new Date()): DemoState {
  const channels: SlackChannel[] = [
    {
      id: "C0GEN",
      name: "general",
      nameNormalized: "general",
      topic: "Northstar company-wide",
      isMember: true,
      memberCount: 48,
      unreadCount: 0,
    },
    {
      id: "C0ENG",
      name: "eng",
      nameNormalized: "eng",
      topic: "Shipping talk. Decisions in threads.",
      purpose: "Engineering",
      isMember: true,
      memberCount: 22,
      unreadCount: 6,
    },
    {
      id: "C0INC",
      name: "incidents",
      nameNormalized: "incidents",
      topic: "SEV tracker. Pin the active incident.",
      isMember: true,
      memberCount: 18,
      unreadCount: 3,
    },
    {
      id: "C0PROD",
      name: "product",
      nameNormalized: "product",
      topic: "Roadmaps and tradeoffs",
      isMember: true,
      memberCount: 14,
      unreadCount: 1,
    },
    {
      id: "C0DES",
      name: "design",
      nameNormalized: "design",
      topic: "Critique Fridays",
      isPrivate: true,
      isMember: true,
      memberCount: 6,
      unreadCount: 0,
    },
    {
      id: "D0MAYA",
      name: "maya",
      nameNormalized: "maya",
      isIm: true,
      isMember: true,
      user: "U0MAYA",
      unreadCount: 1,
    },
    {
      id: "D0LUCA",
      name: "luca",
      nameNormalized: "luca",
      isIm: true,
      isMember: true,
      user: "U0LUCA",
      unreadCount: 0,
    },
  ];

  const t = (h: number, s = 0) => tsAt(now, h, s);
  const messages: SlackMessage[] = [
    {
      ts: t(26, 10),
      channel: "C0ENG",
      user: "U0ADA",
      text: "Can we lock auth token rotation for the Q4 launch? Need a decision today.",
      replyCount: 4,
      replyUsers: ["U0MAYA", "U0JON", "U0YOU"],
      isPinned: true,
    },
    {
      ts: t(25, 40),
      channel: "C0ENG",
      user: "U0MAYA",
      text: "Decision: rotate on deploy, 7-day overlap, no dual-write past Friday. Thread is source of truth.",
      threadTs: t(26, 10),
    },
    {
      ts: t(25, 20),
      channel: "C0ENG",
      user: "U0JON",
      text: "I'll land the overlap in `auth/rotate.ts` this afternoon. Flag is `AUTH_ROTATION_OVERLAP_DAYS=7`.",
      threadTs: t(26, 10),
    },
    {
      ts: t(24, 50),
      channel: "C0ENG",
      user: "U0YOU",
      text: "Noted — I'll put it on the launch checklist and ping legal about the session copy.",
      threadTs: t(26, 10),
    },
    {
      ts: t(24, 10),
      channel: "C0ENG",
      user: "U0MAYA",
      text: "Thanks. Let's not reopen this unless overlap breaks staging.",
      threadTs: t(26, 10),
    },
    {
      ts: t(5, 0),
      channel: "C0ENG",
      user: "U0MAYA",
      text: "Shipped auth token rotation to staging. Please review the thread from yesterday — overlap is live.",
      replyCount: 2,
      reactions: [
        { name: "white_check_mark", count: 2, users: ["U0JON", "U0YOU"] },
        { name: "eyes", count: 1, users: ["U0ADA"] },
      ],
    },
    {
      ts: t(4, 40),
      channel: "C0ENG",
      user: "U0JON",
      text: "Looks clean. One nibble: we should log `kid` on 401 so oncall can see stale keys.",
      threadTs: t(5, 0),
    },
    {
      ts: t(4, 20),
      channel: "C0ENG",
      user: "U0YOU",
      text: "I'll add the 401 `kid` log before the afternoon deploy window.",
      threadTs: t(5, 0),
    },
    {
      ts: t(3, 10),
      channel: "C0ENG",
      user: "U0JON",
      text: "Deploy window is 16:00 CEST. Need a +1 on the changelog blurb.",
    },
    {
      ts: t(2, 30),
      channel: "C0ENG",
      user: "U0PRIYA",
      text: "Changelog LGTM from design. Don't mention 'rotation' in customer-facing copy — say 'security update'.",
    },
    {
      ts: t(1, 15),
      channel: "C0INC",
      user: "U0LUCA",
      text: "SEV-2: elevated 401s on `edge-auth` since 13:40 CEST. Looking like stale keys from canary pods.",
      replyCount: 3,
      isPinned: true,
      reactions: [{ name: "rotating_light", count: 3, users: ["U0MAYA", "U0JON", "U0YOU"] }],
    },
    {
      ts: t(1, 5),
      channel: "C0INC",
      user: "U0JON",
      text: "Canary still on old `kid`. Rolling those pods. ETA 15 min.",
      threadTs: t(1, 15),
    },
    {
      ts: t(0, 50 * 60),
      channel: "C0INC",
      user: "U0LUCA",
      text: "401 rate back to baseline. Keeping the incident open for the postmortem.",
      threadTs: t(1, 15),
    },
    {
      ts: t(0, 35 * 60),
      channel: "C0INC",
      user: "U0MAYA",
      text: "Owner: Luca. Postmortem due tomorrow 11:00 CEST. Don't close until the canary pipeline refuses mixed kids.",
      threadTs: t(1, 15),
    },
    {
      ts: t(6, 0),
      channel: "C0PROD",
      user: "U0ADA",
      text: "Q4 launch review moved to Thursday 10:00 CEST. Bring the auth decision thread.",
      unreadHint: true,
    } as SlackMessage,
    {
      ts: t(0, 20 * 60),
      channel: "D0MAYA",
      user: "U0MAYA",
      text: "When you have a minute — can you draft the incident note for #eng? Keep it calm, no blame.",
    },
    {
      ts: t(30, 0),
      channel: "C0GEN",
      user: "U0ADA",
      text: "Welcome to Northstar. #eng is the working channel; #incidents is paged.",
    },
  ];

  // Fix the accidental field
  for (const m of messages) {
    delete (m as SlackMessage & { unreadHint?: boolean }).unreadHint;
  }

  const files: SlackFile[] = [
    {
      id: "F0POST",
      name: "sev2-edge-auth.md",
      title: "SEV-2 draft",
      mimetype: "text/markdown",
      size: 1200,
      user: "U0LUCA",
      created: Math.floor(now.getTime() / 1000) - 3600,
    },
  ];

  return {
    now,
    users: structuredClone(USERS),
    channels: structuredClone(channels),
    messages: structuredClone(messages),
    files: structuredClone(files),
    status: { text: "", emoji: undefined },
  };
}

export class DemoAdapter implements SlackAdapter {
  constructor(public state: DemoState = seedDemo()) {}

  hasSearch() {
    return true;
  }

  tokenSummary() {
    return { bot: false, user: false, demo: true };
  }

  async auth(): Promise<AuthInfo> {
    return {
      ok: true,
      userId: "U0YOU",
      user: "salahuddin",
      teamId: TEAM.id,
      team: TEAM.name,
      url: `https://${TEAM.domain}.slack.com/`,
      tokenKind: "demo",
    };
  }

  async teamInfo() {
    return { ...TEAM };
  }

  async listUsers() {
    return this.state.users;
  }

  async listChannels() {
    return this.state.channels;
  }

  async getChannel(id: string) {
    return this.state.channels.find((c) => c.id === id);
  }

  async history(opts: {
    channel: string;
    oldest?: number;
    latest?: number;
    limit: number;
    cursor?: string;
  }) {
    let rows = this.state.messages.filter(
      (m) => m.channel === opts.channel && !m.threadTs,
    );
    if (opts.oldest) rows = rows.filter((m) => Number(m.ts) >= opts.oldest!);
    if (opts.latest) rows = rows.filter((m) => Number(m.ts) <= opts.latest!);
    rows = rows.sort((a, b) => Number(b.ts) - Number(a.ts)).slice(0, opts.limit);
    return { messages: rows };
  }

  async replies(opts: { channel: string; ts: string; limit: number }) {
    const parent = this.state.messages.find(
      (m) => m.channel === opts.channel && m.ts === opts.ts,
    );
    const replies = this.state.messages.filter(
      (m) => m.channel === opts.channel && m.threadTs === opts.ts,
    );
    const messages = parent ? [parent, ...replies] : replies;
    return {
      messages: messages.sort((a, b) => Number(a.ts) - Number(b.ts)).slice(0, opts.limit),
    };
  }

  async search(opts: { query: string; count: number; sort: "timestamp" | "score" }) {
    const q = parseSearch(opts.query);
    let rows = this.state.messages.filter((m) => {
      if (q.in) {
        const ch = this.state.channels.find((c) => c.id === m.channel);
        const needle = q.in.replace(/^#/, "");
        const hit =
          m.channel.toLowerCase() === needle ||
          (ch && (ch.name === needle || ch.id.toLowerCase() === needle));
        if (!hit) return false;
      }
      if (q.from && m.user !== q.from && !this.userMatches(m.user, q.from)) return false;
      if (q.has === "pin" && !m.isPinned) return false;
      if (q.has === "link" && !m.text.includes("http") && !m.text.includes("<http")) return false;
      if (q.terms.length && !q.terms.every((t) => m.text.toLowerCase().includes(t))) return false;
      return Boolean(q.terms.length || q.in || q.from || q.has);
    });
    if (opts.sort === "timestamp") rows.sort((a, b) => Number(b.ts) - Number(a.ts));
    else {
      rows.sort((a, b) => Number(b.ts) - Number(a.ts));
    }
    return { messages: rows.slice(0, opts.count), total: rows.length, canSearch: true };
  }

  async postMessage(opts: { channel: string; text: string; threadTs?: string }) {
    const msg: SlackMessage = {
      ts: `${Math.floor(Date.now() / 1000)}.${String(Date.now() % 1000).padStart(3, "0")}000`,
      channel: opts.channel,
      user: "U0YOU",
      text: opts.text,
      threadTs: opts.threadTs,
    };
    this.state.messages.push(msg);
    if (opts.threadTs) {
      const parent = this.state.messages.find(
        (m) => m.channel === opts.channel && m.ts === opts.threadTs,
      );
      if (parent) parent.replyCount = (parent.replyCount ?? 0) + 1;
    }
    return msg;
  }

  async updateMessage(opts: { channel: string; ts: string; text: string }) {
    const msg = this.requireMessage(opts.channel, opts.ts);
    msg.text = opts.text;
    return msg;
  }

  async deleteMessage(opts: { channel: string; ts: string }) {
    this.state.messages = this.state.messages.filter(
      (m) => !(m.channel === opts.channel && m.ts === opts.ts),
    );
  }

  async react(opts: {
    channel: string;
    ts: string;
    emoji: string;
    action: "add" | "remove";
  }) {
    const msg = this.requireMessage(opts.channel, opts.ts);
    msg.reactions = msg.reactions ?? [];
    const existing = msg.reactions.find((r) => r.name === opts.emoji);
    if (opts.action === "add") {
      if (existing) {
        if (!existing.users.includes("U0YOU")) {
          existing.users.push("U0YOU");
          existing.count += 1;
        }
      } else {
        msg.reactions.push({ name: opts.emoji, count: 1, users: ["U0YOU"] });
      }
    } else if (existing) {
      existing.users = existing.users.filter((u) => u !== "U0YOU");
      existing.count = existing.users.length;
      if (!existing.count) {
        msg.reactions = msg.reactions.filter((r) => r.name !== opts.emoji);
      }
    }
  }

  async unreads() {
    const out: { channel: SlackChannel; messages: SlackMessage[]; mentionCount: number }[] = [];
    for (const ch of this.state.channels) {
      if (!ch.unreadCount) continue;
      const { messages } = await this.history({
        channel: ch.id,
        limit: Math.max(ch.unreadCount, 3),
      });
      const mentionCount = messages.filter((m) => m.text.includes("<@U0YOU>") || m.text.includes("Salahuddin")).length;
      out.push({ channel: ch, messages: messages.slice(0, ch.unreadCount), mentionCount });
    }
    return out;
  }

  async listPins(channel: string) {
    return this.state.messages.filter((m) => m.channel === channel && m.isPinned);
  }

  async pin(opts: { channel: string; ts: string; action: "add" | "remove" }) {
    const msg = this.requireMessage(opts.channel, opts.ts);
    msg.isPinned = opts.action === "add";
  }

  async createChannel(opts: { name: string; isPrivate?: boolean; topic?: string }) {
    const name = slugifyChannel(opts.name);
    const existing = this.state.channels.find((c) => c.name === name);
    if (existing) return existing;
    const channel: SlackChannel = {
      id: `C${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      name,
      nameNormalized: name,
      topic: opts.topic,
      isPrivate: opts.isPrivate,
      isMember: true,
      memberCount: 1,
      unreadCount: 0,
    };
    this.state.channels.push(channel);
    return channel;
  }

  async setTopic(opts: { channel: string; topic: string }) {
    const ch = this.state.channels.find((c) => c.id === opts.channel);
    if (ch) ch.topic = opts.topic;
  }

  async setStatus(opts: { text: string; emoji?: string; expiration?: number }) {
    this.state.status = { text: opts.text, emoji: opts.emoji, expiration: opts.expiration };
    const you = this.state.users.find((u) => u.id === "U0YOU");
    if (you) {
      you.statusText = opts.text;
      you.statusEmoji = opts.emoji;
    }
  }

  async clearStatus() {
    await this.setStatus({ text: "" });
  }

  async upload(opts: {
    filename: string;
    content: string;
    channel?: string;
    title?: string;
    comment?: string;
  }) {
    const file: SlackFile = {
      id: `F${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      name: opts.filename,
      title: opts.title ?? opts.filename,
      mimetype: "text/plain",
      size: opts.content.length,
      user: "U0YOU",
      created: Math.floor(Date.now() / 1000),
    };
    this.state.files.push(file);
    if (opts.channel) {
      await this.postMessage({
        channel: opts.channel,
        text: opts.comment || `uploaded ${opts.filename}`,
      });
    }
    return file;
  }

  async permalink(opts: { channel: string; ts: string }) {
    const packed = opts.ts.replace(".", "");
    return `https://${TEAM.domain}.slack.com/archives/${opts.channel}/p${packed}`;
  }

  async openDm(userId: string) {
    const existing = this.state.channels.find((c) => c.isIm && c.user === userId);
    if (existing) return existing;
    const user = this.state.users.find((u) => u.id === userId);
    const channel: SlackChannel = {
      id: `D${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      name: user?.name ?? userId,
      nameNormalized: (user?.name ?? userId).toLowerCase(),
      isIm: true,
      isMember: true,
      user: userId,
      unreadCount: 0,
    };
    this.state.channels.push(channel);
    return channel;
  }

  private requireMessage(channel: string, ts: string): SlackMessage {
    const msg = this.state.messages.find((m) => m.channel === channel && m.ts === ts);
    if (!msg) throw new Error(`No message ${ts} in ${channel}`);
    return msg;
  }

  private channelName(id: string) {
    return this.state.channels.find((c) => c.id === id)?.name ?? id;
  }

  private userMatches(userId: string | undefined, q: string) {
    if (!userId) return false;
    const u = this.state.users.find((x) => x.id === userId);
    const n = q.replace(/^@/, "").toLowerCase();
    return Boolean(
      u &&
        (u.id === q ||
          u.name.toLowerCase() === n ||
          u.displayName.toLowerCase() === n),
    );
  }
}

function parseSearch(query: string): {
  terms: string[];
  in?: string;
  from?: string;
  has?: string;
} {
  let rest = query;
  let inn: string | undefined;
  let from: string | undefined;
  let has: string | undefined;
  rest = rest.replace(/\bin:(\S+)/g, (_, v: string) => {
    inn = v.replace(/^#/, "").toLowerCase();
    return "";
  });
  rest = rest.replace(/\bfrom:(\S+)/g, (_, v: string) => {
    from = v;
    return "";
  });
  rest = rest.replace(/\bhas:(\S+)/g, (_, v: string) => {
    has = v;
    return "";
  });
  const terms = rest
    .trim()
    .replace(/^"|"$/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return { terms, in: inn, from, has };
}

export function createDemoAdapter(now?: Date): DemoAdapter {
  return new DemoAdapter(seedDemo(now));
}
