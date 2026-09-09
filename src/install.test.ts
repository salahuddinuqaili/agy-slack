import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { antigravityEntry, geminiEntry, geminiHttpEntry, geminiMcpAddCommand, snippetFor } from "./install";

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
});
