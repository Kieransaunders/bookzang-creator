import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

import { X, Download, AlertCircle, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

interface ImportModalProps {
  onClose: () => void;
}

type ImportMode = "gutenberg" | "upload";

export function ImportModal({ onClose }: ImportModalProps) {
  const [mode, setMode] = useState<ImportMode>("gutenberg");
  const [gutenbergInput, setGutenbergInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  
  const createJob = useMutation(api.jobs.create);
  const createBook = useMutation(api.books.create);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createBookFromFile = useMutation(api.books.createFromFile);

  const extractGutenbergId = (input: string): string | null => {
    // Handle direct ID
    if (/^\d+$/.test(input.trim())) {
      return input.trim();
    }
    
    // Handle Gutenberg URL
    const urlMatch = input.match(/gutenberg\.org\/ebooks\/(\d+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    return null;
  };

  const handleGutenbergSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const gutenbergId = extractGutenbergId(gutenbergInput);
    if (!gutenbergId) {
      toast.error("Please enter a valid Gutenberg ID or URL");
      return;
    }

    setIsLoading(true);
    
    try {
      // Create import job
      await createJob({
        type: "import",
        gutenbergId,
      });
      
      // Simulate creating a book (in real app, this would be done by the job processor)
      setTimeout(async () => {
        try {
          await createBook({
            title: `Book #${gutenbergId}`,
            author: "Unknown Author",
            gutenbergId,
          });
          toast.success("Book imported successfully!");
        } catch (error) {
          console.error("Error creating book:", error);
        }
      }, 2000);
      
      toast.success("Import job created!");
      onClose();
    } catch (error) {
      toast.error("Failed to create import job");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !bookTitle.trim() || !bookAuthor.trim()) {
      toast.error("Please fill in all fields and select a file");
      return;
    }

    setIsLoading(true);
    
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
      await createBookFromFile({
        title: bookTitle.trim(),
        author: bookAuthor.trim(),
        fileId: storageId,
        fileName: selectedFile.name,
      });
      
      toast.success("Book uploaded successfully!");
      onClose();
    } catch (error) {
      toast.error("Failed to upload book");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['text/plain', 'text/markdown', 'application/epub+zip'];
      const validExtensions = ['.txt', '.md', '.epub'];
      
      const hasValidType = validTypes.includes(file.type);
      const hasValidExtension = validExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      
      if (!hasValidType && !hasValidExtension) {
        toast.error("Please select a valid text file (.txt, .md, or .epub)");
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error("File size must be less than 10MB");
        return;
      }
      
      setSelectedFile(file);
      
      // Auto-populate title from filename if empty
      if (!bookTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setBookTitle(nameWithoutExt);
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

        {/* Mode Selection */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("gutenberg")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              mode === "gutenberg"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "bg-white/10 text-slate-300 border border-white/20 hover:bg-white/20"
            }`}
          >
            <Download size={16} />
            Gutenberg
          </button>
          <button
            onClick={() => setMode("upload")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              mode === "upload"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "bg-white/10 text-slate-300 border border-white/20 hover:bg-white/20"
            }`}
          >
            <Upload size={16} />
            Upload File
          </button>
        </div>

        {mode === "gutenberg" ? (
          <form onSubmit={handleGutenbergSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Gutenberg ID or URL
              </label>
              <input
                type="text"
                value={gutenbergInput}
                onChange={(e) => setGutenbergInput(e.target.value)}
                placeholder="e.g., 1342 or https://www.gutenberg.org/ebooks/1342"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                required
              />
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                <div className="text-sm text-blue-300">
                  <p className="font-medium mb-1">How to find books:</p>
                  <p>Visit gutenberg.org, find a book, and copy either the book ID number or the full URL.</p>
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
                disabled={isLoading || !gutenbergInput.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg transition-colors"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Download size={16} />
                    Import
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
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
                <div className="w-full flex items-center justify-center gap-3 px-4 py-6 bg-white/10 border-2 border-dashed border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors cursor-pointer"
                >
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

            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-green-400 flex-shrink-0 mt-0.5" size={16} />
                <div className="text-sm text-green-300">
                  <p className="font-medium mb-1">Supported formats:</p>
                  <p>Plain text (.txt), Markdown (.md), and EPUB (.epub) files are supported.</p>
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
                disabled={isLoading || !selectedFile || !bookTitle.trim() || !bookAuthor.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg transition-colors"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
