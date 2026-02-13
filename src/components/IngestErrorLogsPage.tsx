import { useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  ShieldAlert,
} from "lucide-react";
import { api } from "../../convex/_generated/api";

const formatTimestamp = (value?: number) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
};

export function IngestErrorLogsPage() {
  const events = useQuery(api.ingestJobs.listErrorEvents, { limit: 100 });

  if (events === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 rounded-xl border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-white/[0.03] flex items-center justify-center">
            <CheckCircle2 className="text-emerald-300/80" size={40} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No ingest errors
          </h3>
          <p className="text-white/70">
            Daemon-reported failures and warnings will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const isFailed = event.status === "failed";
            const tone = isFailed
              ? "border-rose-500/25 bg-rose-500/10"
              : "border-amber-500/25 bg-amber-500/10";
            const textTone = isFailed ? "text-rose-200" : "text-amber-200";

            return (
              <article
                key={String(event._id)}
                className={`rounded-xl border p-4 ${tone}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isFailed ? (
                        <ShieldAlert className="text-rose-300" size={16} />
                      ) : (
                        <FileWarning className="text-amber-300" size={16} />
                      )}
                      <p className="text-sm font-semibold text-white">
                        {isFailed ? "Failure" : "Warning"}
                        {event.book?.title
                          ? ` - ${event.book.title}`
                          : " - Unlinked ingest job"}
                      </p>
                    </div>
                    <p className="text-xs text-white/70 mt-1">
                      Gutenberg #{event.gutenbergId} • mode {event.mode} • stage{" "}
                      {event.stage ?? "-"}
                    </p>
                  </div>
                  <p className="text-xs text-white/60 whitespace-nowrap">
                    {formatTimestamp(event.updatedAt)}
                  </p>
                </div>

                <div
                  className={`mt-3 rounded-lg border border-white/10 bg-black/20 p-3 ${textTone}`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {event.error ?? event.warning ?? "No details provided"}
                  </p>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-white/70 md:grid-cols-2">
                  <p>
                    Source URL:{" "}
                    <span className="text-white/80">
                      {event.sourceUrl ?? "-"}
                    </span>
                  </p>
                  <p>
                    Selected format:{" "}
                    <span className="text-white/80">
                      {event.selectedFormat ?? "-"}
                    </span>
                  </p>
                  <p>
                    Local source:{" "}
                    <span className="text-white/80">
                      {event.localSourcePath ?? "-"}
                    </span>
                  </p>
                  <p>
                    Local extracted:{" "}
                    <span className="text-white/80">
                      {event.localExtractedPath ?? "-"}
                    </span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
        <p className="text-xs text-indigo-200/90 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          This screen shows daemon events persisted in Convex (`ingestJobs`
          failures and warnings). Local launchd log files remain on this machine
          in `~/Library/Logs/bookzang/`.
        </p>
      </div>
    </div>
  );
}
