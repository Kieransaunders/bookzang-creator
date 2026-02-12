import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import { Search, Book, User, Calendar, FileText, Download } from "lucide-react";

export function LibraryPage() {
  const [search, setSearch] = useState("");
  const books = useQuery(api.books.list, { search: search || undefined });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "discovered":
        return "bg-slate-500/20 text-slate-200 border-slate-500/30";
      case "importing":
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
      case "imported":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "failed":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "cleaned":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "ready":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
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
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
          size={20}
        />
        <input
          type="text"
          placeholder="Search books by title or author..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      {/* Books Grid */}
      {books.length === 0 ? (
        <div className="text-center py-12">
          <Book className="mx-auto mb-4 text-slate-400" size={48} />
          <h3 className="text-xl font-semibold text-white mb-2">
            No books yet
          </h3>
          <p className="text-slate-400">
            Import your first book from Project Gutenberg or upload a text file
            to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => (
            <div
              key={book._id}
              id={`book-${book._id}`}
              className="p-4 rounded-lg liquid-glass hover:border-white/30 transition-all cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-white line-clamp-2 flex-1">
                    {book.title}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(book.status)} ml-2 flex-shrink-0`}
                  >
                    {getStatusLabel(book.status)}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <User size={14} />
                    <span className="line-clamp-1">{book.author}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getSourceIcon(book)}
                    <span className="line-clamp-1">{getSourceText(book)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>
                      {new Date(book.importedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
