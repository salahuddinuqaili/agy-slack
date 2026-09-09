import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { antigravityEntry, snippetFor } from "./install";

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
});
