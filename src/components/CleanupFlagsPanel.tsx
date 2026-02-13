/**
 * CleanupFlagsPanel - Unresolved flag list with resolution actions
 *
 * Displays cleanup flags that require reviewer attention:
 * - Low-confidence cleanup suggestions
 * - Unlabeled boundary candidates
 * - OCR corruption detections
 * - Ambiguous punctuation
 *
 * Provides resolution controls for each flag type.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

import {
  AlertTriangle,
  HelpCircle,
  Type,
  TextQuote,
  GitBranch,
  Check,
  X,
  Edit3,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";

export interface CleanupReviewFlag {
  _id: Id<"cleanupFlags">;
  type:
    | "unlabeled_boundary_candidate"
    | "low_confidence_cleanup"
    | "ocr_corruption_detected"
    | "ambiguous_punctuation"
    | "chapter_boundary_disputed";
  status: "unresolved" | "confirmed" | "rejected" | "overridden";
  contextText: string;
  suggestedAction?: string;
  reviewerNote?: string;
  chapterId?: Id<"cleanupChapters">;
  startOffset: number;
  endOffset: number;
}

interface CleanupFlagsPanelProps {
  bookId: Id<"books">;
  flags: CleanupReviewFlag[];
  canApprove: boolean;
  onFocusFlag?: (flag: CleanupReviewFlag) => void;
}

type FlagType = CleanupFlagsPanelProps["flags"][0]["type"];

/**
 * Get icon and label for flag type
 */
function getFlagTypeInfo(type: FlagType) {
  switch (type) {
    case "unlabeled_boundary_candidate":
      return {
        icon: GitBranch,
        label: "Boundary Candidate",
        description: "Possible chapter boundary without clear heading",
      };
    case "low_confidence_cleanup":
      return {
        icon: AlertTriangle,
        label: "Low Confidence",
        description: "Cleanup suggestion with uncertain quality",
      };
    case "ocr_corruption_detected":
      return {
        icon: Type,
        label: "OCR Issue",
        description: "Possible corrupted or garbled text",
      };
    case "ambiguous_punctuation":
      return {
        icon: TextQuote,
        label: "Punctuation",
        description: "Unclear punctuation normalization",
      };
    case "chapter_boundary_disputed":
      return {
        icon: HelpCircle,
        label: "Disputed Boundary",
        description: "Chapter boundary needs confirmation",
      };
    default:
      return {
        icon: AlertTriangle,
        label: "Unknown",
        description: "Unspecified issue",
      };
  }
}

/**
 * Individual flag card with resolution controls
 */
function FlagCard({
  flag,
  onResolved,
  onFocusFlag,
}: {
  flag: CleanupFlagsPanelProps["flags"][0];
  onResolved: () => void;
  onFocusFlag?: (flag: CleanupReviewFlag) => void;
}) {
  const resolveFlag = useMutation(api.cleanup.resolveFlag);
  const promoteBoundary = useMutation(api.cleanup.promoteBoundaryToChapter);

  const [isExpanded, setIsExpanded] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [reviewerNote, setReviewerNote] = useState(flag.reviewerNote || "");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [boundaryTitle, setBoundaryTitle] = useState("");
  const [showBoundaryForm, setShowBoundaryForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeInfo = getFlagTypeInfo(flag.type);
  const Icon = typeInfo.icon;

  const handleResolve = async (
    status: "confirmed" | "rejected" | "overridden",
  ) => {
    setIsResolving(true);
    setError(null);

    try {
      await resolveFlag({
        flagId: flag._id,
        status,
        reviewerNote: reviewerNote || undefined,
      });
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve flag");
    } finally {
      setIsResolving(false);
    }
  };

  const handlePromoteBoundary = async (type: "chapter" | "body") => {
    if (!boundaryTitle.trim()) return;

    setIsResolving(true);
    setError(null);

    try {
      await promoteBoundary({
        flagId: flag._id,
        title: boundaryTitle.trim(),
        type,
      });
      onResolved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to promote boundary",
      );
    } finally {
      setIsResolving(false);
    }
  };

  // Truncate context text for preview
  const contextPreview =
    flag.contextText.length > 150
      ? flag.contextText.slice(0, 150) + "..."
      : flag.contextText;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors text-left"
      >
        <Icon size={18} className="text-yellow-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white text-sm">
              {typeInfo.label}
            </span>
            <span className="text-xs text-slate-400">
              • {typeInfo.description}
            </span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Context text */}
          <div className="p-3 bg-slate-900/50 rounded border border-white/5">
            <p className="text-xs text-slate-400 mb-1">Context:</p>
            <p className="text-sm text-slate-200 font-mono">{contextPreview}</p>
            {onFocusFlag && (
              <button
                onClick={() => onFocusFlag(flag)}
                className="mt-2 text-xs text-blue-300 hover:text-blue-200"
              >
                Jump to section
              </button>
            )}
          </div>

          {/* Suggested action */}
          {flag.suggestedAction && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-slate-400 shrink-0">Suggested:</span>
              <span className="text-blue-300">{flag.suggestedAction}</span>
            </div>
          )}

          {/* Error display */}
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 p-2 rounded">
              {error}
            </p>
          )}

          {/* Boundary promotion form (for boundary candidates) */}
          {flag.type === "unlabeled_boundary_candidate" && (
            <div className="space-y-2">
              {!showBoundaryForm ? (
                <button
                  onClick={() => setShowBoundaryForm(true)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  + Promote to chapter boundary
                </button>
              ) : (
                <div className="space-y-2 p-3 bg-blue-500/10 rounded border border-blue-500/20">
                  <input
                    type="text"
                    placeholder="Chapter title..."
                    value={boundaryTitle}
                    onChange={(e) => setBoundaryTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePromoteBoundary("chapter")}
                      disabled={!boundaryTitle.trim() || isResolving}
                      className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm rounded transition-colors"
                    >
                      {isResolving ? "..." : "Make Chapter"}
                    </button>
                    <button
                      onClick={() => handlePromoteBoundary("body")}
                      disabled={!boundaryTitle.trim() || isResolving}
                      className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm rounded transition-colors"
                    >
                      Body Section
                    </button>
                    <button
                      onClick={() => setShowBoundaryForm(false)}
                      className="px-3 py-1.5 text-slate-400 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reviewer note */}
          {showNoteInput && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a note..."
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-800 border border-white/20 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => setShowNoteInput(false)}
                className="px-3 py-2 text-slate-400 hover:text-white text-sm"
              >
                Done
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            {flag.type !== "unlabeled_boundary_candidate" && (
              <>
                <button
                  onClick={() => handleResolve("confirmed")}
                  disabled={isResolving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded text-sm transition-colors"
                  title="Accept the suggested change"
                >
                  <Check size={14} />
                  Accept
                </button>
                <button
                  onClick={() => handleResolve("rejected")}
                  disabled={isResolving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-sm transition-colors"
                  title="Reject the suggested change"
                >
                  <X size={14} />
                  Reject
                </button>
                <button
                  onClick={() => handleResolve("overridden")}
                  disabled={isResolving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded text-sm transition-colors"
                  title="Mark as manually handled"
                >
                  <Edit3 size={14} />
                  Override
                </button>
              </>
            )}
            <button
              onClick={() => setShowNoteInput(!showNoteInput)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ml-auto ${
                reviewerNote
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              }`}
              title="Add reviewer note"
            >
              <MessageSquare size={14} />
              {reviewerNote ? "Edit Note" : "Note"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Flags panel component for the review sidebar
 */
export function CleanupFlagsPanel({
  flags,
  canApprove,
  onFocusFlag,
}: CleanupFlagsPanelProps) {
  const [resolvedFlags, setResolvedFlags] = useState<Set<string>>(new Set());

  const handleFlagResolved = (flagId: string) => {
    setResolvedFlags((prev) => new Set(prev).add(flagId));
  };

  // Filter out resolved flags for display
  const visibleFlags = flags.filter((flag) => !resolvedFlags.has(flag._id));

  if (visibleFlags.length === 0 && flags.length === 0) {
    return (
      <div className="text-center py-8">
        <Check size={48} className="mx-auto mb-4 text-green-400" />
        <p className="text-white font-medium">No Flags</p>
        <p className="text-sm text-slate-400 mt-1">
          This cleanup has no flagged issues
        </p>
      </div>
    );
  }

  if (visibleFlags.length === 0 && flags.length > 0) {
    return (
      <div className="text-center py-8">
        <Check size={48} className="mx-auto mb-4 text-green-400" />
        <p className="text-white font-medium">All Flags Resolved</p>
        <p className="text-sm text-slate-400 mt-1">
          {canApprove
            ? "Ready for approval"
            : "Refresh to confirm all resolutions"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleFlags.map((flag) => (
        <FlagCard
          key={flag._id}
          flag={flag}
          onResolved={() => handleFlagResolved(flag._id)}
          onFocusFlag={onFocusFlag}
        />
      ))}
    </div>
  );
}
