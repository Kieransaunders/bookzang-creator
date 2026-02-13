import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DiscoveryCandidatesPanel } from "./DiscoveryCandidatesPanel";
import { CopyrightStatusBadge } from "./CopyrightStatusBadge";
import { toast } from "sonner";

import {
  Search,
  Book,
  User,
  Calendar,
  FileText,
  Download,
  Edit3,
  Play,
  Loader2,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

interface LibraryPageProps {
  onEnterReview?: (bookId: Id<"books">) => void;
}

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function LibraryPage({ onEnterReview }: LibraryPageProps) {
  const [inputValue, setInputValue] = useState("");
  const [startingCleanupFor, setStartingCleanupFor] =
    useState<Id<"books"> | null>(null);
  const [activeCleanups, setActiveCleanups] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebounce(inputValue, 300);
  const books = useQuery(api.books.list, {
    search: debouncedSearch || undefined,
  });
  const startCleanup = useMutation(api.cleanup.startCleanup);
  const deleteBook = useMutation(api.books.deleteBook);
  const deleteAllBooks = useMutation(api.books.deleteAllBooks);
  const [deletingBook, setDeletingBook] = useState<Id<"books"> | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] =
    useState<Id<"books"> | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Poll for cleanup status on books that are being cleaned
  const cleanupStatuses = useQuery(
    api.cleanup.getCleanupStatusesForBooks,
    activeCleanups.size > 0
      ? { bookIds: Array.from(activeCleanups).map((id) => id as Id<"books">) }
      : "skip",
  );

  // Update active cleanups when books change status
  useEffect(() => {
    if (!books || !cleanupStatuses) return;

    const completed = new Set(activeCleanups);

    cleanupStatuses.forEach((status) => {
      if (status?.status === "completed" || status?.status === "failed") {
        completed.delete(status.bookId);

        // Show toast notification
        if (status.status === "completed") {
          const book = books.find((b) => b._id === status.bookId);
          toast.success(`"${book?.title || "Book"}" cleanup complete!`, {
            description: "Ready for review.",
            action: {
              label: "Review",
              onClick: () => onEnterReview?.(status.bookId as Id<"books">),
            },
          });
        } else if (status.status === "failed") {
          const book = books.find((b) => b._id === status.bookId);
          toast.error(`"${book?.title || "Book"}" cleanup failed`, {
            description: status.error || "Check Jobs page for details.",
          });
        }
      }
    });

    if (completed.size !== activeCleanups.size) {
      setActiveCleanups(completed);
    }
  }, [cleanupStatuses, books, activeCleanups, onEnterReview]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "discovered":
        return "bg-slate-500/15 text-slate-300 border-slate-500/25";
      case "importing":
        return "bg-indigo-500/15 text-indigo-300 border-indigo-500/25";
      case "imported":
        return "bg-blue-500/15 text-blue-300 border-blue-500/25";
      case "failed":
        return "bg-rose-500/15 text-rose-300 border-rose-500/25";
      case "cleaned":
        return "bg-amber-500/15 text-amber-300 border-amber-500/25";
      case "ready":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
      default:
        return "bg-gray-500/15 text-gray-300 border-gray-500/25";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "discovered":
        return "Discovered";
      case "importing":
        return "Importing";
      case "imported":
        return "Imported";
      case "failed":
        return "Failed";
      case "cleaned":
        return "Cleaned";
      case "ready":
        return "Ready";
      default:
        return status;
    }
  };

  const getSourceIcon = (book: any) => {
    if (book.fileId) {
      return <FileText size={14} className="text-purple-400" />;
    }
    return <Download size={14} className="text-blue-400" />;
  };

  const getSourceDisplay = (book: any) => {
    if (book.fileId) {
      return (
        <span className="line-clamp-1 text-xs">
          Uploaded: {book.fileName || "Unknown file"}
        </span>
      );
    }
    if (book.gutenbergId) {
      return (
        <a
          href={`https://www.gutenberg.org/ebooks/${book.gutenbergId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Gutenberg #{book.gutenbergId}
          <ExternalLink size={10} />
        </a>
      );
    }
    return <span className="line-clamp-1 text-xs">Unknown source</span>;
  };

  const handleStartCleanup = async (bookId: Id<"books">, bookTitle: string) => {
    setStartingCleanupFor(bookId);
    const toastId = toast.loading(`Starting cleanup for "${bookTitle}"...`);

    try {
      await startCleanup({ bookId });
      setActiveCleanups((prev) => new Set(prev).add(bookId));
      toast.success("Cleanup started!", {
        id: toastId,
        description:
          "Processing in background. You'll be notified when complete.",
      });
    } catch (err) {
      console.error("Failed to start cleanup:", err);
      toast.error("Failed to start cleanup", {
        id: toastId,
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setStartingCleanupFor(null);
    }
  };

  const handleDeleteBook = async (bookId: Id<"books">, bookTitle: string) => {
    setDeletingBook(bookId);
    const toastId = toast.loading(`Deleting "${bookTitle}"...`);

    try {
      const result = await deleteBook({ bookId });
      toast.success(`"${bookTitle}" deleted`, {
        id: toastId,
        description: `Removed ${result.deleted.revisions} revisions, ${result.deleted.chapters} chapters, ${result.deleted.flags} flags`,
      });
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete book:", err);
      toast.error("Failed to delete book", {
        id: toastId,
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDeletingBook(null);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    const toastId = toast.loading("Deleting all books...");

    try {
      const result = await deleteAllBooks({});
      toast.success("All books deleted", {
        id: toastId,
        description: `Removed ${result.deleted.books} books, ${result.deleted.revisions} revisions, ${result.deleted.chapters} chapters`,
      });
      setShowDeleteAllConfirm(false);
    } catch (err) {
      console.error("Failed to delete all books:", err);
      toast.error("Failed to delete all books", {
        id: toastId,
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const getCleanupProgress = (bookId: string) => {
    const status = cleanupStatuses?.find((s) => s?.bookId === bookId);
    if (!status || status.status === "completed" || status.status === "failed")
      return null;
    return {
      stage: status.stage,
      progress: status.progress,
      label: getStageLabel(status.stage),
    };
  };

  const getStageLabel = (stage?: string) => {
    switch (stage) {
      case "queued":
        return "Queued";
      case "loading_original":
        return "Loading...";
      case "boilerplate_removal":
        return "Removing boilerplate...";
      case "paragraph_unwrap":
        return "Unwrapping paragraphs...";
      case "chapter_detection":
        return "Detecting chapters...";
      case "punctuation_normalization":
        return "Normalizing punctuation...";
      case "completed":
        return "Complete";
      case "failed":
        return "Failed";
      default:
        return "Processing...";
    }
  };

  if (books === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-xl">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60"
          size={20}
        />
        <input
          type="text"
          placeholder="Search books by title or author..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-slate-800/40 border border-white/5 rounded-xl text-white placeholder:text-white/60 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
        />
      </div>

      {/* Books Grid */}
      {books.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center">
            <Book className="text-white/50" size={40} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No books yet
          </h3>
          <p className="text-white/70 max-w-md mx-auto">
            Import your first book from Project Gutenberg or upload a text file
            to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {books.map((book) => {
            const cleanupProgress = getCleanupProgress(book._id);
            const isCleaning =
              activeCleanups.has(book._id) || cleanupProgress !== null;
            const isCopyrightBlocked = book.copyrightStatus === "blocked";
            const isCopyrightChecking = book.copyrightStatus === "checking";
            const disableCleanup = isCopyrightBlocked || isCopyrightChecking;

            return (
              <div
                key={book._id}
                id={`book-${book._id}`}
                className="group relative p-5 rounded-xl bg-slate-800/40 border border-white/5 hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all duration-200"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-white line-clamp-2 flex-1 text-base leading-snug">
                      {book.title}
                    </h3>
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(book.status)} flex-shrink-0`}
                    >
                      {getStatusLabel(book.status)}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-2.5 text-white/80">
                      <User size={14} className="text-white/60" />
                      <span className="line-clamp-1">
                        {book.author || "Unknown author"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 text-white/80">
                      {getSourceIcon(book)}
                      {getSourceDisplay(book)}
                    </div>

                    <div className="flex items-center gap-2.5 text-white/70">
                      <Calendar size={14} className="text-white/50" />
                      <span className="text-xs">
                        {new Date(book.importedAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/35 px-2.5 py-2">
                      <span className="text-[11px] uppercase tracking-wide text-white/60">
                        Copyright
                      </span>
                      <CopyrightStatusBadge status={book.copyrightStatus} />
                    </div>

                    <div className="text-xs text-white/65">
                      {book.copyrightPublicationYear
                        ? `Publication year: ${book.copyrightPublicationYear}`
                        : "Publication year: not detected"}
                    </div>

                    {isCopyrightBlocked && book.copyrightReason && (
                      <p className="text-xs text-rose-300/90 line-clamp-2">
                        {book.copyrightReason}
                      </p>
                    )}
                  </div>

                  {/* Cleanup Progress */}
                  {isCleaning && cleanupProgress && (
                    <div className="mt-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2
                          size={14}
                          className="animate-spin text-indigo-400"
                        />
                        <span className="text-sm text-indigo-300">
                          {cleanupProgress.label}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${cleanupProgress.progress}%` }}
                        />
                      </div>
                      <div className="text-right text-xs text-indigo-400/70 mt-1">
                        {cleanupProgress.progress}%
                      </div>
                    </div>
                  )}

                  {/* Action buttons based on status */}
                  <div className="mt-2 space-y-2">
                    {/* Start Cleanup button */}
                    {book.status === "imported" && !isCleaning && (
                      <button
                        onClick={() => handleStartCleanup(book._id, book.title)}
                        disabled={
                          startingCleanupFor === book._id || disableCleanup
                        }
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed border rounded-lg transition-all duration-200 text-sm font-medium ${
                          isCopyrightBlocked
                            ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                            : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/30 group-hover:border-indigo-500/50"
                        }`}
                      >
                        {startingCleanupFor === book._id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Starting...
                          </>
                        ) : isCopyrightBlocked ? (
                          <>
                            <AlertTriangle size={14} />
                            Blocked: Copyrighted
                          </>
                        ) : isCopyrightChecking ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Waiting for copyright scan
                          </>
                        ) : (
                          <>
                            <Play size={14} />
                            Start Cleanup
                          </>
                        )}
                      </button>
                    )}

                    {/* Review button */}
                    {(book.status === "cleaned" || book.status === "ready") &&
                      onEnterReview && (
                        <button
                          onClick={() => onEnterReview(book._id)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg transition-all duration-200 text-sm font-medium group-hover:border-indigo-500/50"
                        >
                          {book.status === "ready" ? (
                            <>
                              <CheckCircle2
                                size={14}
                                className="text-emerald-400"
                              />
                              Review (Approved)
                            </>
                          ) : (
                            <>
                              <Edit3 size={14} />
                              Review Cleanup
                            </>
                          )}
                        </button>
                      )}

                    {/* Processing state (when status hasn't updated yet but we know it's running) */}
                    {isCleaning && !cleanupProgress && (
                      <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/30 text-slate-400 border border-slate-600/30 rounded-lg text-sm">
                        <Loader2 size={14} className="animate-spin" />
                        Processing...
                      </div>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={() => setShowDeleteConfirm(book._id)}
                      disabled={deletingBook === book._id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-300 border border-rose-500/30 rounded-lg transition-all duration-200 text-sm font-medium opacity-0 group-hover:opacity-100"
                    >
                      {deletingBook === book._id ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} />
                          Delete Book
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm === book._id && (
                  <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-4 z-10">
                    <AlertTriangle className="text-rose-400 mb-3" size={32} />
                    <h4 className="font-semibold text-white text-center mb-1">
                      Delete Book?
                    </h4>
                    <p className="text-sm text-white/70 text-center mb-4">
                      This will permanently remove "{book.title}" and all
                      associated cleanup data.
                    </p>
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteBook(book._id, book.title)}
                        disabled={deletingBook === book._id}
                        className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all"
                      >
                        {deletingBook === book._id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Discovery Candidates - moved below books */}
      <DiscoveryCandidatesPanel />

      {/* Delete All Books Section */}
      {books && books.length > 0 && (
        <div className="pt-8 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white/80">
                Danger Zone
              </h3>
              <p className="text-xs text-white/50 mt-1">
                Permanently delete all {books.length} books and associated data
              </p>
            </div>
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg transition-all duration-200 text-sm font-medium"
            >
              Delete All Books
            </button>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-500/30 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-rose-400" size={28} />
              <h3 className="text-xl font-semibold text-white">
                Delete All Books?
              </h3>
            </div>
            <p className="text-sm text-white/70 mb-6">
              This will permanently delete <strong>all {books?.length} books</strong> and their associated cleanup data, jobs, and copyright checks. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={isDeletingAll}
                className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
                className="flex-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all"
              >
                {isDeletingAll ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  "Delete Everything"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
