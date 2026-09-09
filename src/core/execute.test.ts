import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDemoAdapter } from "./demo";
import { executeTool } from "./execute";
import { defaultConfig } from "./types";

const NOW = new Date("2026-09-09T13:11:00.000Z");

function ctx(mode: "readonly" | "confirm" | "write" = "write") {
  return {
    adapter: createDemoAdapter(NOW),
    config: defaultConfig({ mode, tz: "Europe/Berlin", demo: true }),
    now: NOW,
  };
}

describe("executeTool demo", () => {
  it("whoami reports demo identity", async () => {
    const result = await executeTool("slack_whoami", {}, ctx());
    assert.match(result.text, /salahuddin/);
    assert.match(result.text, /Northstar/);
    assert.match(result.text, /demo/);
  });

  it("lists #eng", async () => {
    const result = await executeTool("slack_channels", { query: "eng" }, ctx());
    assert.match(result.text, /#eng/);
  });

  it("reads #eng today", async () => {
    const result = await executeTool("slack_read", { channel: "#eng", since: "today" }, ctx());
    assert.match(result.text, /@maya/);
    assert.match(result.text, /token rotation/i);
  });

  it("searches the auth decision", async () => {
    const result = await executeTool(
      "slack_search",
      { query: "auth rotation in:#eng" },
      ctx(),
    );
    assert.match(result.text, /token rotation/i);
  });

  it("catch-up shows unread channels", async () => {
    const result = await executeTool("slack_unreads", {}, ctx());
    assert.match(result.text, /#eng/);
    assert.match(result.text, /#incidents/);
  });

  it("blocks writes in readonly mode", async () => {
    const result = await executeTool(
      "slack_send",
      { channel: "#eng", text: "hello" },
      ctx("readonly"),
    );
    assert.equal(result.isError, true);
    assert.match(result.text, /readonly/);
  });

  it("previews writes in confirm mode", async () => {
    const preview = await executeTool(
      "slack_send",
      { channel: "#eng", text: "hello from orbit" },
      ctx("confirm"),
    );
    assert.match(preview.text, /Write preview/);
    assert.match(preview.text, /hello from orbit/);
    const sent = await executeTool(
      "slack_send",
      { channel: "#eng", text: "hello from orbit", confirm: true },
      ctx("confirm"),
    );
    assert.match(sent.text, /sent/);
  });

  it("sends to @maya DM", async () => {
    const result = await executeTool(
      "slack_send",
      { channel: "@maya", text: "draft incoming", confirm: true },
      ctx("write"),
    );
    assert.match(result.text, /sent/);
  });

  it("creates a channel", async () => {
    const env = ctx("write");
    const result = await executeTool(
      "slack_create_channel",
      { name: "launch-q4", topic: "Q4 launch", confirm: true },
      env,
    );
    assert.match(result.text, /#launch-q4/);
    const listed = await executeTool("slack_channels", { query: "launch" }, env);
    assert.match(listed.text, /#launch-q4/);
  });

  it("doctor is healthy in demo", async () => {
    const result = await executeTool("slack_doctor", {}, ctx());
    assert.match(result.text, /agy-slack doctor/);
    assert.match(result.text, /search      ok/);
  });
});
