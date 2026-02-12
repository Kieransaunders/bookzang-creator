/**
 * CleanupReviewPage - Editorial review shell for cleaned text
 * 
 * Loads review data (original, cleaned, chapters, flags), provides
 * side-by-side diff editing, and allows saving cleaned revisions.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { CleanupMergeEditor } from "./CleanupMergeEditor";
import { CleanupFlagsPanel } from "./CleanupFlagsPanel";
import { ApprovalChecklistDialog } from "./ApprovalChecklistDialog";

import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  FileText,
  Layers,
  Flag,
  Clock,
  Shield,
} from "lucide-react";

interface CleanupReviewPageProps {
  /** Book ID being reviewed */
  bookId: Id<"books">;
  /** Callback when user exits review */
  onExit: () => void;
}

/**
 * Main review page for editorial cleanup workflow
 * 
 * Layout:
 * - Header with book info, save button, exit
 * - Main area: Side-by-side merge editor
 * - Sidebar: Chapters list and flags panel
 */
export function CleanupReviewPage({ bookId, onExit }: CleanupReviewPageProps) {
  // Load review data
  const reviewData = useQuery(api.cleanup.getReviewData, { bookId });
  const approvalState = useQuery(api.cleanup.getApprovalState, { bookId });
  const saveRevision = useMutation(api.cleanup.saveCleanedRevision);
  const approveRevision = useMutation(api.cleanup.approveRevision);

  // Local state for editing
  const [editedText, setEditedText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"chapters" | "flags">("flags");

  // Approval dialog state
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Post-approval edit prompt state
  const [showPostApprovalPrompt, setShowPostApprovalPrompt] = useState(false);
  const [pendingSaveContent, setPendingSaveContent] = useState<string | null>(null);

  // Initialize edited text when review data loads
  const handleCleanedChange = useCallback((text: string) => {
    setEditedText(text);
    setSaveError(null);
  }, []);

  // Check if save would trigger post-approval edit flow
  const checkPostApprovalSave = useCallback(() => {
    // If book is approved and we're editing the approved revision
    if (approvalState?.isApproved && approvalState?.approvalValid && editedText !== reviewData?.revision?.content) {
      setPendingSaveContent(editedText);
      setShowPostApprovalPrompt(true);
      return true;
    }
    return false;
  }, [approvalState, editedText, reviewData?.revision?.content]);

  // Handle save with optional keepApproval parameter
  const performSave = async (keepApproval?: boolean) => {
    if (!reviewData?.revision) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await saveRevision({
        bookId,
        content: editedText,
        parentRevisionId: reviewData.revision._id,
        keepApproval,
      });
      setLastSaved(new Date());
      
      // Show feedback if approval was affected
      if (result.approvalRevoked) {
        setSaveError("Approval revoked: A new revision was created. Re-approval required for export.");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save revision");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle save button click
  const handleSave = async () => {
    if (checkPostApprovalSave()) {
      return; // Prompt will handle the save
    }
    await performSave();
  };

  // Handle post-approval edit choice
  const handlePostApprovalChoice = async (keepApproval: boolean) => {
    setShowPostApprovalPrompt(false);
    await performSave(keepApproval);
  };

  // Handle approval
  const handleApprove = async (checklist: {
    boilerplateRemoved: boolean;
    chapterBoundariesVerified: boolean;
    punctuationReviewed: boolean;
    archaicPreserved: boolean;
  }) => {
    if (!reviewData?.revision) return;

    setIsApproving(true);
    setApprovalError(null);

    try {
      const result = await approveRevision({
        bookId,
        revisionId: reviewData.revision._id,
        checklistConfirmed: checklist,
      });

      if (result.success) {
        setIsApprovalDialogOpen(false);
      } else {
        setApprovalError(result.error || "Approval failed");
      }
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setIsApproving(false);
    }
  };

  // Loading state
  if (reviewData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-slate-400">Loading review data...</p>
        </div>
      </div>
    );
  }

  // Error state - no original or revision data
  if (!reviewData.original || !reviewData.revision) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full liquid-glass-strong p-8 rounded-2xl text-center">
          <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
          <h2 className="text-xl font-semibold text-white mb-2">
            Cleanup Data Not Available
          </h2>
          <p className="text-slate-400 mb-6">
            This book hasn&apos;t been processed through cleanup yet. Please run cleanup first.
          </p>
          <button
            onClick={onExit}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const { book, original, revision, chapters, unresolvedFlags, canApprove } = reviewData;
  const hasChanges = editedText !== "" && editedText !== revision.content;
  const unresolvedCount = unresolvedFlags.length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="liquid-glass-strong border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onExit}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Back to Library"
            >
              <ArrowLeft size={20} className="text-slate-300" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {book.title}
              </h1>
              <p className="text-sm text-slate-400">{book.author}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status indicators */}
            <div className="flex items-center gap-3">
              {approvalState?.approvalValid ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-full text-sm">
                  <Shield size={14} />
                  Approved
                </span>
              ) : unresolvedCount > 0 ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded-full text-sm">
                  <Flag size={14} />
                  {unresolvedCount} unresolved
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-full text-sm">
                  <CheckCircle size={14} />
                  All flags resolved
                </span>
              )}
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                <FileText size={14} />
                Rev {revision.revisionNumber}
              </span>
            </div>

            {/* Last saved indicator */}
            {lastSaved && (
              <span className="text-sm text-slate-400 flex items-center gap-1.5">
                <Clock size={14} />
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                hasChanges && !isSaving
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>

            {/* Approve button - only show if not already approved */}
            {!approvalState?.approvalValid && (
              <button
                onClick={() => setIsApprovalDialogOpen(true)}
                disabled={!canApprove}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  canApprove
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-slate-700 text-slate-400 cursor-not-allowed"
                }`}
                title={
                  !canApprove
                    ? `Resolve ${unresolvedCount} flag(s) to enable approval`
                    : "Approve this cleanup for export"
                }
              >
                <Shield size={18} />
                Approve
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {saveError && (
          <div className="px-6 py-2 bg-red-500/20 border-t border-red-500/30">
            <p className="text-red-300 text-sm flex items-center gap-2">
              <AlertCircle size={14} />
              {saveError}
            </p>
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Pane labels */}
          <div className="flex border-b border-white/10 text-sm">
            <div className="flex-1 px-4 py-2 bg-slate-800/50 text-slate-400 border-r border-white/10 flex items-center gap-2">
              <FileText size={14} />
              Original (Read-only)
            </div>
            <div className="flex-1 px-4 py-2 bg-slate-800/50 text-blue-300 flex items-center gap-2">
              <Layers size={14} />
              Cleaned (Editable)
              {hasChanges && (
                <span className="ml-auto text-xs bg-blue-500/20 px-2 py-0.5 rounded">
                  Modified
                </span>
              )}
            </div>
          </div>

          {/* Merge editor */}
          <div className="flex-1 overflow-hidden">
            <CleanupMergeEditor
              originalText={original.content}
              cleanedText={revision.content}
              onCleanedChange={handleCleanedChange}
              className="h-full"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 liquid-glass border-l border-white/10 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab("flags")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "flags"
                  ? "bg-white/10 text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Flag size={16} />
              Flags
              {unresolvedCount > 0 && (
                <span className="bg-yellow-500 text-slate-900 text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {unresolvedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("chapters")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "chapters"
                  ? "bg-white/10 text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Layers size={16} />
              Chapters
              <span className="bg-slate-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {chapters.length}
              </span>
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === "flags" ? (
              <CleanupFlagsPanel
                bookId={bookId}
                flags={unresolvedFlags}
                canApprove={canApprove}
              />
            ) : (
              <div className="space-y-2">
                {chapters.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">
                    No chapters detected
                  </p>
                ) : (
                  chapters.map((chapter) => (
                    <div
                      key={chapter._id}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-white text-sm truncate">
                            {chapter.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {chapter.type === "chapter"
                              ? `Chapter ${chapter.chapterNumber}`
                              : chapter.type.charAt(0).toUpperCase() + chapter.type.slice(1)}
                          </p>
                        </div>
                        {!chapter.isUserConfirmed && (
                          <span className="shrink-0 text-xs bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded">
                            Unconfirmed
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Approval hint */}
          <div className="p-4 border-t border-white/10">
            <div
              className={`p-3 rounded-lg text-sm ${
                approvalState?.approvalValid
                  ? "bg-green-500/10 border border-green-500/30"
                  : canApprove
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-yellow-500/10 border border-yellow-500/30"
              }`}
            >
              <p
                className={`font-medium ${
                  approvalState?.approvalValid || canApprove
                    ? "text-green-300"
                    : "text-yellow-300"
                }`}
              >
                {approvalState?.approvalValid
                  ? "Approved for Export"
                  : canApprove
                    ? "Ready for Approval"
                    : "Approval Blocked"}
              </p>
              <p className="text-slate-400 mt-1">
                {approvalState?.approvalValid
                  ? "This cleanup is approved. Downstream template and export actions are unlocked."
                  : canApprove
                    ? "All flags resolved. You can approve this cleanup."
                    : `Resolve ${unresolvedCount} flag${unresolvedCount !== 1 ? "s" : ""} to enable approval.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Checklist Dialog */}
      <ApprovalChecklistDialog
        isOpen={isApprovalDialogOpen}
        onClose={() => {
          setIsApprovalDialogOpen(false);
          setApprovalError(null);
        }}
        onApprove={handleApprove}
        unresolvedFlagCount={unresolvedCount}
        isApproving={isApproving}
      />

      {/* Post-Approval Edit Prompt Modal */}
      {showPostApprovalPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPostApprovalPrompt(false)}
          />
          <div className="relative w-full max-w-md liquid-glass-strong rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <AlertCircle size={20} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Approval Status
                </h3>
                <p className="text-sm text-slate-400">
                  This book is currently approved for export
                </p>
              </div>
            </div>

            <p className="text-slate-300 mb-6">
              You&apos;ve edited the cleaned text after approval. Choose how to
              handle the approval status for this new revision:
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handlePostApprovalChoice(true)}
                className="w-full p-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-400" />
                  <div>
                    <p className="font-medium text-green-300">
                      Keep Approval
                    </p>
                    <p className="text-sm text-green-200/70">
                      New revision is approved; export remains unlocked
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handlePostApprovalChoice(false)}
                className="w-full p-4 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield size={20} className="text-yellow-400" />
                  <div>
                    <p className="font-medium text-yellow-300">
                      Revoke Approval
                    </p>
                    <p className="text-sm text-yellow-200/70">
                      New revision requires re-approval before export
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowPostApprovalPrompt(false)}
              className="w-full mt-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
