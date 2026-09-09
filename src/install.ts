import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type ClientId = "antigravity" | "claude" | "cursor" | "all";

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
}

export function launcherCommand(): { command: string; args: string[] } {
  return {
    command: "npx",
    args: ["-y", "github:salahuddinuqaili/agy-slack"],
  };
}

export function antigravityEntry(opts: InstallOptions) {
  const { command, args } = launcherCommand();
  const env: Record<string, string> = {
    SLACK_MCP_MODE: opts.mode || "confirm",
  };
  if (opts.demo) env.SLACK_MCP_DEMO = "1";
  if (opts.botToken) env.SLACK_BOT_TOKEN = opts.botToken;
  if (opts.userToken) env.SLACK_USER_TOKEN = opts.userToken;
  return {
    command,
    args,
    env,
  };
}

export async function installClient(opts: InstallOptions): Promise<InstallResult> {
  const files: string[] = [];
  const entry = antigravityEntry(opts);
  const clients: Array<"antigravity" | "claude" | "cursor"> =
    opts.client === "all" ? ["antigravity", "claude", "cursor"] : [opts.client];

  for (const client of clients) {
    if (client === "antigravity") {
      const globalPath = join(homedir(), ".gemini", "config", "mcp_config.json");
      await mergeServer(globalPath, "agy-slack", entry);
      files.push(globalPath);
      const legacyDir = join(homedir(), ".gemini", "antigravity");
      if (existsSync(legacyDir) || existsSync(join(homedir(), ".gemini"))) {
        const legacy = join(legacyDir, "mcp_config.json");
        await mergeServer(legacy, "agy-slack", entry);
        files.push(legacy);
      }
      if (opts.workspace) {
        const ws = join(opts.workspace, ".agents", "mcp_config.json");
        await mergeServer(ws, "agy-slack", entry);
        files.push(ws);
      }
    }
    if (client === "claude") {
      const path = join(homedir(), ".claude.json");
      await mergeClaude(path, "agy-slack", entry);
      files.push(path);
    }
    if (client === "cursor") {
      const path = join(homedir(), ".cursor", "mcp.json");
      await mergeServer(path, "agy-slack", entry);
      files.push(path);
    }
  }

  return { files, command: entry.command, args: entry.args };
}

async function mergeServer(
  path: string,
  name: string,
  entry: { command: string; args: string[]; env: Record<string, string> },
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

async function mergeClaude(
  path: string,
  name: string,
  entry: { command: string; args: string[]; env: Record<string, string> },
) {
  const current = await readJson(path);
  const mcpServers = {
    ...((current.mcpServers as Record<string, unknown> | undefined) ?? {}),
    [name]: entry,
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ ...current, mcpServers }, null, 2)}\n`, "utf8");
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

export function snippetFor(client: "antigravity" | "claude" | "cursor", opts: InstallOptions): string {
  const entry = antigravityEntry(opts);
  if (client === "antigravity") {
    return JSON.stringify(
      {
        mcpServers: {
          "agy-slack": entry,
        },
      },
      null,
      2,
    );
  }
  if (client === "claude") {
    return JSON.stringify({ mcpServers: { "agy-slack": entry } }, null, 2);
  }
  return JSON.stringify({ mcpServers: { "agy-slack": entry } }, null, 2);
}
