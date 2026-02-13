export type SpineChapterInput = {
  href: string;
  title: string;
  xhtml: string;
};

export type ExtractedChapter = {
  href: string;
  title: string;
  content: string;
};

export type ExtractedBook = {
  markdown: string;
  chapters: ExtractedChapter[];
};

function stripUnknownTags(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function annotateInlineFormatting(xhtml: string): string {
  const withParagraphBreaks = xhtml
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n")
    .replace(/<\s*p[^>]*>/gi, "");

  const withEmphasis = withParagraphBreaks
    .replace(/<\s*(em|i)\s*>/gi, "*")
    .replace(/<\s*\/\s*(em|i)\s*>/gi, "*");

  const withSmallcaps = withEmphasis
    .replace(
      /<\s*span\s+[^>]*class=["'][^"']*(smallcaps|small-caps)[^"']*["'][^>]*>/gi,
      "{smallcaps:",
    )
    .replace(/<\s*\/\s*span\s*>/gi, "}");

  return normalizeWhitespace(decodeEntities(stripUnknownTags(withSmallcaps)));
}

export function buildAnnotatedMarkdownFromSpine(
  chapters: SpineChapterInput[],
): ExtractedBook {
  const extracted = chapters.map((chapter) => ({
    href: chapter.href,
    title: chapter.title,
    content: annotateInlineFormatting(chapter.xhtml),
  }));

  const markdown = extracted
    .map((chapter) => `## ${chapter.title}\n\n${chapter.content}`)
    .join("\n\n");

  return {
    markdown,
    chapters: extracted,
  };
}
