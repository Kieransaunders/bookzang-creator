import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import { X, Clock, Play, CheckCircle, XCircle } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

interface JobDetailsDrawerProps {
  jobId: Id<"jobs">;
  onClose: () => void;
}

export function JobDetailsDrawer({ jobId, onClose }: JobDetailsDrawerProps) {
  const job = useQuery(api.jobs.get, { id: jobId });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "queued": return <Clock className="text-yellow-400" size={20} />;
      case "running": return <Play className="text-blue-400" size={20} />;
      case "done": return <CheckCircle className="text-green-400" size={20} />;
      case "error": return <XCircle className="text-red-400" size={20} />;
      default: return <Clock className="text-gray-400" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "queued": return "text-yellow-300";
      case "running": return "text-blue-300";
      case "done": return "text-green-300";
      case "error": return "text-red-300";
      default: return "text-gray-300";
    }
  };

  if (!job) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-end p-4 z-50">
      <div className="w-full max-w-md h-full rounded-2xl liquid-glass-strong p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Job Details</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Status</label>
            <div className="flex items-center gap-3">
              {getStatusIcon(job.status)}
              <span className={`font-medium capitalize ${getStatusColor(job.status)}`}>
                {job.status}
              </span>
            </div>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Type</label>
            <span className="text-white capitalize">{job.type}</span>
          </div>

          {/* Gutenberg ID */}
          {job.gutenbergId && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Gutenberg ID</label>
              <span className="text-white">#{job.gutenbergId}</span>
            </div>
          )}

          {/* Progress */}
          {job.progress !== undefined && job.progress > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Progress</label>
              <div className="space-y-2">
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <span className="text-sm text-slate-400">{job.progress}%</span>
              </div>
            </div>
          )}

          {/* Created */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Created</label>
            <span className="text-white">
              {new Date(job._creationTime).toLocaleString()}
            </span>
          </div>

          {/* Error */}
          {job.error && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Error</label>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <span className="text-red-300 text-sm">{job.error}</span>
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Logs</label>
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg min-h-[200px]">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                {job.logs || "No logs available"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
