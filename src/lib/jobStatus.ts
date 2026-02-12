export const JOB_STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
} as const;

export const JOB_STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  loading_file: "Loading file",
  parsing_metadata: "Parsing metadata",
  persisting_metadata: "Saving metadata",
  completed: "Completed",
  failed: "Failed",
};

export const getJobStatusLabel = (status: string) => {
  return (
    JOB_STATUS_LABELS[status as keyof typeof JOB_STATUS_LABELS] ?? "Queued"
  );
};

export const getJobStageLabel = (stage?: string) => {
  if (!stage) {
    return "Queued";
  }

  return JOB_STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
};

export const getJobStatusBadgeClass = (status: string) => {
  switch (status) {
    case "queued":
      return "bg-amber-500/20 text-amber-200 border-amber-500/40";
    case "running":
      return "bg-sky-500/20 text-sky-200 border-sky-500/40";
    case "completed":
      return "bg-emerald-500/20 text-emerald-200 border-emerald-500/40";
    case "failed":
      return "bg-rose-500/20 text-rose-200 border-rose-500/40";
    default:
      return "bg-slate-500/20 text-slate-200 border-slate-500/40";
  }
};
