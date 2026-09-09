import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDemoAdapter } from "./demo";
import { executeTool } from "./execute";
import { makeCrowd } from "./crowd";
import {
  AmbiguousRefError,
  channelAllowed,
  findUser,
  fold,
  resolveChannelRef,
  UserDirectory,
} from "./resolve";
import { defaultConfig } from "./types";

const NOW = new Date("2026-09-09T13:11:00.000Z");
const crowd = makeCrowd(1000);
const dir = new UserDirectory(crowd.users);

function merged() {
  const adapter = createDemoAdapter(NOW);
  adapter.state.users = [...adapter.state.users, ...crowd.users];
  adapter.state.channels = [...adapter.state.channels, ...crowd.channels];
  return {
    adapter,
    config: defaultConfig({ mode: "write" as const, tz: "Europe/Berlin", demo: true }),
    now: NOW,
  };
}

describe("1000-user crowd", () => {
  it("seeds exactly 1000 users with collision clusters", () => {
    assert.equal(crowd.users.length, 1000);
    assert.equal(crowd.alexes.length, 50);
    assert.equal(crowd.unicode.length, 10);
    assert.equal(crowd.deleted.length, 10);
    assert.equal(crowd.bots.length, 10);
    assert.equal(crowd.jordans.length, 10);
    assert.ok(crowd.unique.length >= 700);
  });

  it("resolves every living unique handle, @handle, email, and id", () => {
    let n = 0;
    for (const u of crowd.unique) {
      assert.equal(dir.find(u.name)?.id, u.id, `handle ${u.name}`);
      assert.equal(dir.find(`@${u.name}`)?.id, u.id, `@${u.name}`);
      assert.equal(dir.find(u.id)?.id, u.id, `id ${u.id}`);
      if (u.email) {
        assert.equal(dir.find(u.email)?.id, u.id, `email ${u.email}`);
      }
      n += 1;
    }
    assert.ok(n >= 700, `expected ≥700 unique users, got ${n}`);
  });

  it("one-shot findUser still works without a prebuilt directory", () => {
    const sample = crowd.unique.filter((_, i) => i % 50 === 0);
    assert.ok(sample.length >= 14);
    for (const u of sample) {
      assert.equal(findUser(crowd.users, u.name)?.id, u.id);
    }
  });

  it("skips deleted users by name but still finds them by id", () => {
    for (const u of crowd.deleted) {
      assert.equal(dir.find(u.name), undefined, u.name);
      assert.equal(dir.find(u.id)?.id, u.id);
    }
  });

  it("folds unicode handles so josé finds José", () => {
    const jose = crowd.unicode.find((u) => u.name === "jose");
    const muller = crowd.unicode.find((u) => u.name === "muller");
    const soren = crowd.unicode.find((u) => u.name === "soren");
    const liwei = crowd.unicode.find((u) => u.name === "liwei");
    assert.equal(dir.find("José")?.id, jose?.id);
    assert.equal(dir.find("jose garcia")?.id, jose?.id);
    assert.equal(dir.find("Müller")?.id, muller?.id);
    assert.equal(dir.find("lina muller")?.id, muller?.id);
    assert.equal(dir.find("Søren")?.id, soren?.id);
    assert.equal(dir.find("soren")?.id, soren?.id);
    assert.equal(dir.find("李伟")?.id, liwei?.id);
    assert.equal(fold("François"), "francois");
  });

  it("matches dotted handles via compact form", () => {
    const first = crowd.dotted[0];
    assert.ok(first);
    assert.equal(dir.find("jsmith0")?.id, first.id);
    assert.equal(dir.find("j.smith.0")?.id, first.id);
  });

  it("prefers exact ann over anna and annabelle", () => {
    assert.equal(dir.require("ann").id, crowd.prefix.ann.id);
    assert.equal(dir.require("anna").id, crowd.prefix.anna.id);
    assert.equal(dir.require("annabelle").id, crowd.prefix.annabelle.id);
  });

  it("refuses to silently pick one of fifty Alexes", () => {
    assert.throws(() => dir.require("alex"), AmbiguousRefError);
    assert.throws(() => dir.require("@Alex"), /Ambiguous user/);
    const listed = dir.search("alex", { limit: 50 });
    assert.ok(listed.length >= 20, `expected many alexes, got ${listed.length}`);
  });

  it("treats shared real names as ambiguous unless a handle is given", () => {
    assert.throws(() => dir.require("Jordan Lee"), AmbiguousRefError);
    assert.equal(dir.require("jordanlee3").id, crowd.jordans[3]?.id);
  });

  it("matches O'Brien after apostrophe folding", () => {
    const first = crowd.obriens[0];
    assert.ok(first);
    assert.equal(dir.find("o'brien 0")?.id, first.id);
    assert.equal(dir.find("Siobhan OBrien 0")?.id, first.id);
  });

  it("resolves 1000 DMs by @handle without stealing #eng", () => {
    let n = 0;
    for (const u of crowd.unique) {
      if (u.deleted) continue;
      const resolved = resolveChannelRef(`@${u.name}`, crowd.channels, dir);
      assert.equal(resolved.channel.user, u.id, u.name);
      assert.equal(resolved.channel.isIm, true);
      n += 1;
    }
    assert.ok(n >= 700);
  });

  it("does not resolve the prefix 'person' to person0", () => {
    assert.throws(
      () => resolveChannelRef("person", crowd.channels, dir),
      /Ambiguous channel/,
    );
  });

  it("honours @handle allow lists on DMs", () => {
    const person0 = {
      id: "D0C0000",
      name: "person0",
      nameNormalized: "person0",
      isIm: true as const,
      user: "U0C0000",
    };
    assert.equal(channelAllowed(person0, ["@person0"], []).ok, true);
    assert.equal(channelAllowed(person0, [], ["@person0"]).ok, false);
  });

  it("looks up 1000 unique handles in well under 50ms", () => {
    const t0 = performance.now();
    for (const u of crowd.unique) {
      if (dir.find(u.name)?.id !== u.id) throw new Error(`mismatch ${u.name}`);
    }
    const dt = performance.now() - t0;
    assert.ok(dt < 50, `1000 unique lookups took ${dt.toFixed(1)}ms`);
  });
});

describe("1000-user executeTool", () => {
  it("keeps Northstar #eng working beside 1000 extra people", async () => {
    const ctx = merged();
    const read = await executeTool("slack_read", { channel: "#eng", since: "today" }, ctx);
    assert.ok(!read.isError, read.text);
    assert.match(read.text, /@maya/);
    const who = await executeTool("slack_whoami", {}, ctx);
    assert.match(who.text, /salahuddin/);
  });

  it("finds each of 1000 unique people via slack_users", async () => {
    const ctx = merged();
    let ok = 0;
    for (const u of crowd.unique) {
      const result = await executeTool("slack_users", { query: u.name, limit: 5 }, ctx);
      assert.ok(!result.isError, result.text);
      assert.ok(
        result.text.includes(`@${u.displayName || u.name}`),
        `missing @handle for ${u.name}: ${result.text.slice(0, 180)}`,
      );
      assert.ok(result.text.includes(u.id), `missing id for ${u.name}`);
      ok += 1;
    }
    assert.equal(ok, crowd.unique.length);
  });

  it("opens DMs and sends to 200 distinct people", async () => {
    const ctx = merged();
    const sample = crowd.unique.filter((u) => !u.isBot).slice(0, 200);
    for (const u of sample) {
      const result = await executeTool(
        "slack_send",
        { channel: `@${u.name}`, text: `ping ${u.name}`, confirm: true },
        ctx,
      );
      assert.ok(!result.isError, result.text);
      assert.match(result.text, /sent/);
    }
    assert.equal(sample.length, 200);
  });

  it("surfaces ambiguous Alex instead of messaging a random one", async () => {
    const ctx = merged();
    const result = await executeTool(
      "slack_send",
      { channel: "@Alex", text: "hi", confirm: true },
      ctx,
    );
    assert.equal(result.isError, true);
    assert.match(result.text, /Ambiguous user/);
  });

  it("lists many Alexes from slack_users so the model can pick a U-id", async () => {
    const ctx = merged();
    const result = await executeTool("slack_users", { query: "alex", limit: 50 }, ctx);
    assert.ok(!result.isError, result.text);
    const ids = crowd.alexes.filter((u) => result.text.includes(u.id));
    assert.ok(ids.length >= 20, `expected ≥20 alex ids in output, got ${ids.length}`);
  });
});
