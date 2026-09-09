import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AmbiguousRefError,
  channelAllowed,
  findUser,
  fold,
  parsePermalink,
  requireUser,
  resolveChannelRef,
  slackifyTs,
} from "./resolve";
import { seedDemo } from "./demo";

const { users, channels } = seedDemo(new Date("2026-09-09T13:11:00.000Z"));

describe("permalinks", () => {
  it("parses archive links with packed ts", () => {
    const ref = parsePermalink(
      "https://northstar-labs.slack.com/archives/C0ENG/p1757416260123456",
    );
    assert.equal(ref?.channel, "C0ENG");
    assert.equal(ref?.ts, "1757416260.123456");
  });

  it("parses thread query", () => {
    const ref = parsePermalink(
      "https://northstar-labs.slack.com/archives/C0ENG/p1757416260123456?thread_ts=1757410000.000100",
    );
    assert.equal(ref?.threadTs, "1757410000.000100");
  });

  it("slackifies p-timestamps", () => {
    assert.equal(slackifyTs("p1757416260123456"), "1757416260.123456");
  });
});

describe("resolveChannelRef", () => {
  it("resolves #eng", () => {
    const r = resolveChannelRef("#eng", channels, users);
    assert.equal(r.channel.id, "C0ENG");
  });

  it("resolves @maya to the DM", () => {
    const r = resolveChannelRef("@maya", channels, users);
    assert.equal(r.channel.id, "D0MAYA");
    assert.equal(r.channel.isIm, true);
  });

  it("finds users by name", () => {
    const u = findUser(users, "Maya Chen");
    assert.equal(u?.id, "U0MAYA");
  });

  it("finds users by email local-part", () => {
    assert.equal(findUser(users, "maya@northstar.example")?.id, "U0MAYA");
  });

  it("folds case and whitespace", () => {
    assert.equal(requireUser(users, "  @MAYA  ").id, "U0MAYA");
  });

  it("does not resolve unknown people", () => {
    assert.throws(() => requireUser(users, "@nobody"), /No user matching/);
  });

  it("throws AmbiguousRefError with candidates", () => {
    const err = new AmbiguousRefError("Ambiguous user \"x\"", ["@a", "@b"]);
    assert.equal(err.candidates.length, 2);
  });
});

describe("fold", () => {
  it("strips diacritics and leading @", () => {
    assert.equal(fold("@José"), "jose");
    assert.equal(fold("O'Brien"), "obrien");
    assert.equal(fold("#Eng"), "eng");
  });
});

describe("channelAllowed", () => {
  const eng = channels.find((c) => c.id === "C0ENG")!;
  const maya = channels.find((c) => c.id === "D0MAYA")!;

  it("matches #eng on the allow list", () => {
    assert.equal(channelAllowed(eng, ["#eng"], []).ok, true);
    assert.equal(channelAllowed(eng, ["#incidents"], []).ok, false);
  });

  it("matches @maya on a DM allow list", () => {
    assert.equal(channelAllowed(maya, ["@maya"], []).ok, true);
    assert.equal(channelAllowed(maya, ["#eng"], []).ok, false);
  });

  it("denies listed channels", () => {
    assert.equal(channelAllowed(eng, [], ["#eng"]).ok, false);
  });
});
