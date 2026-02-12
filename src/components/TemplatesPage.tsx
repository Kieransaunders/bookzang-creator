import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

import { FileText, Check } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

export function TemplatesPage() {
  const templates = useQuery(api.templates.list);

  if (templates === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-white mb-2">Choose a Template</h3>
        <p className="text-slate-400">Select a template to apply to your books for PDF generation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div
            key={template._id}
            className="p-6 rounded-lg liquid-glass hover:border-white/30 transition-all cursor-pointer group"
          >
            <div className="space-y-4">
              {/* Preview */}
              <div className="h-32 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                <div className="text-center">
                  <div className="text-4xl font-serif text-white mb-2" style={{
                    fontSize: `${template.settings.fontSize * 2}px`,
                    lineHeight: template.settings.lineHeight,
                  }}>
                    {template.preview}
                  </div>
                  <div className="text-xs text-slate-400">
                    {template.settings.fontSize}pt • {template.settings.lineHeight}x line height
                  </div>
                </div>
              </div>

              {/* Template Info */}
              <div className="space-y-2">
                <h4 className="font-semibold text-white text-lg">{template.name}</h4>
                <p className="text-sm text-slate-300 line-clamp-2">{template.description}</p>
              </div>

              {/* Settings Preview */}
              <div className="text-xs text-slate-400 space-y-1">
                <div>Font Size: {template.settings.fontSize}pt</div>
                <div>Line Height: {template.settings.lineHeight}x</div>
                <div>
                  Margins: {template.settings.margins.top}" top, {template.settings.margins.bottom}" bottom
                </div>
              </div>

              {/* Select Button */}
              <button className="w-full py-2 px-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors border border-blue-500/30 group-hover:border-blue-500/50">
                Select Template
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
