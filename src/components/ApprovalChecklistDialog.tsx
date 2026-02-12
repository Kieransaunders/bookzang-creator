/**
 * ApprovalChecklistDialog - Checklist confirmation dialog for cleanup approval
 * 
 * Per CONTEXT.md requirements:
 * - Approval requires checklist confirmation (not single-click)
 * - Approval blocked when unresolved low-confidence flags remain
 * 
 * This dialog enforces explicit confirmation of quality criteria before
 * the approval mutation can be submitted.
 */

import { useState } from "react";
import { CheckCircle, AlertCircle, X, FileCheck, BookOpen, Type, History } from "lucide-react";

interface ApprovalChecklistDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when dialog is closed without approving */
  onClose: () => void;
  /** Called when all checklist items confirmed and approve clicked */
  onApprove: (checklist: {
    boilerplateRemoved: boolean;
    chapterBoundariesVerified: boolean;
    punctuationReviewed: boolean;
    archaicPreserved: boolean;
  }) => void;
  /** Number of unresolved flags blocking approval */
  unresolvedFlagCount: number;
  /** Whether approval is in progress */
  isApproving: boolean;
}

/**
 * Checklist item definition
 */
interface ChecklistItem {
  id: keyof ApprovalChecklistDialogProps["onApprove"] extends (c: infer C) => void ? C : never;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "boilerplateRemoved",
    label: "Boilerplate Removed",
    description: "Project Gutenberg license header and trailer have been stripped",
    icon: <FileCheck size={18} />,
  },
  {
    id: "chapterBoundariesVerified",
    label: "Chapter Boundaries Verified",
    description: "All chapter headings are correctly identified and formatted",
    icon: <BookOpen size={18} />,
  },
  {
    id: "punctuationReviewed",
    label: "Punctuation Reviewed",
    description: "Punctuation normalization looks correct (archaic forms preserved)",
    icon: <Type size={18} />,
  },
  {
    id: "archaicPreserved",
    label: "Archaic Language Preserved",
    description: "Old spelling and grammar conventions intentionally kept intact",
    icon: <History size={18} />,
  },
];

/**
 * Approval checklist dialog with explicit confirmation requirements
 */
export function ApprovalChecklistDialog({
  isOpen,
  onClose,
  onApprove,
  unresolvedFlagCount,
  isApproving,
}: ApprovalChecklistDialogProps) {
  const [confirmedItems, setConfirmedItems] = useState<Record<string, boolean>>({
    boilerplateRemoved: false,
    chapterBoundariesVerified: false,
    punctuationReviewed: false,
    archaicPreserved: false,
  });

  // Reset state when dialog opens
  useState(() => {
    if (isOpen) {
      setConfirmedItems({
        boilerplateRemoved: false,
        chapterBoundariesVerified: false,
        punctuationReviewed: false,
        archaicPreserved: false,
      });
    }
  });

  if (!isOpen) return null;

  const isBlockedByFlags = unresolvedFlagCount > 0;
  const allConfirmed = Object.values(confirmedItems).every(Boolean);
  const canApprove = allConfirmed && !isBlockedByFlags && !isApproving;

  const handleToggle = (id: string) => {
    setConfirmedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleApprove = () => {
    if (!canApprove) return;
    onApprove({
      boilerplateRemoved: confirmedItems.boilerplateRemoved,
      chapterBoundariesVerified: confirmedItems.chapterBoundariesVerified,
      punctuationReviewed: confirmedItems.punctuationReviewed,
      archaicPreserved: confirmedItems.archaicPreserved,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg liquid-glass-strong rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle size={20} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Approve Cleanup
              </h2>
              <p className="text-sm text-slate-400">
                Confirm all quality checks before proceeding
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Blocking warning */}
          {isBlockedByFlags && (
            <div className="flex gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <AlertCircle size={20} className="text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-300">
                  Approval Blocked
                </p>
                <p className="text-sm text-yellow-200/70 mt-1">
                  Resolve {unresolvedFlagCount} unresolved flag
                  {unresolvedFlagCount !== 1 ? "s" : ""} in the Flags panel
                  before approving. Uncertainty must be reviewed before this
                  cleanup can progress to export.
                </p>
              </div>
            </div>
          )}

          {/* Checklist */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">
              Quality Checklist
              <span className="text-slate-500 font-normal">
                {" "}(all required)
              </span>
            </p>

            {CHECKLIST_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleToggle(item.id)}
                disabled={isBlockedByFlags || isApproving}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
                  confirmedItems[item.id]
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                } ${
                  isBlockedByFlags || isApproving
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    confirmedItems[item.id]
                      ? "bg-green-500 border-green-500"
                      : "border-slate-500"
                  }`}
                >
                  {confirmedItems[item.id] && (
                    <CheckCircle size={12} className="text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        confirmedItems[item.id]
                          ? "text-green-300"
                          : "text-slate-300"
                      }
                    >
                      {item.icon}
                    </span>
                    <span
                      className={`font-medium ${
                        confirmedItems[item.id]
                          ? "text-green-300"
                          : "text-white"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {item.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/5">
          <button
            onClick={onClose}
            disabled={isApproving}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={!canApprove}
            className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              canApprove
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-slate-700 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isApproving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                Approve Cleanup
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
