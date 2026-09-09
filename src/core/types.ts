export type WriteMode = "readonly" | "confirm" | "write";
export type OutputFormat = "markdown" | "json";

export type ArgType = "string" | "number" | "boolean";

export interface ToolArg {
  name: string;
  type: ArgType;
  required?: boolean;
  description: string;
  enum?: string[];
  default?: string | number | boolean;
}

export interface ToolDef {
  name: string;
  title: string;
  group: "workspace" | "read" | "write" | "meta";
  write: boolean;
  description: string;
  args: ToolArg[];
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  displayName: string;
  email?: string;
  title?: string;
  tz?: string;
  isBot?: boolean;
  isAdmin?: boolean;
  statusEmoji?: string;
  statusText?: string;
  deleted?: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
  nameNormalized: string;
  topic?: string;
  purpose?: string;
  isPrivate?: boolean;
  isIm?: boolean;
  isMpim?: boolean;
  isMember?: boolean;
  isArchived?: boolean;
  memberCount?: number;
  unreadCount?: number;
  user?: string;
}

export interface SlackFile {
  id: string;
  name: string;
  title?: string;
  mimetype?: string;
  size?: number;
  url?: string;
  user?: string;
  created?: number;
}

export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

export interface SlackMessage {
  ts: string;
  channel: string;
  user?: string;
  text: string;
  threadTs?: string;
  replyCount?: number;
  replyUsers?: string[];
  reactions?: SlackReaction[];
  files?: SlackFile[];
  permalink?: string;
  isPinned?: boolean;
}

export interface AuthInfo {
  ok: true;
  userId: string;
  user: string;
  teamId: string;
  team: string;
  url?: string;
  botId?: string;
  tokenKind: "bot" | "user" | "demo";
}

export interface ServerConfig {
  mode: WriteMode;
  output: OutputFormat;
  allowChannels: string[];
  denyChannels: string[];
  tz: string;
  demo: boolean;
  maxMessages: number;
}

export interface ToolResult {
  text: string;
  structured?: unknown;
  isError?: boolean;
}

export type ToolArgs = Record<string, unknown>;

export interface SlackAdapter {
  auth(): Promise<AuthInfo>;
  teamInfo(): Promise<{ id: string; name: string; domain?: string }>;
  listUsers(): Promise<SlackUser[]>;
  listChannels(): Promise<SlackChannel[]>;
  getChannel(id: string): Promise<SlackChannel | undefined>;
  history(opts: {
    channel: string;
    oldest?: number;
    latest?: number;
    limit: number;
    cursor?: string;
  }): Promise<{ messages: SlackMessage[]; nextCursor?: string }>;
  replies(opts: {
    channel: string;
    ts: string;
    limit: number;
  }): Promise<{ messages: SlackMessage[] }>;
  search(opts: {
    query: string;
    count: number;
    sort: "timestamp" | "score";
  }): Promise<{ messages: SlackMessage[]; total: number; canSearch: boolean }>;
  postMessage(opts: {
    channel: string;
    text: string;
    threadTs?: string;
  }): Promise<SlackMessage>;
  updateMessage(opts: {
    channel: string;
    ts: string;
    text: string;
  }): Promise<SlackMessage>;
  deleteMessage(opts: { channel: string; ts: string }): Promise<void>;
  react(opts: {
    channel: string;
    ts: string;
    emoji: string;
    action: "add" | "remove";
  }): Promise<void>;
  unreads(): Promise<
    { channel: SlackChannel; messages: SlackMessage[]; mentionCount: number }[]
  >;
  listPins(channel: string): Promise<SlackMessage[]>;
  pin(opts: { channel: string; ts: string; action: "add" | "remove" }): Promise<void>;
  createChannel(opts: {
    name: string;
    isPrivate?: boolean;
    topic?: string;
  }): Promise<SlackChannel>;
  setTopic(opts: { channel: string; topic: string }): Promise<void>;
  setStatus(opts: { text: string; emoji?: string; expiration?: number }): Promise<void>;
  clearStatus(): Promise<void>;
  upload(opts: {
    filename: string;
    content: string;
    channel?: string;
    title?: string;
    comment?: string;
  }): Promise<SlackFile>;
  permalink(opts: { channel: string; ts: string }): Promise<string>;
  openDm(userId: string): Promise<SlackChannel>;
  hasSearch(): boolean;
  tokenSummary(): { bot: boolean; user: boolean; demo: boolean };
}

export function defaultConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    mode: "confirm",
    output: "markdown",
    allowChannels: [],
    denyChannels: [],
    tz: "UTC",
    demo: false,
    maxMessages: 40,
    ...overrides,
  };
}

export function configFromEnv(
  env: Record<string, string | undefined> = {},
): ServerConfig {
  const mode = (env.SLACK_MCP_MODE ?? "confirm").toLowerCase();
  return defaultConfig({
    mode: mode === "readonly" || mode === "write" || mode === "confirm" ? mode : "confirm",
    output: env.SLACK_MCP_OUTPUT === "json" ? "json" : "markdown",
    allowChannels: splitList(env.SLACK_MCP_ALLOW_CHANNELS),
    denyChannels: splitList(env.SLACK_MCP_DENY_CHANNELS),
    tz: env.SLACK_MCP_TZ || env.TZ || "UTC",
    demo: env.SLACK_MCP_DEMO === "1" || env.SLACK_MCP_DEMO === "true",
    maxMessages: clampInt(env.SLACK_MCP_MAX_MESSAGES, 40, 1, 200),
  });
}

function splitList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
