import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { markdownToMrkdwn, mrkdwnToMarkdown, slugifyChannel } from "./mrkdwn";

describe("mrkdwn", () => {
  it("converts links and bold", () => {
    const md = mrkdwnToMarkdown("hello *team* see <https://example.com|doc>");
    assert.match(md, /\*\*team\*\*/);
    assert.match(md, /\[doc\]\(https:\/\/example.com\)/);
  });

  it("round-trips markdown links", () => {
    assert.equal(markdownToMrkdwn("[doc](https://example.com)"), "<https://example.com|doc>");
  });

  it("slugifies channel names", () => {
    assert.equal(slugifyChannel("Launch Q4!"), "launch-q4");
  });
});
