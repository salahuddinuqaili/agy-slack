import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  antigravityEntry,
  geminiEntry,
  geminiHttpEntry,
  geminiMcpAddCommand,
  vscodeDocument,
  vscodeEntry,
  vscodeHttpEntry,
  vscodeEditorUserPath,
  GEMINI_EXTENSION_INSTALL,
  GEMINI_SLASH_COMMANDS,
  packageRoot,
  snippetFor,
} from "./install";

describe("install", () => {
  it("emits Antigravity stdio config with env", () => {
    const entry = antigravityEntry({
      client: "antigravity",
      userToken: "xoxp-test",
      mode: "confirm",
    });
    assert.equal(entry.command, "npx");
    assert.deepEqual(entry.args, ["-y", "github:salahuddinuqaili/agy-slack"]);
    assert.equal(entry.env.SLACK_USER_TOKEN, "xoxp-test");
    assert.equal(entry.env.SLACK_MCP_MODE, "confirm");
  });

  it("prints a valid JSON snippet", () => {
    const json = snippetFor("antigravity", { client: "antigravity", demo: true });
    const parsed = JSON.parse(json) as { mcpServers: { "agy-slack": { command: string } } };
    assert.equal(parsed.mcpServers["agy-slack"].command, "npx");
    assert.match(json, /SLACK_MCP_DEMO/);
  });

  it("emits a Gemini CLI v0.59 settings.json entry", () => {
    const entry = geminiEntry({ client: "gemini", mode: "confirm" });
    assert.equal(entry.command, "npx");
    assert.equal(entry.timeout, 60_000);
    assert.equal(entry.trust, false);
    assert.equal(entry.env.SLACK_USER_TOKEN, "$SLACK_USER_TOKEN");
    assert.equal(entry.env.SLACK_BOT_TOKEN, "$SLACK_BOT_TOKEN");
    const json = snippetFor("gemini", { client: "gemini" });
    const parsed = JSON.parse(json) as {
      mcpServers: { "agy-slack": { httpUrl?: string; timeout: number; env: Record<string, string> } };
    };
    assert.equal(parsed.mcpServers["agy-slack"].timeout, 60_000);
    assert.equal(parsed.mcpServers["agy-slack"].env.SLACK_USER_TOKEN, "$SLACK_USER_TOKEN");
    assert.doesNotMatch(json, /serverUrl/);
  });

  it("uses httpUrl — not url or serverUrl — for Gemini streamable HTTP", () => {
    const http = geminiHttpEntry();
    assert.equal(http.httpUrl, "http://127.0.0.1:8787/mcp");
    assert.equal("url" in http, false);
    assert.equal("serverUrl" in http, false);
  });

  it("prints the native gemini mcp add command with -- before npx args", () => {
    const cmd = geminiMcpAddCommand({ client: "gemini" });
    assert.match(cmd, /gemini mcp add -s user/);
    assert.match(cmd, /--timeout 60000/);
    assert.match(cmd, /agy-slack npx -- -y github:salahuddinuqaili\/agy-slack/);
    assert.match(cmd, /SLACK_USER_TOKEN=\$SLACK_USER_TOKEN/);
  });

  it("ships a valid Gemini CLI extension manifest", () => {
    const raw = readFileSync(join(packageRoot(), "gemini-extension.json"), "utf8");
    const ext = JSON.parse(raw) as {
      name: string;
      mcpServers: Record<string, { command: string; args: string[]; timeout: number; env: Record<string, string> }>;
      settings: Array<{ envVar: string; sensitive?: boolean }>;
      contextFileName: string;
    };
    assert.equal(ext.name, "agy-slack");
    assert.doesNotMatch(ext.name, /_/);
    const server = ext.mcpServers["agy-slack"];
    assert.ok(server);
    assert.equal(server.timeout, 60_000);
    assert.equal("trust" in server, false);
    assert.equal(server.env.SLACK_USER_TOKEN, "$SLACK_USER_TOKEN");
    const vars = ext.settings.map((s) => s.envVar);
    for (const required of [
      "SLACK_USER_TOKEN",
      "SLACK_BOT_TOKEN",
      "SLACK_MCP_MODE",
      "SLACK_MCP_TZ",
      "SLACK_MCP_DEMO",
    ]) {
      assert.ok(vars.includes(required), `missing setting ${required}`);
    }
    assert.equal(ext.settings.find((s) => s.envVar === "SLACK_USER_TOKEN")?.sensitive, true);
    assert.equal(ext.contextFileName, "GEMINI.md");
    assert.match(GEMINI_EXTENSION_INSTALL, /gemini extensions install/);
  });

  it("ships slash commands and a short GEMINI.md", () => {
    const root = packageRoot();
    const md = readFileSync(join(root, "GEMINI.md"), "utf8");
    assert.ok(md.length < 4000, "GEMINI.md must stay small enough for session context");
    assert.match(md, /slack_unreads/);
    assert.match(md, /confirm=true/);
    for (const name of GEMINI_SLASH_COMMANDS) {
      const body = readFileSync(join(root, "commands", "slack", `${name}.toml`), "utf8");
      assert.match(body, /prompt\s*=/);
      assert.match(body, /description\s*=/);
    }
  });

  it("emits a VS Code mcp.json with servers + inputs, not mcpServers", () => {
    const doc = vscodeDocument({ client: "vscode", mode: "confirm" });
    const servers = doc.servers as Record<string, ReturnType<typeof vscodeEntry>>;
    const entry = servers["agy-slack"];
    assert.equal(entry.type, "stdio");
    assert.equal(entry.command, "npx");
    assert.equal(entry.env.SLACK_USER_TOKEN, "${input:slack_user_token}");
    assert.ok(Array.isArray(doc.inputs));
    const json = snippetFor("vscode", { client: "vscode" });
    assert.match(json, /"servers"/);
    assert.doesNotMatch(json, /mcpServers/);
    assert.doesNotMatch(json, /httpUrl/);
    assert.doesNotMatch(json, /serverUrl/);
    const http = vscodeHttpEntry();
    assert.equal(http.type, "http");
    assert.equal(http.url, "http://127.0.0.1:8787/mcp");
    assert.ok(vscodeEditorUserPath().endsWith("mcp.json"));
  });

  it("skips VS Code input prompts in demo mode", () => {
    const doc = vscodeDocument({ client: "vscode", demo: true });
    const servers = doc.servers as Record<string, ReturnType<typeof vscodeEntry>>;
    assert.equal(servers["agy-slack"].env.SLACK_MCP_DEMO, "1");
    assert.equal("inputs" in doc, false);
  });
});
