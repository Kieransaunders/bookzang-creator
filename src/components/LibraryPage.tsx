import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DiscoveryCandidatesPanel } from "./DiscoveryCandidatesPanel";
import { toast } from "sonner";

import { Search, Book, User, Calendar, FileText, Download, Edit3, Play, Loader2, Sparkles, CheckCircle2 } from "lucide-react";

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
  const [startingCleanupFor, setStartingCleanupFor] = useState<Id<"books"> | null>(null);
  const [activeCleanups, setActiveCleanups] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebounce(inputValue, 300);
  const books = useQuery(api.books.list, { search: debouncedSearch || undefined });
  const startCleanup = useMutation(api.cleanup.startCleanup);

  // Poll for cleanup status on books that are being cleaned
  const cleanupStatuses = useQuery(
    api.cleanup.getCleanupStatusesForBooks,
    activeCleanups.size > 0 
      ? { bookIds: Array.from(activeCleanups).map(id => id as Id<"books">) }
      : "skip"
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
          const book = books.find(b => b._id === status.bookId);
          toast.success(`"${book?.title || 'Book'}" cleanup complete!`, {
            description: "Ready for review.",
            action: {
              label: "Review",
              onClick: () => onEnterReview?.(status.bookId as Id<"books">),
            },
          });
        } else if (status.status === "failed") {
          const book = books.find(b => b._id === status.bookId);
          toast.error(`"${book?.title || 'Book'}" cleanup failed`, {
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

  const getSourceText = (book: any) => {
    if (book.fileId) {
      return `Uploaded: ${book.fileName || "Unknown file"}`;
    }
    return `Gutenberg #${book.gutenbergId}`;
  };

  const handleStartCleanup = async (bookId: Id<"books">, bookTitle: string) => {
    setStartingCleanupFor(bookId);
    const toastId = toast.loading(`Starting cleanup for "${bookTitle}"...`);
    
    try {
      await startCleanup({ bookId });
      setActiveCleanups(prev => new Set(prev).add(bookId));
      toast.success("Cleanup started!", {
        id: toastId,
        description: "Processing in background. You'll be notified when complete.",
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

  const getCleanupProgress = (bookId: string) => {
    const status = cleanupStatuses?.find(s => s?.bookId === bookId);
    if (!status || status.status === "completed" || status.status === "failed") return null;
    return {
      stage: status.stage,
      progress: status.progress,
      label: getStageLabel(status.stage),
    };
  };

  const getStageLabel = (stage?: string) => {
    switch (stage) {
      case "queued": return "Queued";
      case "loading_original": return "Loading...";
      case "boilerplate_removal": return "Removing boilerplate...";
      case "paragraph_unwrap": return "Unwrapping paragraphs...";
      case "chapter_detection": return "Detecting chapters...";
      case "punctuation_normalization": return "Normalizing punctuation...";
      case "completed": return "Complete";
      case "failed": return "Failed";
      default: return "Processing...";
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
            Import your first book from Project Gutenberg or upload a text file to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {books.map((book) => {
            const cleanupProgress = getCleanupProgress(book._id);
            const isCleaning = activeCleanups.has(book._id) || cleanupProgress !== null;
            
            return (
              <div
                key={book._id}
                id={`book-${book._id}`}
                className="group p-5 rounded-xl bg-slate-800/40 border border-white/5 hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all duration-200"
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
                      <span className="line-clamp-1">{book.author || "Unknown author"}</span>
                    </div>

                    <div className="flex items-center gap-2.5 text-white/80">
                      {getSourceIcon(book)}
                      <span className="line-clamp-1 text-xs">{getSourceText(book)}</span>
                    </div>

                    <div className="flex items-center gap-2.5 text-white/70">
                      <Calendar size={14} className="text-white/50" />
                      <span className="text-xs">
                        {new Date(book.importedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Cleanup Progress */}
                  {isCleaning && cleanupProgress && (
                    <div className="mt-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 size={14} className="animate-spin text-indigo-400" />
                        <span className="text-sm text-indigo-300">{cleanupProgress.label}</span>
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
                        disabled={startingCleanupFor === book._id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-300 border border-indigo-500/30 rounded-lg transition-all duration-200 text-sm font-medium group-hover:border-indigo-500/50"
                      >
                        {startingCleanupFor === book._id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Starting...
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
                    {(book.status === "cleaned" || book.status === "ready") && onEnterReview && (
                      <button
                        onClick={() => onEnterReview(book._id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg transition-all duration-200 text-sm font-medium group-hover:border-indigo-500/50"
                      >
                        {book.status === "ready" ? (
                          <>
                            <CheckCircle2 size={14} className="text-emerald-400" />
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Discovery Candidates - moved below books */}
      <DiscoveryCandidatesPanel />
    </div>
  );
}
