import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Layers,
} from "lucide-react";
import { JobDetailsDrawer } from "./JobDetailsDrawer";
import { Id } from "../../convex/_generated/dataModel";
import {
  getJobStageLabel,
  getJobStatusBadgeClass,
  getJobStatusLabel,
} from "../lib/jobStatus";

export function JobsPage() {
  const groups = useQuery(api.jobs.listGroupedSummary);
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "queued":
        return <Clock className="text-yellow-400" size={16} />;
      case "running":
        return <Play className="text-blue-400" size={16} />;
      case "completed":
        return <CheckCircle className="text-green-400" size={16} />;
      case "failed":
        return <XCircle className="text-red-400" size={16} />;
      default:
        return <Clock className="text-gray-400" size={16} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "import":
        return "bg-purple-500/20 text-purple-300";
      case "clean":
        return "bg-orange-500/20 text-orange-300";
      case "export":
        return "bg-cyan-500/20 text-cyan-300";
      default:
        return "bg-gray-500/20 text-gray-300";
    }
  };

  if (groups === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="mx-auto mb-4 text-slate-400" size={48} />
          <h3 className="text-xl font-semibold text-white mb-2">No jobs yet</h3>
          <p className="text-slate-400">
            Jobs will appear here when you import or process books
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.groupKey}
              className="p-4 rounded-lg liquid-glass border border-white/10"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {group.book?.title ?? "Unlinked job"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {group.book?.author ?? "Unknown author"}
                    {group.gutenbergId
                      ? ` • Gutenberg #${group.gutenbergId}`
                      : ""}
                  </p>
                </div>

                {group.hasMultipleJobs && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-1 text-xs text-slate-200">
                      <Layers size={12} /> {group.totalJobs} jobs
                    </span>
                    <span className="rounded-full border px-2 py-1 text-xs text-amber-200 border-amber-500/40 bg-amber-500/20">
                      Queued {group.statuses.queued}
                    </span>
                    <span className="rounded-full border px-2 py-1 text-xs text-sky-200 border-sky-500/40 bg-sky-500/20">
                      Running {group.statuses.running}
                    </span>
                    <span className="rounded-full border px-2 py-1 text-xs text-emerald-200 border-emerald-500/40 bg-emerald-500/20">
                      Completed {group.statuses.completed}
                    </span>
                    <span className="rounded-full border px-2 py-1 text-xs text-rose-200 border-rose-500/40 bg-rose-500/20">
                      Failed {group.statuses.failed}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {group.jobs.map((job) => (
                  <div
                    key={job._id}
                    className="rounded-lg border border-white/10 bg-white/5 p-3 hover:border-white/25 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(job.status)}
                        <span
                          className={`px-2 py-1 text-xs rounded-full border ${getJobStatusBadgeClass(job.status)}`}
                        >
                          {getJobStatusLabel(job.status)}
                        </span>

                        <span
                          className={`px-2 py-1 text-xs rounded-full ${getTypeColor(job.type)}`}
                        >
                          {job.type}
                        </span>

                        <span className="text-xs text-slate-300">
                          Stage:{" "}
                          <span className="text-slate-100">
                            {getJobStageLabel(job.stage)}
                          </span>
                        </span>

                        <span className="text-xs text-slate-300">
                          Progress:{" "}
                          <span className="text-slate-100">
                            {job.progress ?? 0}%
                          </span>
                        </span>
                      </div>

                      <button
                        onClick={() => setSelectedJobId(job._id)}
                        className="inline-flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors"
                        type="button"
                      >
                        Details
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    {job.status === "failed" && job.errorSnippet && (
                      <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">
                        {job.errorSnippet}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedJobId && (
        <JobDetailsDrawer
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  );
}
