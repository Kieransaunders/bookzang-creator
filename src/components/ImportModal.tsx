import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

import { X, AlertCircle, Upload, FileText, BookOpen, User, Hash } from "lucide-react";
import { toast } from "sonner";

interface ImportModalProps {
  onClose: () => void;
}

export function ImportModal({ onClose }: ImportModalProps) {
  const [folderNumberInput, setFolderNumberInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const [duplicateBlock, setDuplicateBlock] = useState<{
    message: string;
    existingBookId: string;
    gutenbergId?: string;
  } | null>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createBookFromFile = useMutation(api.books.createFromFile);

  const extractFolderNumber = (input: string): string | null => {
    if (/^\d+$/.test(input.trim())) {
      return input.trim();
    }
    return null;
  };

  const inferFolderNumberFromFileName = (fileName: string): string | null => {
    const pgMatch = fileName.match(/^pg(\d+).*\.(txt|md|epub)$/i);
    if (pgMatch) {
      return pgMatch[1];
    }

    const numericBaseName = fileName
      .replace(/\.[^/.]+$/, "")
      .trim()
      .match(/^(\d+)$/);
    if (numericBaseName) {
      return numericBaseName[1];
    }

    return null;
  };

  const inferMetadataFromPreview = (text: string) => {
    const titleMatch = text.match(/^Title:\s*(.+)$/im);
    const authorMatch = text.match(/^Author:\s*(.+)$/im);

    if (titleMatch?.[1] || authorMatch?.[1]) {
      return {
        title: titleMatch?.[1]?.trim(),
        author: authorMatch?.[1]?.trim(),
      };
    }

    const fallback = text.match(
      /Project Gutenberg eBook of\s+([^,\n]+),\s+by\s+([^\n]+)/i,
    );

    return {
      title: fallback?.[1]?.trim(),
      author: fallback?.[2]?.trim(),
    };
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile || !bookTitle.trim() || !bookAuthor.trim()) {
      toast.error("Please fill in all fields and select a file");
      return;
    }

    const parsedGutenbergId = folderNumberInput.trim()
      ? extractFolderNumber(folderNumberInput)
      : null;
    if (folderNumberInput.trim() && !parsedGutenbergId) {
      toast.error("Folder number must be numeric (e.g., 11)");
      return;
    }

    setIsLoading(true);
    setDuplicateBlock(null);

    try {
      const uploadUrl = await generateUploadUrl();

      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();

      const response = await createBookFromFile({
        title: bookTitle.trim(),
        author: bookAuthor.trim(),
        fileId: storageId,
        fileName: selectedFile.name,
        gutenbergId: parsedGutenbergId ?? undefined,
        overrideDuplicate,
      });

      if (response?.status === "duplicate_blocked") {
        setDuplicateBlock({
          message:
            response.message ?? "A book with this Gutenberg ID already exists.",
          existingBookId: response.existingBookId,
          gutenbergId: response.gutenbergId,
        });
        toast.error(
          "Duplicate blocked. Enable override to import intentionally.",
        );
        return;
      }

      toast.success("Upload accepted. Intake started.");
      onClose();
    } catch (error) {
      toast.error("Failed to upload book");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        "text/plain",
        "text/markdown",
        "application/epub+zip",
      ];
      const validExtensions = [".txt", ".md", ".epub"];

      const hasValidType = validTypes.includes(file.type);
      const hasValidExtension = validExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      );

      if (!hasValidType && !hasValidExtension) {
        toast.error("Please select a valid text file (.txt, .md, or .epub)");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }

      setSelectedFile(file);
      setDuplicateBlock(null);

      if (!folderNumberInput.trim()) {
        const inferredFolderNumber = inferFolderNumberFromFileName(file.name);
        if (inferredFolderNumber) {
          setFolderNumberInput(inferredFolderNumber);
        }
      }

      if (!bookTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setBookTitle(nameWithoutExt);
      }

      if (!bookAuthor.trim() || !bookTitle.trim()) {
        try {
          const preview = await file.slice(0, 120_000).text();
          const inferred = inferMetadataFromPreview(preview);

          if (!bookTitle.trim() && inferred.title) {
            setBookTitle(inferred.title);
          }

          if (!bookAuthor.trim() && inferred.author) {
            setBookAuthor(inferred.author);
          }
        } catch {
          // Ignore preview parsing errors
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg auth-card p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-semibold text-white">Import Book</h3>
            <p className="text-sm text-white/90 mt-1">Upload a book file to get started</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800/40 hover:bg-slate-700/50 border border-white/5 flex items-center justify-center text-white/70 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleFileUpload} className="space-y-5">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2.5">
              Book File
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".txt,.md,.epub,text/plain,text/markdown,application/epub+zip"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                id="file-upload"
              />
              <div className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 border-dashed transition-all ${
                selectedFile 
                  ? "bg-indigo-500/5 border-indigo-500/30" 
                  : "bg-slate-800/40 border-white/5 hover:bg-slate-800/60 hover:border-white/20"
              }`}>
                {selectedFile ? (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="text-indigo-400" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{selectedFile.name}</div>
                      <div className="text-sm text-white/70">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="w-8 h-8 rounded-lg bg-slate-800/40 hover:bg-slate-700/50 flex items-center justify-center text-white/70 hover:text-white transition-all"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-slate-800/40 flex items-center justify-center flex-shrink-0">
                      <Upload className="text-white/60" size={24} />
                    </div>
                    <div>
                      <div className="font-medium text-white">Click to upload</div>
                      <div className="text-sm text-white/70">
                        .txt, .md, or .epub up to 10MB
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2.5">
              <BookOpen size={14} className="inline mr-1.5 -mt-0.5" />
              Book Title
            </label>
            <input
              type="text"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="Enter the book title"
              className="w-full px-4 py-3.5 bg-slate-800/40 border border-white/5 rounded-xl text-white placeholder:text-white/60 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              required
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2.5">
              <User size={14} className="inline mr-1.5 -mt-0.5" />
              Author
            </label>
            <input
              type="text"
              value={bookAuthor}
              onChange={(e) => setBookAuthor(e.target.value)}
              placeholder="Enter the author name"
              className="w-full px-4 py-3.5 bg-slate-800/40 border border-white/5 rounded-xl text-white placeholder:text-white/60 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              required
            />
          </div>

          {/* Gutenberg ID */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2.5">
              <Hash size={14} className="inline mr-1.5 -mt-0.5" />
              Gutenberg ID (optional)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={folderNumberInput}
              onChange={(e) => {
                setFolderNumberInput(e.target.value.replace(/\D/g, ""));
                setDuplicateBlock(null);
              }}
              placeholder="e.g., 11"
              className="w-full px-4 py-3.5 bg-slate-800/40 border border-white/5 rounded-xl text-white placeholder:text-white/60 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
            <p className="mt-2 text-xs text-white/60">
              Auto-fills from filenames like <code className="bg-slate-800/40 px-1 py-0.5 rounded">pg11.txt</code>
            </p>
          </div>

          {/* Duplicate Warning */}
          {duplicateBlock && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 flex-shrink-0 text-amber-400" size={18} />
                <div className="flex-1">
                  <p className="font-medium text-amber-200 mb-1">Duplicate detected</p>
                  <p className="text-sm text-amber-200/70">{duplicateBlock.message}</p>
                  <label className="flex items-center gap-2 mt-3 text-sm text-amber-100">
                    <input
                      type="checkbox"
                      checked={overrideDuplicate}
                      onChange={(e) => setOverrideDuplicate(e.target.checked)}
                      className="rounded border-amber-500/50 bg-amber-500/10"
                    />
                    Import as duplicate anyway
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-emerald-200/80">
                <p className="font-medium text-emerald-200 mb-1">Supported formats</p>
                <p>Plain text (.txt), Markdown (.md), and EPUB files are supported. Maximum file size is 10MB.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-3.5 bg-slate-800/40 hover:bg-slate-700/50 text-white font-medium rounded-xl border border-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isLoading ||
                !selectedFile ||
                !bookTitle.trim() ||
                !bookAuthor.trim()
              }
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/25"
            >
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <Upload size={18} />
                  {overrideDuplicate ? "Import Duplicate" : "Import Book"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
