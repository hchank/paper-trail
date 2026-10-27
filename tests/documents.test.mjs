import assert from "node:assert/strict";
import test from "node:test";
import {
  htmlFromText,
  sanitizeDocumentHtml,
} from "../app/lib/documents.server.ts";

test("rich text keeps supported formatting and strips unsafe markup", () => {
  const result = sanitizeDocumentHtml(
    '<h2 onclick="alert(1)">Notes</h2><p>Keep <strong>this</strong></p><script>alert(1)</script><a href="javascript:alert(1)">unsafe link</a>',
  );

  assert.equal(result, "<h2>Notes</h2><p>Keep <strong>this</strong></p>unsafe link");
});

test("text imports are escaped and retain line breaks as paragraphs", () => {
  assert.equal(
    htmlFromText("<script>not executable</script>\nSecond line"),
    "<p>&lt;script&gt;not executable&lt;/script&gt;</p><p>Second line</p>",
  );
});
