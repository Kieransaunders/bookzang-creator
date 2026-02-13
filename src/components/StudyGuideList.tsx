import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { GenerateGuideModal } from "./GenerateGuideModal";
import { 
  BookOpen, 
  Plus, 
  Loader2, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  GraduationCap,
  ClipboardCheck,
  Users,
  FileText,
} from "lucide-react";

interface StudyGuideListProps {
  bookId: Id<"books">;
  bookTitle: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  study_guide: BookOpen,
  teacher_edition: GraduationCap,
  exam_prep: ClipboardCheck,
  book_club: Users,
  companion: FileText,
  workbook: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  study_guide: "Study Guide",
  teacher_edition: "Teacher's Edition",
  exam_prep: "Exam Prep",
  book_club: "Book Club Guide",
  companion: "Companion",
  workbook: "Workbook",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: "Draft", icon: FileText, color: "text-slate-400" },
  generating: { label: "Generating...", icon: Loader2, color: "text-indigo-400" },
  review_pending: { label: "Review Pending", icon: Clock, color: "text-amber-400" },
  published: { label: "Published", icon: CheckCircle2, color: "text-emerald-400" },
};

export function StudyGuideList({ bookId, bookTitle }: StudyGuideListProps) {
  const guides = useQuery(api.studyGuides.listByBook, { bookId });
  const deleteGuide = useMutation(api.studyGuides.deleteGuide);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"studyGuides"> | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<Id<"studyGuides"> | null>(null);

  const handleDelete = async (guideId: Id<"studyGuides">) => {
    setDeletingId(guideId);
    try {
      await deleteGuide({ guideId });
    } catch (error) {
      console.error("Failed to delete guide:", error);
    } finally {
      setDeletingId(null);
      setMenuOpenId(null);
    }
  };

  if (guides === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-indigo-400" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Study Guides</h3>
          <p className="text-sm text-white/60">
            {guides.length === 0 
              ? "No study guides yet" 
              : `${guides.length} guide${guides.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg transition-all text-sm font-medium"
        >
          <Plus size={16} />
          Create Guide
        </button>
      </div>

      {/* Guides List */}
      {guides.length === 0 ? (
        <div className="text-center py-10 px-6 rounded-xl bg-slate-800/30 border border-white/5">
          <BookOpen className="mx-auto text-white/30 mb-3" size={32} />
          <p className="text-white/60 mb-2">
            Create a study guide for this book
          </p>
          <p className="text-sm text-white/40 max-w-sm mx-auto">
            Generate AI-assisted content including chapter summaries, 
            discussion questions, character analysis, and more.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {guides.map((guide) => {
            const TypeIcon = TYPE_ICONS[guide.guideType || 'study_guide'] || BookOpen;
            const statusConfig = STATUS_CONFIG[guide.status] || STATUS_CONFIG.draft;
            const StatusIcon = statusConfig.icon;
            const isGenerating = guide.status === "generating";
            const progress = guide.sectionCount > 0 
              ? Math.round((guide.completedSections / guide.sectionCount) * 100) 
              : 0;

            return (
              <div
                key={guide._id}
                className="group relative p-4 rounded-xl bg-slate-800/40 border border-white/5 hover:border-indigo-500/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <TypeIcon className="text-indigo-400" size={20} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-medium text-white truncate">
                          {guide.title}
                        </h4>
                        {guide.subtitle && (
                          <p className="text-sm text-white/50 truncate">
                            {guide.subtitle}
                          </p>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className={`flex items-center gap-1.5 text-xs ${statusConfig.color}`}>
                        <StatusIcon size={14} className={isGenerating ? "animate-spin" : ""} />
                        <span>{statusConfig.label}</span>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
                      <span>{TYPE_LABELS[guide.guideType || 'study_guide']}</span>
                      <span>•</span>
                      <span>{guide.sectionCount} sections</span>
                      {guide.targetAudience && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{guide.targetAudience.replace('_', ' ')}</span>
                        </>
                      )}
                    </div>

                    {/* Progress Bar for generating */}
                    {isGenerating && (
                      <div className="mt-3">
                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-white/40 mt-1">
                          Generating content... {progress}%
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === guide._id ? null : guide._id)}
                      className="p-2 text-white/40 hover:text-white transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {menuOpenId === guide._id && (
                      <div className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-slate-800 border border-white/10 shadow-xl z-10 py-1">
                        <button
                          className="w-full px-4 py-2 text-left text-sm text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                        >
                          <Eye size={14} />
                          Preview
                        </button>
                        <button
                          className="w-full px-4 py-2 text-left text-sm text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                        >
                          <Edit3 size={14} />
                          Edit
                        </button>
                        <hr className="my-1 border-white/10" />
                        <button
                          onClick={() => handleDelete(guide._id)}
                          disabled={deletingId === guide._id}
                          className="w-full px-4 py-2 text-left text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 disabled:opacity-50"
                        >
                          {deletingId === guide._id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <GenerateGuideModal
          bookId={bookId}
          bookTitle={bookTitle}
          onClose={() => setShowGenerateModal(false)}
        />
      )}

      {/* Click outside to close menu */}
      {menuOpenId && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setMenuOpenId(null)}
        />
      )}
    </div>
  );
}
