import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DiscoveryCandidatesPanel } from "./DiscoveryCandidatesPanel";

import { Search, Book, User, Calendar, FileText, Download, Edit3, Sparkles, Play, Loader2 } from "lucide-react";

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
  const [startingCleanup, setStartingCleanup] = useState<Id<"books"> | null>(null);
  const debouncedSearch = useDebounce(inputValue, 300);
  const books = useQuery(api.books.list, { search: debouncedSearch || undefined });
  const startCleanup = useMutation(api.cleanup.startCleanup);

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
          {books.map((book) => (
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

                {/* Action buttons based on status */}
                <div className="mt-2 space-y-2">
                  {/* Start Cleanup button */}
                  {book.status === "imported" && (
                    <button
                      onClick={async () => {
                        setStartingCleanup(book._id);
                        try {
                          await startCleanup({ bookId: book._id });
                        } catch (err) {
                          console.error("Failed to start cleanup:", err);
                          alert("Failed to start cleanup: " + (err instanceof Error ? err.message : String(err)));
                        } finally {
                          setStartingCleanup(null);
                        }
                      }}
                      disabled={startingCleanup === book._id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-300 border border-indigo-500/30 rounded-lg transition-all duration-200 text-sm font-medium group-hover:border-indigo-500/50"
                    >
                      {startingCleanup === book._id ? (
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
                      <Edit3 size={14} />
                      {book.status === "ready" ? "Review (Approved)" : "Review Cleanup"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Discovery Candidates - moved below books */}
      <DiscoveryCandidatesPanel />
    </div>
  );
}
