import test from "node:test";
import assert from "node:assert/strict";
import { buildAttachmentUrl } from "../src/attachment-links.js";

test("law.go.kr attachment source URLs are returned unchanged", () => {
  const sourceUrl = "https://www.law.go.kr/LSW/flDownload.do?flSeq=1";

  assert.equal(buildAttachmentUrl({ source_url: sourceUrl }), sourceUrl);
});

test("non-official and unsafe attachment source URLs are rejected", () => {
  assert.equal(buildAttachmentUrl({ source_url: "https://example.com/file.pdf" }), "");
  assert.equal(buildAttachmentUrl({ source_url: "javascript:alert(1)" }), "");
});
