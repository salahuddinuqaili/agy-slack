import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const CLIENTS = ["antigravity", "gemini", "claude", "cursor", "all"] as const;
export type ClientId = (typeof CLIENTS)[number];
export type ConcreteClient = Exclude<ClientId, "all">;

export interface InstallOptions {
  client: ClientId;
  demo?: boolean;
  workspace?: string;
  botToken?: string;
  userToken?: string;
  mode?: string;
}

export interface InstallResult {
  files: string[];
  command: string;
  args: string[];
  hints: string[];
}

export function launcherCommand(): { command: string; args: string[] } {
  return {
    command: "npx",
    args: ["-y", "github:salahuddinuqaili/agy-slack"],
  };
}

/** Stdio entry shared by Antigravity, Claude, Cursor. */
export function antigravityEntry(opts: InstallOptions) {
  const { command, args } = launcherCommand();
  const env: Record<string, string> = {
    SLACK_MCP_MODE: opts.mode || "confirm",
  };
  if (opts.demo) env.SLACK_MCP_DEMO = "1";
  if (opts.botToken) env.SLACK_BOT_TOKEN = opts.botToken;
  if (opts.userToken) env.SLACK_USER_TOKEN = opts.userToken;
  return { command, args, env };
}

/**
 * Gemini CLI v0.59+ entry.
 * - Lives in settings.json (not mcp_config.json).
 * - Env values expand `$VAR` / `${VAR}` at runtime.
 * - `timeout` is milliseconds. `trust: false` keeps Gemini's own confirm gate.
 * - Server name uses a hyphen: Gemini FQNs are `mcp_{server}_{tool}` and
 *   split on `_`, so `agy_slack` would break tool policy.
 */
export function geminiEntry(opts: InstallOptions) {
  const { command, args } = launcherCommand();
  const env: Record<string, string> = {
    SLACK_MCP_MODE: opts.mode || "confirm",
    SLACK_USER_TOKEN: opts.userToken || "$SLACK_USER_TOKEN",
    SLACK_BOT_TOKEN: opts.botToken || "$SLACK_BOT_TOKEN",
  };
  if (opts.demo) env.SLACK_MCP_DEMO = "1";
  return {
    command,
    args,
    env,
    timeout: 60_000,
    trust: false,
  };
}

export function geminiHttpEntry(url = "http://127.0.0.1:8787/mcp") {
  return {
    httpUrl: url,
    timeout: 60_000,
    trust: false,
  };
}

export function geminiMcpAddCommand(opts: InstallOptions): string {
  const envFlags = [
    `-e SLACK_MCP_MODE=${opts.mode || "confirm"}`,
    opts.demo ? "-e SLACK_MCP_DEMO=1" : "-e SLACK_USER_TOKEN=$SLACK_USER_TOKEN",
  ];
  return [
    "gemini mcp add -s user",
    ...envFlags,
    "--timeout 60000",
    "agy-slack npx -- -y github:salahuddinuqaili/agy-slack",
  ].join(" ");
}

export async function installClient(opts: InstallOptions): Promise<InstallResult> {
  const files: string[] = [];
  const hints: string[] = [];
  const stdio = antigravityEntry(opts);
  const clients: ConcreteClient[] =
    opts.client === "all" ? ["antigravity", "gemini", "claude", "cursor"] : [opts.client];

  for (const client of clients) {
    if (client === "antigravity") {
      const globalPath = join(homedir(), ".gemini", "config", "mcp_config.json");
      await mergeServer(globalPath, "agy-slack", stdio);
      files.push(globalPath);
      const legacyDir = join(homedir(), ".gemini", "antigravity");
      if (existsSync(legacyDir) || existsSync(join(homedir(), ".gemini"))) {
        const legacy = join(legacyDir, "mcp_config.json");
        await mergeServer(legacy, "agy-slack", stdio);
        files.push(legacy);
      }
      if (opts.workspace) {
        const ws = join(opts.workspace, ".agents", "mcp_config.json");
        await mergeServer(ws, "agy-slack", stdio);
        files.push(ws);
      }
      hints.push("Antigravity: type /mcp and reload.");
    }

    if (client === "gemini") {
      const entry = geminiEntry(opts);
      const userSettings = join(homedir(), ".gemini", "settings.json");
      await mergeServer(userSettings, "agy-slack", entry);
      files.push(userSettings);
      if (opts.workspace) {
        const ws = join(opts.workspace, ".gemini", "settings.json");
        await mergeServer(ws, "agy-slack", entry);
        files.push(ws);
      }
      hints.push("Gemini CLI v0.59: restart or type /mcp. Trust the folder if asked (fail-closed workspace trust).");
      hints.push(`Native add: ${geminiMcpAddCommand(opts)}`);
    }

    if (client === "claude") {
      const path = join(homedir(), ".claude.json");
      await mergeServer(path, "agy-slack", stdio);
      files.push(path);
    }
    if (client === "cursor") {
      const path = join(homedir(), ".cursor", "mcp.json");
      await mergeServer(path, "agy-slack", stdio);
      files.push(path);
    }
  }

  return { files, command: stdio.command, args: stdio.args, hints };
}

async function mergeServer(
  path: string,
  name: string,
  entry: Record<string, unknown>,
) {
  const current = await readJson(path);
  const mcpServers = {
    ...((current.mcpServers as Record<string, unknown> | undefined) ?? {}),
    [name]: entry,
  };
  const next = { ...current, mcpServers };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // missing or invalid — start fresh
  }
  return {};
}

export function snippetFor(
  client: ConcreteClient,
  opts: InstallOptions,
): string {
  if (client === "gemini") {
    return JSON.stringify({ mcpServers: { "agy-slack": geminiEntry(opts) } }, null, 2);
  }
  const entry = antigravityEntry(opts);
  return JSON.stringify({ mcpServers: { "agy-slack": entry } }, null, 2);
}
