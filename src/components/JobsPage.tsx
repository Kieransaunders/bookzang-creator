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
  AlertCircle,
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
  const [expandedFailures, setExpandedFailures] = useState<
    Record<string, boolean>
  >({});

  const toggleFailure = (jobId: Id<"jobs">) => {
    const key = String(jobId);
    setExpandedFailures((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "queued":
        return <Clock className="text-amber-400" size={16} />;
      case "running":
        return <Play className="text-indigo-400 fill-indigo-400" size={16} />;
      case "completed":
        return <CheckCircle className="text-emerald-400" size={16} />;
      case "failed":
        return <XCircle className="text-rose-400" size={16} />;
      default:
        return <Clock className="text-white/90" size={16} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "import":
        return "bg-purple-500/15 text-purple-300 border-purple-500/25";
      case "clean":
        return "bg-orange-500/15 text-orange-300 border-orange-500/25";
      case "export":
        return "bg-cyan-500/15 text-cyan-300 border-cyan-500/25";
      default:
        return "bg-gray-500/15 text-gray-300 border-gray-500/25";
    }
  };

  if (groups === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 rounded-xl border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {groups.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/[0.03] flex items-center justify-center">
            <Clock className="text-white/20" size={40} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No jobs yet</h3>
          <p className="text-white/70">
            Jobs will appear here when you import or process books
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={group.groupKey}
              className="p-5 rounded-xl bg-slate-800/40 border border-white/[0.03]"
            >
              {/* Group Header */}
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">
                    {group.book?.title ?? "Unlinked job"}
                  </p>
                  <p className="text-sm text-white/70 mt-0.5">
                    {group.book?.author ?? "Unknown author"}
                    {group.gutenbergId
                      ? ` • Gutenberg #${group.gutenbergId}`
                      : ""}
                  </p>
                </div>

                {group.hasMultipleJobs && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.03] bg-slate-800/40 px-2.5 py-1.5 text-xs font-medium text-white/60">
                      <Layers size={12} /> {group.totalJobs} jobs
                    </span>
                    {group.statuses.queued > 0 && (
                      <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300">
                        Queued {group.statuses.queued}
                      </span>
                    )}
                    {group.statuses.running > 0 && (
                      <span className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300">
                        Running {group.statuses.running}
                      </span>
                    )}
                    {group.statuses.completed > 0 && (
                      <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300">
                        Done {group.statuses.completed}
                      </span>
                    )}
                    {group.statuses.failed > 0 && (
                      <span className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300">
                        Failed {group.statuses.failed}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Jobs List */}
              <div className="space-y-2">
                {group.jobs.map((job) => (
                  <div
                    key={job._id}
                    className="rounded-xl border border-white/[0.03] bg-slate-800/30 p-4 hover:border-white/15 hover:bg-slate-800/50 transition-all duration-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        {getStatusIcon(job.status)}
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${getJobStatusBadgeClass(job.status)}`}
                        >
                          {getJobStatusLabel(job.status)}
                        </span>

                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${getTypeColor(job.type)}`}
                        >
                          {job.type}
                        </span>

                        <span className="text-xs text-white/70">
                          <span className="text-white/60">{getJobStageLabel(job.stage)}</span>
                        </span>

                        {job.status === "running" && (
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                                style={{ width: `${job.progress ?? 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-white/60">
                              {job.progress ?? 0}%
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedJobId(job._id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors"
                        type="button"
                      >
                        Details
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    {job.status === "failed" && job.errorSnippet && (
                      <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="text-rose-400 flex-shrink-0 mt-0.5" size={16} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-rose-200 mb-3">{job.errorSnippet}</p>
                            <div className="flex items-center gap-4">
                              <button
                                type="button"
                                className="text-xs font-medium text-rose-300 hover:text-rose-200 transition-colors"
                                onClick={() => toggleFailure(job._id)}
                              >
                                {expandedFailures[String(job._id)]
                                  ? "Hide details"
                                  : "Show details"}
                              </button>
                              <button
                                type="button"
                                className="text-xs font-medium text-indigo-300 hover:text-indigo-200 transition-colors"
                                onClick={() => setSelectedJobId(job._id)}
                              >
                                Open full log
                              </button>
                            </div>
                          </div>
                        </div>

                        {expandedFailures[String(job._id)] && (
                          <div className="mt-4 space-y-3 rounded-lg border border-rose-500/15 bg-black/20 p-4">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300 mb-2">
                                Error Details
                              </p>
                              <pre className="whitespace-pre-wrap break-words text-xs text-rose-100/80 font-mono">
                                {job.errorDetails ?? job.error ?? "No detailed error available"}
                              </pre>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300 mb-2">
                                Logs
                              </p>
                              <pre className="whitespace-pre-wrap break-words text-xs text-rose-100/60 font-mono max-h-40 overflow-y-auto">
                                {job.logs ?? "No logs available"}
                              </pre>
                            </div>
                          </div>
                        )}
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
