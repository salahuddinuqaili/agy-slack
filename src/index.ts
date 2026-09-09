import { configFromEnv } from "./core/types";
import { createDemoAdapter } from "./core/demo";
import { executeTool } from "./core/execute";
import { LiveAdapter, tokensFromEnv } from "./core/live";
import { serveStdio } from "./server";
import { serveHttp } from "./http";
import { installClient, snippetFor, type ClientId } from "./install";
import { SERVER_VERSION } from "./core/catalog";
import type { ExecuteContext, SlackAdapter } from "./core/index";
import type { ServerConfig } from "./core/types";

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd) {
    if (process.stdin.isTTY) {
      printHelp();
      return;
    }
    await runServe(argv, false);
    return;
  }

  switch (cmd) {
    case "serve":
      await runServe(argv.slice(1), false);
      return;
    case "demo":
      await runServe(["--demo", ...argv.slice(1)], true);
      return;
    case "install":
      await runInstall(argv.slice(1));
      return;
    case "doctor":
      await runDoctor(argv.slice(1));
      return;
    case "snippet":
      runSnippet(argv.slice(1));
      return;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    case "version":
    case "--version":
    case "-v":
      process.stdout.write(`${SERVER_VERSION}\n`);
      return;
    default:
      process.stderr.write(`Unknown command ${cmd}\n\n`);
      printHelp();
      process.exitCode = 1;
  }
}

async function runServe(argv: string[], forceDemo: boolean) {
  const flags = parseFlags(argv);
  const demo = forceDemo || flags.demo || process.env.SLACK_MCP_DEMO === "1";
  const ctx = makeCtx(demo);
  if (flags.http) {
    const port = Number(flags.port ?? process.env.PORT ?? 8787);
    const host = flags.host ?? "127.0.0.1";
    await serveHttp(ctx, port, host);
    return;
  }
  await serveStdio(ctx);
}

async function runDoctor(argv: string[]) {
  const flags = parseFlags(argv);
  const demo = flags.demo || process.env.SLACK_MCP_DEMO === "1";
  const ctx = makeCtx(demo);
  const result = await executeTool("slack_doctor", {}, ctx);
  process.stdout.write(`${result.text}\n`);
  if (result.isError) process.exitCode = 1;
}

async function runInstall(argv: string[]) {
  const flags = parseFlags(argv);
  const client = (flags.client as ClientId) || "antigravity";
  if (!["antigravity", "gemini", "claude", "cursor", "all"].includes(client)) {
    throw new Error(`Unknown client ${client}. Use antigravity | gemini | claude | cursor | all.`);
  }
  const result = await installClient({
    client,
    demo: flags.demo,
    workspace: flags.workspace,
    botToken: process.env.SLACK_BOT_TOKEN,
    userToken: process.env.SLACK_USER_TOKEN,
    mode: process.env.SLACK_MCP_MODE || "confirm",
  });
  const extra = result.hints.length ? `\n\n${result.hints.join("\n")}` : "";
  process.stdout.write(
    `Installed agy-slack for ${client}.\n\nWrote:\n${result.files.map((f) => `  ${f}`).join("\n")}${extra}\n\nThen ask: catch me up on Slack.\n`,
  );
}

function runSnippet(argv: string[]) {
  const flags = parseFlags(argv);
  const client = (flags.client as "antigravity" | "gemini" | "claude" | "cursor") || "antigravity";
  process.stdout.write(
    `${snippetFor(client, {
      client,
      demo: flags.demo,
      botToken: process.env.SLACK_BOT_TOKEN,
      userToken: process.env.SLACK_USER_TOKEN,
      mode: process.env.SLACK_MCP_MODE || "confirm",
    })}\n`,
  );
}

function makeCtx(demo: boolean): ExecuteContext {
  const config: ServerConfig = configFromEnv(process.env);
  if (demo) config.demo = true;
  let adapter: SlackAdapter;
  if (config.demo) {
    adapter = createDemoAdapter();
  } else {
    adapter = new LiveAdapter(tokensFromEnv(process.env));
  }
  return { adapter, config, now: new Date() };
}

function parseFlags(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--demo") out.demo = true;
    else if (a === "--http") out.http = true;
    else if (a === "--port") out.port = argv[++i];
    else if (a === "--host") out.host = argv[++i];
    else if (a === "--client") out.client = argv[++i];
    else if (a === "--workspace") out.workspace = argv[++i];
    else if (a.startsWith("--")) out[a.slice(2)] = true;
  }
  return out as {
    demo?: boolean;
    http?: boolean;
    port?: string;
    host?: string;
    client?: string;
    workspace?: string;
  };
}

function printHelp() {
  process.stdout.write(`agy-slack ${SERVER_VERSION}
Slack MCP for Google Antigravity CLI and Gemini CLI v0.59.

Usage
  npx github:salahuddinuqaili/agy-slack install --client antigravity
  npx github:salahuddinuqaili/agy-slack install --client gemini
  npx github:salahuddinuqaili/agy-slack doctor
  npx github:salahuddinuqaili/agy-slack demo

Commands
  serve       Start MCP (stdio default; --http --port 8787)
  install     Write Antigravity / Gemini / Claude / Cursor config
  doctor      Check tokens, scopes, mode
  demo        Serve the Northstar demo workspace (no Slack token)
  snippet     Print a config JSON blob (--client gemini|antigravity|…)
  help        This text

Environment
  SLACK_USER_TOKEN     xoxp-  (search, DMs, status)  recommended
  SLACK_BOT_TOKEN      xoxb-  (post as app)
  SLACK_MCP_MODE       readonly | confirm | write     default confirm
  SLACK_MCP_DEMO       1
  SLACK_MCP_TZ         IANA timezone
  SLACK_MCP_ALLOW_CHANNELS / SLACK_MCP_DENY_CHANNELS

Antigravity CLI
  Config:   ~/.gemini/config/mcp_config.json
  HTTP key: serverUrl
  Reload:   /mcp

Gemini CLI v0.59
  Preferred:  gemini extensions install https://github.com/salahuddinuqaili/agy-slack
  Config:     ~/.gemini/settings.json   (project: .gemini/settings.json)
  HTTP key:   httpUrl
  Commands:   /slack:catchup  /slack:standup  /slack:search  /slack:draft  /slack:who
  Reload:     /mcp   or   gemini mcp list
  Settings:   gemini mcp add -s user -e SLACK_USER_TOKEN=$SLACK_USER_TOKEN --timeout 60000 agy-slack npx -- -y github:salahuddinuqaili/agy-slack

Docs  https://github.com/salahuddinuqaili/agy-slack
`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
