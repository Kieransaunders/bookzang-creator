import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import { Library, Briefcase, FileText, Plus } from "lucide-react";
import { LibraryPage } from "./LibraryPage";
import { JobsPage } from "./JobsPage";
import { TemplatesPage } from "./TemplatesPage";
import { ImportModal } from "./ImportModal";
import { SignOutButton } from "../SignOutButton";

type Page = "library" | "jobs" | "templates";

export function Dashboard() {
  const [currentPage, setCurrentPage] = useState<Page>("library");
  const [showImportModal, setShowImportModal] = useState(false);
  const loggedInUser = useQuery(api.auth.loggedInUser);

  const navItems = [
    { id: "library" as const, label: "Library", icon: Library },
    { id: "jobs" as const, label: "Jobs", icon: Briefcase },
    { id: "templates" as const, label: "Templates", icon: FileText },
  ];

  const pageTitle = {
    library: "Library Intake",
    jobs: "Jobs",
    templates: "Templates",
  }[currentPage];

  const showPrimaryButton = currentPage === "library";

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 p-4">
        <div className="h-full rounded-2xl liquid-glass p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">BookZang</h1>
            <p className="text-sm text-slate-300">
              Welcome, {loggedInUser?.email?.split("@")[0]}
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={20} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-8">
            <SignOutButton />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4">
        <div className="h-full rounded-2xl liquid-glass">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-2xl font-semibold text-white">{pageTitle}</h2>
            {showPrimaryButton && (
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <Plus size={20} />
                Upload File
              </button>
            )}
          </div>

          {/* Page Content */}
          <div className="p-6 h-[calc(100%-88px)] overflow-auto">
            {currentPage === "library" && <LibraryPage />}
            {currentPage === "jobs" && <JobsPage />}
            {currentPage === "templates" && <TemplatesPage />}
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
