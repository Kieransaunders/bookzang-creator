import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { X, BookOpen, GraduationCap, ClipboardCheck, Users, Loader2 } from "lucide-react";

interface GenerateGuideModalProps {
  bookId: Id<"books">;
  bookTitle: string;
  onClose: () => void;
  onGenerated?: (guideId: Id<"studyGuides">) => void;
}

const TEMPLATES = [
  {
    id: "high_school_study" as const,
    name: "High School Study Guide",
    description: "Chapter summaries, character analysis, themes, discussion questions, and essay prompts",
    icon: BookOpen,
    audience: "High School Students",
    sections: ["Historical Background", "Chapter Summaries", "Character Analysis", "Themes", "Discussion Questions", "Essay Prompts"],
  },
  {
    id: "teachers_edition" as const,
    name: "Teacher's Edition",
    description: "Complete guide with answer keys, rubrics, and lesson planning resources",
    icon: GraduationCap,
    audience: "Educators",
    sections: ["Historical Background", "Chapter Summaries", "Character Analysis", "Themes & Symbols", "Discussion Questions (with Answers)", "Essay Prompts (with Rubrics)"],
  },
  {
    id: "exam_prep" as const,
    name: "Exam Prep Companion",
    description: "Quick summaries, cheat sheets, practice essays, and key quotations for test prep",
    icon: ClipboardCheck,
    audience: "Students preparing for exams",
    sections: ["Quick Summary", "Character Cheat Sheet", "Theme Matrix", "Key Quotations", "Practice Essays"],
  },
  {
    id: "book_club" as const,
    name: "Book Club Guide",
    description: "Discussion-focused guide with reflection prompts and connection exercises",
    icon: Users,
    audience: "Book Clubs",
    sections: ["About the Author", "Context & Background", "Book Summary", "Discussion Questions", "Reflection & Connection"],
  },
];

export function GenerateGuideModal({ bookId, bookTitle, onClose, onGenerated }: GenerateGuideModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const createFromTemplate = useMutation(api.studyGuides.createFromTemplate);

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    try {
      const result = await createFromTemplate({
        bookId,
        templateId: selectedTemplate as any,
        customTitle: customTitle.trim() || undefined,
      });
      onGenerated?.(result.guideId);
      onClose();
    } catch (error) {
      console.error("Failed to generate guide:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedTemplateData = TEMPLATES.find(t => t.id === selectedTemplate);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-slate-900 border border-white/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Generate Study Guide
            </h2>
            <p className="text-sm text-white/60 mt-1">
              for {bookTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-white/60 hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedTemplate ? (
            <div className="space-y-4">
              <p className="text-white/70 mb-6">
                Choose a template to generate a study guide. AI will create initial content that you can review and edit.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className="text-left p-5 rounded-xl bg-slate-800/50 border border-white/10 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                          <Icon className="text-indigo-400" size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white mb-1">
                            {template.name}
                          </h3>
                          <p className="text-sm text-white/60 mb-3">
                            {template.description}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {template.sections.slice(0, 4).map((section) => (
                              <span
                                key={section}
                                className="px-2 py-0.5 text-[10px] bg-white/5 text-white/50 rounded-full"
                              >
                                {section}
                              </span>
                            ))}
                            {template.sections.length > 4 && (
                              <span className="px-2 py-0.5 text-[10px] bg-white/5 text-white/50 rounded-full">
                                +{template.sections.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-sm text-white/60 hover:text-white flex items-center gap-1"
              >
                ← Back to templates
              </button>

              {selectedTemplateData && (
                <div className="p-5 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                  <div className="flex items-center gap-3 mb-3">
                    <selectedTemplateData.icon className="text-indigo-400" size={24} />
                    <h3 className="font-semibold text-white">{selectedTemplateData.name}</h3>
                  </div>
                  <p className="text-sm text-white/70">{selectedTemplateData.description}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Guide Title
                </label>
                <input
                  type="text"
                  placeholder={`${bookTitle}: A Study Guide`}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500/50"
                />
                <p className="text-xs text-white/50 mt-1.5">
                  Leave blank for auto-generated title
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-3">
                  Sections to Generate
                </label>
                <div className="space-y-2">
                  {selectedTemplateData?.sections.map((section, i) => (
                    <div key={section} className="flex items-center gap-3 text-sm">
                      <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-white/70">{section}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-200/80">
                  <strong>Note:</strong> AI-generated content will be created for each section. 
                  You'll be able to review and edit all content before publishing.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/50">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-white/70 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {selectedTemplate && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-medium rounded-lg transition-all flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Guide"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
