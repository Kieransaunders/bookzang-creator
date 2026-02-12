import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AlertTriangle, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

type CandidateId = Id<"discoveryCandidates">;

const statusLabel: Record<string, string> = {
  discovered: "Discovered",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  duplicate_blocked: "Duplicate Blocked",
};

const statusClass: Record<string, string> = {
  discovered: "bg-slate-500/20 text-white/80 border-slate-500/40",
  queued: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  running: "bg-sky-500/20 text-sky-200 border-sky-500/40",
  completed: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  failed: "bg-rose-500/20 text-rose-200 border-rose-500/40",
  duplicate_blocked: "bg-amber-500/20 text-amber-200 border-amber-500/40",
};

export function DiscoveryCandidatesPanel() {
  const candidates = useQuery(api.intake.listDiscoveryCandidates);
  const enqueueCandidate = useMutation(api.intake.enqueueDiscoveryCandidate);
  const [pendingId, setPendingId] = useState<CandidateId | null>(null);
  const [overrideMap, setOverrideMap] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => candidates ?? [], [candidates]);

  const onEnqueue = async (candidateId: CandidateId) => {
    const overrideDuplicate = Boolean(overrideMap[candidateId]);
    setPendingId(candidateId);
    try {
      const result = await enqueueCandidate({
        candidateId,
        overrideDuplicate,
      });

      if (result.status === "duplicate_blocked") {
        toast.error(
          "Duplicate blocked. Enable override for intentional import.",
        );
        return;
      }

      if (result.status === "already_enqueued") {
        toast("Candidate already enqueued and still visible for tracking.");
        return;
      }

      toast.success("Candidate enqueued. Status will update in this table.");
    } catch (error) {
      toast.error("Failed to enqueue discovery candidate");
      console.error(error);
    } finally {
      setPendingId(null);
    }
  };

  if (candidates === undefined) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-white/5 p-8">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-white/5 bg-slate-800/40 p-4">
      <div>
        <h3 className="text-lg font-semibold text-white">
          Discovery Candidates
        </h3>
        <p className="text-sm text-white/70">
          Review candidates before enqueue. Rows remain visible with status
          changes.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-white/70">
          No discovery candidates yet. Run the library discovery command to
          populate this list.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full min-w-[760px] text-left text-sm text-white/80">
            <thead className="bg-slate-800/40 text-xs uppercase tracking-wide text-white/70">
              <tr>
                <th className="px-3 py-2">Gutenberg ID</th>
                <th className="px-3 py-2">Title / Author</th>
                <th className="px-3 py-2">Source Path</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((candidate) => {
                const isPending = pendingId === candidate._id;
                const canEnqueue =
                  candidate.status === "discovered" ||
                  candidate.status === "failed" ||
                  candidate.status === "duplicate_blocked";
                const warningText =
                  candidate.warning ||
                  (!candidate.title || !candidate.author
                    ? "Missing metadata. Review before enqueue."
                    : undefined);

                return (
                  <tr
                    key={candidate._id}
                    className="border-t border-white/5 align-top"
                  >
                    <td className="px-3 py-3 font-mono text-xs text-white/90">
                      {candidate.gutenbergId}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-white">
                        {candidate.title || "Unknown Title"}
                      </p>
                      <p className="text-white/70">
                        {candidate.author || "Unknown Author"}
                      </p>
                      {warningText && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                          <AlertTriangle size={12} /> {warningText}
                        </div>
                      )}
                      {candidate.status === "duplicate_blocked" && (
                        <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">
                          <p>
                            Duplicate blocked.
                            {candidate.existingBookTitle
                              ? ` Existing: ${candidate.existingBookTitle}`
                              : " Existing book found."}
                          </p>
                          {candidate.existingBookId && (
                            <a
                              className="mt-1 inline-block text-blue-300 underline"
                              href={`#book-${candidate.existingBookId}`}
                            >
                              Jump to existing book
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-white/70">
                      <code>{candidate.sourcePath}</code>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${statusClass[candidate.status] || statusClass.discovered}`}
                      >
                        {statusLabel[candidate.status] || candidate.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-2">
                        <button
                          className="inline-flex items-center gap-2 rounded bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-500/40"
                          disabled={!canEnqueue || isPending}
                          onClick={() => onEnqueue(candidate._id)}
                          type="button"
                        >
                          {isPending ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Play size={14} />
                          )}
                          Enqueue
                        </button>
                        {candidate.status === "duplicate_blocked" && (
                          <label className="flex items-center gap-2 text-xs text-white/80">
                            <input
                              checked={Boolean(overrideMap[candidate._id])}
                              onChange={(e) =>
                                setOverrideMap((current) => ({
                                  ...current,
                                  [candidate._id]: e.target.checked,
                                }))
                              }
                              type="checkbox"
                            />
                            Override duplicate block
                          </label>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
