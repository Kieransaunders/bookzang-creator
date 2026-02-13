/**
 * Copyright status labels, badges, and utilities
 */

export const COPYRIGHT_STATUS_LABELS = {
  unknown: "Unknown",
  checking: "Checking",
  cleared: "Cleared",
  flagged: "Flagged",
  blocked: "Blocked",
} as const;

export type CopyrightStatus = keyof typeof COPYRIGHT_STATUS_LABELS;

export const getCopyrightStatusLabel = (status?: string) => {
  if (!status) return "Unknown";
  return COPYRIGHT_STATUS_LABELS[status as CopyrightStatus] ?? "Unknown";
};

export const getCopyrightStatusBadgeClass = (status?: string) => {
  switch (status) {
    case "cleared":
      return "bg-emerald-500/20 text-emerald-200 border-emerald-500/40";
    case "checking":
      return "bg-sky-500/20 text-sky-200 border-sky-500/40";
    case "flagged":
      return "bg-amber-500/20 text-amber-200 border-amber-500/40";
    case "blocked":
      return "bg-rose-500/20 text-rose-200 border-rose-500/40";
    case "unknown":
    default:
      return "bg-slate-500/20 text-slate-200 border-slate-500/40";
  }
};

export const getCopyrightStatusIcon = (status?: string) => {
  switch (status) {
    case "cleared":
      return "✓";
    case "checking":
      return "◌";
    case "flagged":
      return "⚠";
    case "blocked":
      return "✕";
    case "unknown":
    default:
      return "?";
  }
};

export const COPYRIGHT_STATUS_DESCRIPTIONS: Record<string, string> = {
  cleared:
    "Header scan found no warnings and publication year appears safely old.",
  checking: "Header copyright scan in progress.",
  flagged:
    "Potential risk detected. Review publication details before continuing.",
  blocked:
    "Header indicates in-copyright or restricted rights. Processing is blocked.",
  unknown: "Copyright status has not been confirmed yet.",
};

export const getCopyrightStatusDescription = (status?: string) => {
  if (!status) return COPYRIGHT_STATUS_DESCRIPTIONS.unknown;
  return (
    COPYRIGHT_STATUS_DESCRIPTIONS[status] ??
    COPYRIGHT_STATUS_DESCRIPTIONS.unknown
  );
};
