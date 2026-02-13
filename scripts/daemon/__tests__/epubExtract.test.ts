import test from "node:test";
import assert from "node:assert/strict";
import {
  annotateInlineFormatting,
  buildAnnotatedMarkdownFromSpine,
} from "../epubExtract";

test("xhtml emphasis maps to annotated markdown markers", () => {
  const xhtml = "<p>He said <em>Hello</em> to <span class=\"smallcaps\">Rome</span>.</p>";
  const text = annotateInlineFormatting(xhtml);

  assert.equal(text, "He said *Hello* to {smallcaps:Rome}.");
});

test("spine order is preserved in extracted chapter output", () => {
  const result = buildAnnotatedMarkdownFromSpine([
    {
      href: "chapter-2.xhtml",
      title: "Chapter 2",
      xhtml: "<p>Second</p>",
    },
    {
      href: "chapter-3.xhtml",
      title: "Chapter 3",
      xhtml: "<p>Third</p>",
    },
  ]);

  assert.equal(result.chapters[0]?.title, "Chapter 2");
  assert.equal(result.chapters[1]?.title, "Chapter 3");
  assert.match(result.markdown, /## Chapter 2[\s\S]*## Chapter 3/);
});
