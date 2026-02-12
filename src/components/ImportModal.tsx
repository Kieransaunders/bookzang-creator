import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

import { X, AlertCircle, Upload, FileText } from "lucide-react";
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
      // Step 1: Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload file
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();

      // Step 3: Create book from uploaded file
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
      // Validate file type
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
        // 10MB limit
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

      // Auto-populate title from filename if empty
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
          // Ignore preview parsing errors and keep manual entry path.
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md rounded-2xl liquid-glass-strong p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Import Book</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleFileUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select File
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".txt,.md,.epub,text/plain,text/markdown,application/epub+zip"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="file-upload"
              />
              <div className="w-full flex items-center justify-center gap-3 px-4 py-6 bg-white/10 border-2 border-dashed border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors cursor-pointer">
                {selectedFile ? (
                  <>
                    <FileText className="text-blue-400" size={20} />
                    <div className="text-center">
                      <div className="font-medium">{selectedFile.name}</div>
                      <div className="text-sm text-slate-400">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="text-slate-400" size={20} />
                    <div className="text-center">
                      <div className="font-medium">Choose a file</div>
                      <div className="text-sm text-slate-400">
                        .txt, .md, or .epub files up to 10MB
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Book Title
            </label>
            <input
              type="text"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="Enter the book title"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Author
            </label>
            <input
              type="text"
              value={bookAuthor}
              onChange={(e) => setBookAuthor(e.target.value)}
              placeholder="Enter the author name"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Gutenberg ebook code (folder number, optional)
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
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <p className="mt-2 text-xs text-slate-400">
              Uses your local `library/epub/&lt;number&gt;` folder number.
              Auto-fills from filenames like `pg11.txt`.
            </p>
          </div>

          {duplicateBlock && (
            <div className="space-y-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle
                  className="mt-0.5 flex-shrink-0 text-amber-300"
                  size={16}
                />
                <div>
                  <p className="font-medium">Duplicate blocked</p>
                  <p>{duplicateBlock.message}</p>
                  {duplicateBlock.gutenbergId && (
                    <p>Gutenberg #{duplicateBlock.gutenbergId}</p>
                  )}
                  <a
                    href={`#book-${duplicateBlock.existingBookId}`}
                    className="mt-1 inline-block text-blue-300 underline"
                  >
                    Jump to existing book
                  </a>
                </div>
              </div>
              <label className="flex items-center gap-2 text-amber-100">
                <input
                  type="checkbox"
                  checked={overrideDuplicate}
                  onChange={(e) => setOverrideDuplicate(e.target.checked)}
                />
                Import intentionally as duplicate
              </label>
            </div>
          )}

          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle
                className="text-green-400 flex-shrink-0 mt-0.5"
                size={16}
              />
              <div className="text-sm text-green-300">
                <p className="font-medium mb-1">Supported formats:</p>
                <p>
                  Plain text (.txt), Markdown (.md), and EPUB (.epub) files are
                  supported.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg transition-colors"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Upload size={16} />
                  {overrideDuplicate ? "Upload with Override" : "Upload"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
