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

import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  FileText,
  Layers,
  Flag,
  Clock,
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
  const saveRevision = useMutation(api.cleanup.saveCleanedRevision);

  // Local state for editing
  const [editedText, setEditedText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"chapters" | "flags">("flags");

  // Initialize edited text when review data loads
  const handleCleanedChange = useCallback((text: string) => {
    setEditedText(text);
    setSaveError(null);
  }, []);

  // Handle save
  const handleSave = async () => {
    if (!reviewData?.revision) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await saveRevision({
        bookId,
        content: editedText,
        parentRevisionId: reviewData.revision._id,
      });
      setLastSaved(new Date());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save revision");
    } finally {
      setIsSaving(false);
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
              {unresolvedCount > 0 ? (
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
                canApprove
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-yellow-500/10 border border-yellow-500/30"
              }`}
            >
              <p
                className={`font-medium ${
                  canApprove ? "text-green-300" : "text-yellow-300"
                }`}
              >
                {canApprove ? "Ready for Approval" : "Approval Blocked"}
              </p>
              <p className="text-slate-400 mt-1">
                {canApprove
                  ? "All flags resolved. You can approve this cleanup."
                  : `Resolve ${unresolvedCount} flag${unresolvedCount !== 1 ? "s" : ""} to enable approval.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
