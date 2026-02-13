import test from "node:test";
import assert from "node:assert/strict";
import { selectPreferredSource } from "../intakeSourceResolver";

test("quality mode prefers epub over txt", () => {
  const picked = selectPreferredSource([
    { format: "txt", url: "https://www.gutenberg.org/ebooks/11.txt.utf-8" },
    {
      format: "epub.noimages",
      url: "https://www.gutenberg.org/ebooks/11.epub.noimages",
    },
  ]);

  assert.equal(picked.format, "epub.noimages");
});
