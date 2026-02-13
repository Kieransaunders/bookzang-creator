/**
 * Simple Header-Based Copyright Checking
 *
 * No AI required - parses Gutenberg headers for:
 * - Explicit copyright warnings (*** COPYRIGHTED ***)
 * - Publication dates
 * - Permission notices
 */

export interface HeaderParseResult {
  status: "cleared" | "flagged" | "blocked" | "unknown";
  reason: string;
  warnings: string[];
  publicationYear: number | null;
  copyrightNotice: string | null;
  permissionRequired: boolean;
}

interface PublicationYearResult {
  year: number | null;
  source: string;
}

/**
 * Extract header section from full text
 */
export function extractHeaderSection(text: string): string {
  const headerEndMarkers = [
    /\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG/i,
    /\*\*\*START OF (?:THE|THIS) PROJECT GUTENBERG/i,
    /^\s*Produced by/i,
    /^\s*This file was produced from/i,
  ];

  let headerEnd = text.length;
  for (const marker of headerEndMarkers) {
    const match = text.search(marker);
    if (match !== -1 && match < headerEnd) {
      headerEnd = match;
    }
  }

  return text.slice(0, Math.min(headerEnd, 8000)).trim();
}

/**
 * Extract publication date from header
 */
export function extractPublicationDate(
  headerText: string,
): PublicationYearResult {
  const currentYear = new Date().getFullYear();
  const patterns: Array<{ regex: RegExp; source: string }> = [
    {
      regex:
        /\b(?:first published|first edition published|originally published|published originally|published in)\s*(?:in\s*)?(\d{4})\b/i,
      source: "Publication statement",
    },
    {
      regex: /\[(?:first published|published)\s*(?:in\s*)?(\d{4})\]/i,
      source: "Bracketed publication note",
    },
    {
      regex: /\bcopyright\s*(?:\(c\)|©)?\s*(\d{4})\b/i,
      source: "Copyright notice",
    },
  ];

  for (const { regex, source } of patterns) {
    const match = headerText.match(regex);
    if (!match?.[1]) {
      continue;
    }

    const year = Number.parseInt(match[1], 10);
    if (year >= 1500 && year <= currentYear) {
      return { year, source };
    }
  }

  return { year: null, source: "Not found" };
}

/**
 * Check for copyright warning flags in header
 */
export function checkHeaderWarnings(headerText: string): string[] {
  const warnings: string[] = [];

  // CRITICAL: Explicit copyright warnings
  if (
    /\*\*\*\s*This is a COPYRIGHTED Project Gutenberg eBook/i.test(headerText)
  ) {
    warnings.push(
      "EXPLICIT COPYRIGHT WARNING - Book marked as copyrighted in header",
    );
  }

  if (/please follow the copyright guidelines/i.test(headerText)) {
    warnings.push("Copyright guidelines restriction");
  }

  if (/\(c\)|©|copyright \d{4}/i.test(headerText)) {
    warnings.push("Copyright symbol or notice found");
  }

  if (/not in the public domain/i.test(headerText)) {
    warnings.push("Explicitly stated as not public domain");
  }

  if (/all rights reserved/i.test(headerText)) {
    warnings.push("All rights reserved statement");
  }

  if (/posted with permission/i.test(headerText)) {
    warnings.push("Posted with permission - republishing restrictions likely");
  }

  if (/permission granted/i.test(headerText)) {
    warnings.push("Permission-based distribution");
  }

  if (/used with permission of the rights holder/i.test(headerText)) {
    warnings.push("Rights holder permission notice");
  }

  return warnings;
}

/**
 * Parse copyright status from header
 */
export function parseCopyrightFromHeader(text: string): HeaderParseResult {
  const headerText = extractHeaderSection(text);
  const warnings = checkHeaderWarnings(headerText);
  const pubDate = extractPublicationDate(headerText);

  // BLOCK: Explicit copyright warnings
  const hasCopyrightWarning = warnings.some(
    (w) =>
      w.includes("EXPLICIT COPYRIGHT") ||
      w.includes("Copyright guidelines") ||
      w.includes("not public domain"),
  );

  if (hasCopyrightWarning) {
    return {
      status: "blocked",
      reason:
        "Book contains explicit copyright warning in header. Not safe for republication.",
      warnings,
      publicationYear: pubDate.year,
      copyrightNotice: warnings.find((w) => w.includes("COPYRIGHT")) || null,
      permissionRequired: true,
    };
  }

  // BLOCK or FLAG based on publication date
  if (pubDate.year) {
    const currentYear = new Date().getFullYear();
    const yearsOld = currentYear - pubDate.year;

    // Publication-only heuristic (conservative): modern publications are blocked.
    if (yearsOld < 70) {
      return {
        status: "blocked",
        reason: `Published ${yearsOld} years ago (${pubDate.year}, ${pubDate.source}). Very likely still in copyright.`,
        warnings,
        publicationYear: pubDate.year,
        copyrightNotice: null,
        permissionRequired: true,
      };
    }

    if (yearsOld < 120) {
      return {
        status: "flagged",
        reason: `Published ${yearsOld} years ago (${pubDate.year}, ${pubDate.source}). Borderline under UK life+70; verify contributor death dates.`,
        warnings,
        publicationYear: pubDate.year,
        copyrightNotice: null,
        permissionRequired: false,
      };
    }
  }

  // FLAG: Permission-based or other warnings
  if (warnings.length > 0) {
    return {
      status: "flagged",
      reason: `Header contains warnings: ${warnings.join("; ")}. Review before republication.`,
      warnings,
      publicationYear: pubDate.year,
      copyrightNotice: null,
      permissionRequired: warnings.some((w) => w.includes("permission")),
    };
  }

  // CLEARED: No warnings, old enough
  if (!pubDate.year) {
    return {
      status: "flagged",
      reason:
        "No explicit copyright warning found, but publication year was not detected in header. Manual review required before republication.",
      warnings: [],
      publicationYear: null,
      copyrightNotice: null,
      permissionRequired: false,
    };
  }

  return {
    status: "cleared",
    reason: `No copyright warnings. Published ${new Date().getFullYear() - pubDate.year} years ago (${pubDate.year}, ${pubDate.source}).`,
    warnings: [],
    publicationYear: pubDate.year,
    copyrightNotice: null,
    permissionRequired: false,
  };
}
