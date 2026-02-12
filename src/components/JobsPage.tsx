import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import { Play, CheckCircle, XCircle, Clock, ChevronRight } from "lucide-react";
import { JobDetailsDrawer } from "./JobDetailsDrawer";
import { Id } from "../../convex/_generated/dataModel";

export function JobsPage() {
  const jobs = useQuery(api.jobs.list);
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "queued": return <Clock className="text-yellow-400" size={16} />;
      case "running": return <Play className="text-blue-400" size={16} />;
      case "done": return <CheckCircle className="text-green-400" size={16} />;
      case "error": return <XCircle className="text-red-400" size={16} />;
      default: return <Clock className="text-gray-400" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "queued": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "running": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "done": return "bg-green-500/20 text-green-300 border-green-500/30";
      case "error": return "bg-red-500/20 text-red-300 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "import": return "bg-purple-500/20 text-purple-300";
      case "clean": return "bg-orange-500/20 text-orange-300";
      case "export": return "bg-cyan-500/20 text-cyan-300";
      default: return "bg-gray-500/20 text-gray-300";
    }
  };

  if (jobs === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="mx-auto mb-4 text-slate-400" size={48} />
          <h3 className="text-xl font-semibold text-white mb-2">No jobs yet</h3>
          <p className="text-slate-400">Jobs will appear here when you import or process books</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job._id}
              className="p-4 rounded-lg liquid-glass hover:border-white/30 transition-all cursor-pointer"
              onClick={() => setSelectedJobId(job._id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(job.status)} border`}>
                      {job.status}
                    </span>
                  </div>
                  
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(job.type)}`}>
                    {job.type}
                  </span>
                  
                  <div className="text-sm text-slate-300">
                    {job.gutenbergId && (
                      <span>Gutenberg #{job.gutenbergId}</span>
                    )}
                  </div>
                  
                  {job.progress !== undefined && job.progress > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{job.progress}%</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <span>{new Date(job._creationTime).toLocaleTimeString()}</span>
                  <ChevronRight size={16} />
                </div>
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
