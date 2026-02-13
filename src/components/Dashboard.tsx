import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

import {
  Library,
  Briefcase,
  FileText,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { LibraryPage } from "./LibraryPage";
import { JobsPage } from "./JobsPage";
import { TemplatesPage } from "./TemplatesPage";
import { ImportModal } from "./ImportModal";
import { CleanupReviewPage } from "./CleanupReviewPage";
import { IngestErrorLogsPage } from "./IngestErrorLogsPage";
import { SignOutButton } from "../SignOutButton";

type Page = "library" | "jobs" | "templates" | "error-logs" | "cleanup-review";

export function Dashboard() {
  const [currentPage, setCurrentPage] = useState<Page>("library");
  const [showImportModal, setShowImportModal] = useState(false);
  const [reviewBookId, setReviewBookId] = useState<Id<"books"> | null>(null);
  const loggedInUser = useQuery(api.auth.loggedInUser);

  const handleEnterReview = (bookId: Id<"books">) => {
    setReviewBookId(bookId);
    setCurrentPage("cleanup-review");
  };

  const handleExitReview = () => {
    setReviewBookId(null);
    setCurrentPage("library");
  };

  const navItems = [
    { id: "library" as const, label: "Library", icon: Library },
    { id: "jobs" as const, label: "Jobs", icon: Briefcase },
    { id: "templates" as const, label: "Templates", icon: FileText },
    { id: "error-logs" as const, label: "Error Logs", icon: TriangleAlert },
  ];

  const pageTitle = {
    library: "Library Intake",
    jobs: "Job Queue",
    templates: "PDF Templates",
    "error-logs": "Ingest Error Logs",
    "cleanup-review": "Cleanup Review",
  }[currentPage];

  const showPrimaryButton = currentPage === "library";

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Sidebar */}
      <div className="w-64 p-4 flex-shrink-0">
        <div className="h-full auth-card p-6 flex flex-col">
          {/* Logo */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-300" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Book<span className="text-indigo-400">Zang</span>
              </h1>
            </div>
            <p className="text-sm text-white/70 font-normal">
              Welcome back, {loggedInUser?.email?.split("@")[0] || "Guest"}
            </p>
          </div>

          {/* Navigation */}
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-500/30 to-purple-500/20 text-white border border-white/10"
                      : "text-white/80 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon
                    size={20}
                    className={`transition-colors ${
                      isActive
                        ? "text-indigo-300"
                        : "text-white/70 group-hover:text-white/80"
                    }`}
                  />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sign Out */}
          <div className="pt-6 border-t border-white/10">
            <SignOutButton />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 min-w-0">
        <div className="h-full auth-card flex flex-col overflow-hidden">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
            <div>
              <h2 className="text-xl font-semibold text-white">{pageTitle}</h2>
              <p className="text-sm text-white/70 mt-0.5">
                {currentPage === "library" &&
                  "Import and manage your book collection"}
                {currentPage === "jobs" &&
                  "Track import, cleaning, and export progress"}
                {currentPage === "templates" &&
                  "Choose formatting for PDF generation"}
                {currentPage === "error-logs" &&
                  "Review daemon-reported failures and warning events"}
              </p>
            </div>
            {showPrimaryButton && (
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
              >
                <Plus size={18} />
                Import Book
              </button>
            )}
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-auto p-8">
            {currentPage === "library" && (
              <LibraryPage onEnterReview={handleEnterReview} />
            )}
            {currentPage === "jobs" && <JobsPage />}
            {currentPage === "templates" && <TemplatesPage />}
            {currentPage === "error-logs" && <IngestErrorLogsPage />}
            {currentPage === "cleanup-review" && reviewBookId && (
              <CleanupReviewPage
                bookId={reviewBookId}
                onExit={handleExitReview}
              />
            )}
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}
