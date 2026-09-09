import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const CLIENTS = ["antigravity", "gemini", "vscode", "claude", "cursor", "all"] as const;
export type ClientId = (typeof CLIENTS)[number];
export type ConcreteClient = Exclude<ClientId, "all">;

export const GEMINI_EXTENSION_INSTALL =
  "gemini extensions install https://github.com/salahuddinuqaili/agy-slack";

export const GEMINI_SLASH_COMMANDS = [
  "catchup",
  "standup",
  "search",
  "draft",
  "who",
] as const;

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

export function packageRoot(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
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

/**
 * VS Code / Copilot Agent Host (1.102+).
 * - Root key is `servers`, not `mcpServers`.
 * - HTTP is `{ type: "http", url }` — not httpUrl / serverUrl.
 * - Secrets go in `inputs` + `${input:id}`, never plaintext in the file.
 * - Tools run in Copilot **Agent** mode, not Ask.
 */
export function vscodeEntry(opts: InstallOptions) {
  const { command, args } = launcherCommand();
  const env: Record<string, string> = {
    SLACK_MCP_MODE: opts.mode || "confirm",
  };
  if (opts.demo) {
    env.SLACK_MCP_DEMO = "1";
  } else {
    env.SLACK_USER_TOKEN = opts.userToken || "${input:slack_user_token}";
    env.SLACK_BOT_TOKEN = opts.botToken || "${input:slack_bot_token}";
  }
  return {
    type: "stdio" as const,
    command,
    args,
    env,
  };
}

export function vscodeHttpEntry(url = "http://127.0.0.1:8787/mcp") {
  return {
    type: "http" as const,
    url,
  };
}

export function vscodeInputs(): Array<Record<string, unknown>> {
  return [
    {
      type: "promptString",
      id: "slack_user_token",
      description: "Slack user token (xoxp-). Required for search and DMs.",
      password: true,
    },
    {
      type: "promptString",
      id: "slack_bot_token",
      description: "Optional Slack bot token (xoxb-). Leave empty if unused.",
      password: true,
    },
  ];
}

export function vscodeDocument(opts: InstallOptions): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    servers: { "agy-slack": vscodeEntry(opts) },
  };
  if (!opts.demo) doc.inputs = vscodeInputs();
  return doc;
}

/** Editor user mcp.json (MCP: Open User Configuration). */
export function vscodeEditorUserPath(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Code", "User", "mcp.json");
  }
  if (process.platform === "win32") {
    const roaming = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(roaming, "Code", "User", "mcp.json");
  }
  const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdg, "Code", "User", "mcp.json");
}

/** Copilot Agent Host native config — portable across VS Code and Copilot. */
export function vscodeCopilotUserPath(): string {
  return join(homedir(), ".copilot", "mcp-config.json");
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
    opts.client === "all" ? ["antigravity", "gemini", "vscode", "claude", "cursor"] : [opts.client];

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
      const commandFiles = await installGeminiCommands(join(homedir(), ".gemini", "commands", "slack"));
      files.push(...commandFiles);
      if (opts.workspace) {
        const ws = join(opts.workspace, ".gemini", "settings.json");
        await mergeServer(ws, "agy-slack", entry);
        files.push(ws);
        const wsCmds = await installGeminiCommands(
          join(opts.workspace, ".gemini", "commands", "slack"),
        );
        files.push(...wsCmds);
      }
      hints.push(
        "Preferred: " + GEMINI_EXTENSION_INSTALL + "  (GEMINI.md context, /slack:catchup, keychain token).",
      );
      hints.push(
        "Gemini CLI v0.59: restart or type /mcp. Trust the folder if asked (fail-closed workspace trust).",
      );
      hints.push("Slash commands: /slack:catchup  /slack:standup  /slack:search  /slack:draft  /slack:who");
      hints.push(`Settings-only add: ${geminiMcpAddCommand(opts)}`);
    }

    if (client === "vscode") {
      const editorPath = vscodeEditorUserPath();
      const copilotPath = vscodeCopilotUserPath();
      await mergeVscodeFile(editorPath, opts);
      await mergeVscodeFile(copilotPath, opts);
      files.push(editorPath, copilotPath);
      if (opts.workspace) {
        const ws = join(opts.workspace, ".vscode", "mcp.json");
        const portable = join(opts.workspace, ".mcp.json");
        await mergeVscodeFile(ws, opts);
        await mergeVscodeFile(portable, opts);
        files.push(ws, portable);
      }
      hints.push("VS Code: Command Palette → MCP: List Servers → Start agy-slack. Trust when asked.");
      hints.push("Copilot Chat must be in Agent mode — MCP tools do not run in Ask mode.");
      hints.push("Token is prompted on first start (${input:slack_user_token}), stored by VS Code. Do not paste xoxp- into mcp.json.");
      hints.push("HTTP uses { type: \"http\", url } — not httpUrl or serverUrl. Root key is servers, not mcpServers.");
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

export async function installGeminiCommands(destDir: string): Promise<string[]> {
  const srcDir = join(packageRoot(), "commands", "slack");
  if (!existsSync(srcDir)) return [];
  await mkdir(destDir, { recursive: true });
  const written: string[] = [];
  for (const name of await readdir(srcDir)) {
    if (!name.endsWith(".toml")) continue;
    const dest = join(destDir, name);
    const body = await readFile(join(srcDir, name), "utf8");
    await writeFile(dest, body, "utf8");
    written.push(dest);
  }
  return written;
}

async function mergeVscodeFile(path: string, opts: InstallOptions) {
  const current = await readJson(path);
  const servers = {
    ...((current.servers as Record<string, unknown> | undefined) ?? {}),
    "agy-slack": vscodeEntry(opts),
  };
  const next: Record<string, unknown> = { ...current, servers };
  if (!opts.demo) {
    const existing = Array.isArray(current.inputs)
      ? (current.inputs as Array<{ id?: string }>)
      : [];
    const byId = new Map(existing.filter((i) => i.id).map((i) => [i.id as string, i]));
    for (const input of vscodeInputs()) {
      const id = input.id as string;
      if (!byId.has(id)) byId.set(id, input);
    }
    next.inputs = [...byId.values()];
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
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
  if (client === "vscode") {
    return JSON.stringify(vscodeDocument(opts), null, 2);
  }
  const entry = antigravityEntry(opts);
  return JSON.stringify({ mcpServers: { "agy-slack": entry } }, null, 2);
}
