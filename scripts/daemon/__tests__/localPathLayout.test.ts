import test from "node:test";
import assert from "node:assert/strict";
import { buildLocalPaths } from "../localPaths";

test("book 11 path layout maps under Library", () => {
  const paths = buildLocalPaths("Library", "11");

  assert.equal(paths.txtPath, "Library/epub/11/pg11.txt");
  assert.equal(paths.epubPath, "Library/epub/11/pg11.epub");
  assert.equal(paths.extractedPath, "Library/work/11/extracted/book.annotated.md");
  assert.equal(paths.derivedPath, "Library/work/11/derived/chapters.json");
  assert.equal(paths.manifestPath, "Library/work/11/manifest.json");
  assert.equal(paths.exportsDir, "Library/work/11/exports");
});
