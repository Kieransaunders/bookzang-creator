/**
 * TemplatesPage - Template selection with approval-based downstream unlock
 * 
 * Per CONTEXT.md requirements:
 * - Approval unlocks downstream template/export actions for that specific book
 * - Unapproved titles stay blocked with clear messaging
 * 
 * This page shows which books are ready for template application and
 * provides clear guidance for unlocking blocked titles.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

import {
  FileText,
  Check,
  Type,
  AlignVerticalSpaceAround,
  Ruler,
  Shield,
  Lock,
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/**
 * Book readiness status for template/export actions
 */
interface BookReadiness {
  _id: string;
  _creationTime: number;
  title: string;
  author: string;
  status: "discovered" | "importing" | "imported" | "failed" | "cleaned" | "ready";
  templateId?: string;
}

export function TemplatesPage() {
  const templates = useQuery(api.templates.list);
  const readyBooks = useQuery(api.books.listReadyBooks, {});
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [showBlockedBooks, setShowBlockedBooks] = useState(false);

  if (templates === undefined || readyBooks === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 rounded-xl border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
      </div>
    );
  }

  const hasReadyBooks = readyBooks.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-2xl font-semibold text-white mb-3">
          Choose a Template
        </h3>
        <p className="text-white/40">
          Select a template to apply to your approved books for PDF generation.
          Books must have approved cleanup to unlock template and export
          actions.
        </p>
      </div>

      {/* Readiness Status Banner */}
      <div
        className={`p-4 rounded-xl border ${
          hasReadyBooks
            ? "bg-green-500/10 border-green-500/30"
            : "bg-yellow-500/10 border-yellow-500/30"
        }`}
      >
        <div className="flex items-center gap-3">
          {hasReadyBooks ? (
            <>
              <Shield size={24} className="text-green-400" />
              <div className="flex-1">
                <p className="font-medium text-green-300">
                  {readyBooks.length} book
                  {readyBooks.length !== 1 ? "s" : ""} ready for export
                </p>
                <p className="text-sm text-green-200/70">
                  These titles have approved cleanup and can proceed to template
                  selection and PDF export.
                </p>
              </div>
            </>
          ) : (
            <>
              <Lock size={24} className="text-yellow-400" />
              <div className="flex-1">
                <p className="font-medium text-yellow-300">
                  No books ready for export
                </p>
                <p className="text-sm text-yellow-200/70">
                  Books must complete cleanup and receive editorial approval
                  before template/export actions are unlocked. Run cleanup from
                  the Library and approve the results in the review page.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ready Books Selection */}
      {hasReadyBooks && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-300">
            Select a book to apply template
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {readyBooks.map((book) => (
              <button
                key={book._id}
                onClick={() => setSelectedBookId(book._id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedBookId === book._id
                    ? "bg-green-500/10 border-green-500/50"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selectedBookId === book._id
                        ? "bg-green-500/20"
                        : "bg-white/10"
                    }`}
                  >
                    {selectedBookId === book._id ? (
                      <Check size={16} className="text-green-400" />
                    ) : (
                      <BookOpen size={16} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">
                      {book.title}
                    </p>
                    <p className="text-sm text-slate-400 truncate">
                      {book.author}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Templates Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-medium text-white">Available Templates</h4>
          {!hasReadyBooks && (
            <span className="text-sm text-yellow-400 flex items-center gap-2">
              <Lock size={14} />
              Templates locked until approval
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, index) => {
            const isLocked = !hasReadyBooks || !selectedBookId;

            return (
              <div
                key={template._id}
                className={`group p-6 rounded-xl border transition-all duration-200 ${
                  isLocked
                    ? "bg-white/[0.02] border-white/5 opacity-60"
                    : "bg-white/5 border-white/10 hover:border-indigo-500/30 hover:bg-white/[0.07] cursor-pointer"
                }`}
              >
                <div className="space-y-5 flex flex-col h-full">
                  {/* Preview Card */}
                  <div
                    className={`h-36 rounded-xl flex items-center justify-center border transition-colors ${
                      isLocked
                        ? "bg-white/[0.02] border-white/5"
                        : "bg-gradient-to-br from-white/5 to-white/[0.02] border-white/5 group-hover:border-indigo-500/20"
                    }`}
                  >
                    <div className="text-center px-6">
                      <div
                        className="text-white/90 font-serif mb-3 leading-tight"
                        style={{
                          fontSize: `${template.settings.fontSize * 1.8}px`,
                          lineHeight: template.settings.lineHeight,
                        }}
                      >
                        {template.preview}
                      </div>
                      <div className="flex items-center justify-center gap-3 text-[10px] text-white/30 uppercase tracking-wider">
                        <span>{template.settings.fontSize}pt</span>
                        <span>•</span>
                        <span>{template.settings.lineHeight}x line</span>
                      </div>
                    </div>
                  </div>

                  {/* Template Info */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white text-lg">
                        {template.name}
                      </h4>
                      {index === 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/50 leading-relaxed line-clamp-2 min-h-[2.5rem]">
                      {template.description}
                    </p>
                  </div>

                  {/* Settings */}
                  <div className="flex items-center gap-4 text-xs text-white/40 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Type size={12} />
                      <span>{template.settings.fontSize}pt</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlignVerticalSpaceAround size={12} />
                      <span>{template.settings.lineHeight}x</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Ruler size={12} />
                      <span>{template.settings.margins.top}" margins</span>
                    </div>
                  </div>

                  {/* Select Button */}
                  <div className="flex-1"></div>
                  {isLocked ? (
                    <button
                      disabled
                      className="w-full py-3 px-4 bg-slate-800 text-slate-500 font-medium rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock size={16} />
                      {!hasReadyBooks
                        ? "Approve cleanup to unlock"
                        : "Select a book to continue"}
                    </button>
                  ) : (
                    <button className="w-full py-3 px-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-medium rounded-xl transition-all duration-200 border border-indigo-500/30 hover:border-indigo-500/50">
                      Use Template
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Blocked Books Section (collapsible) */}
      <div className="border-t border-white/10 pt-6">
        <button
          onClick={() => setShowBlockedBooks(!showBlockedBooks)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          {showBlockedBooks ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span className="text-sm">
            Why are my books locked? (Approval requirements)
          </span>
        </button>

        {showBlockedBooks && (
          <div className="mt-4 p-4 bg-white/5 rounded-xl space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-blue-400">1</span>
              </div>
              <div>
                <p className="font-medium text-white">Import and Cleanup</p>
                <p className="text-sm text-slate-400">
                  Import books from Project Gutenberg or upload files, then run
                  the cleanup process to remove boilerplate and normalize text.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-blue-400">2</span>
              </div>
              <div>
                <p className="font-medium text-white">Review and Resolve</p>
                <p className="text-sm text-slate-400">
                  Open the review page to compare original vs cleaned text. Edit
                  as needed and resolve all flags (low-confidence cleanup
                  items).
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-green-400">3</span>
              </div>
              <div>
                <p className="font-medium text-white">Approve</p>
                <p className="text-sm text-slate-400">
                  Complete the approval checklist to confirm quality. Once
                  approved, template and export actions unlock for that title.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-200/80">
                <strong className="text-yellow-300">Note:</strong> If you edit
                the cleaned text after approval, you&apos;ll be prompted to either
                keep the approval (minor fixes) or revoke it for re-review
                (substantive changes).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
