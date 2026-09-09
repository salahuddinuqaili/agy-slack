import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTimeRange, startOfDay } from "./time";

const TZ = "Europe/Berlin";
const NOW = new Date("2026-09-09T13:11:00.000Z"); // 15:11 CEST

describe("parseTimeRange", () => {
  it("parses today as start of local day", () => {
    const range = parseTimeRange({ since: "today", now: NOW, tz: TZ });
    const start = startOfDay(NOW, TZ);
    assert.equal(range.oldest, Math.floor(start.getTime() / 1000));
  });

  it("parses 4h as four hours ago", () => {
    const range = parseTimeRange({ since: "4h", now: NOW, tz: TZ });
    assert.equal(range.oldest, Math.floor(NOW.getTime() / 1000) - 4 * 3600);
  });

  it("parses 7d", () => {
    const range = parseTimeRange({ since: "7d", now: NOW, tz: TZ });
    assert.equal(range.oldest, Math.floor(NOW.getTime() / 1000) - 7 * 86400);
  });

  it("parses last 90m", () => {
    const range = parseTimeRange({ since: "last 90m", now: NOW, tz: TZ });
    assert.equal(range.oldest, Math.floor(NOW.getTime() / 1000) - 90 * 60);
  });

  it("parses unix seconds", () => {
    const range = parseTimeRange({ since: "1757410000", now: NOW, tz: TZ });
    assert.equal(range.oldest, 1757410000);
  });

  it("rejects junk", () => {
    assert.throws(() => parseTimeRange({ since: "next eon", now: NOW, tz: TZ }), /Could not parse/);
  });
});
