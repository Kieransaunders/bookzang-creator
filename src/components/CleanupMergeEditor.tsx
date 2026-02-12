/**
 * CleanupMergeEditor - Side-by-side merge editor for editorial review
 *
 * Uses CodeMirror MergeView to display original (read-only) and cleaned (editable)
 * text with line/paragraph-level diff highlighting.
 */

import { useEffect, useRef, useCallback } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";

interface CleanupMergeEditorProps {
  /** Original text - read-only reference pane */
  originalText: string;
  /** Cleaned text - editable pane */
  cleanedText: string;
  /** Callback when cleaned text changes */
  onCleanedChange: (text: string) => void;
  /** Optional focus range in cleaned text for flag navigation */
  focusRange?: {
    key: string;
    startOffset: number;
    endOffset: number;
  } | null;
  /** Optional className for styling */
  className?: string;
}

/**
 * Debounce utility for performance on large documents
 */
function debounce(
  fn: (text: string) => void,
  delay: number,
): (text: string) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (text: string) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(text), delay);
  };
}

/**
 * CodeMirror Merge Editor for side-by-side review
 *
 * Features:
 * - Left pane: Original text (read-only)
 * - Right pane: Cleaned text (editable)
 * - Line/paragraph-level diff highlighting by default
 * - Debounced change callbacks for performance
 */
export function CleanupMergeEditor({
  originalText,
  cleanedText,
  onCleanedChange,
  focusRange,
  className = "",
}: CleanupMergeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const cleanedViewRef = useRef<EditorView | null>(null);
  const lastFocusKeyRef = useRef<string | null>(null);

  // Debounced change handler for performance
  const debouncedOnChange = useCallback(
    debounce((text: string) => {
      onCleanedChange(text);
    }, 300),
    [onCleanedChange],
  );

  // Initialize the merge view
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any existing merge view
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy();
      mergeViewRef.current = null;
      cleanedViewRef.current = null;
    }

    // Create custom dark theme that matches BookZang's liquid glass aesthetic
    const bookZangDarkTheme = EditorView.theme({
      "&": {
        backgroundColor: "rgba(30, 41, 59, 0.5)",
        color: "#e2e8f0",
      },
      ".cm-content": {
        caretColor: "#60a5fa",
        fontFamily:
          "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
        fontSize: "14px",
        lineHeight: "1.6",
      },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground":
        {
          backgroundColor: "rgba(96, 165, 250, 0.3)",
        },
      ".cm-gutters": {
        backgroundColor: "rgba(30, 41, 59, 0.8)",
        borderRight: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#94a3b8",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "rgba(96, 165, 250, 0.1)",
      },
      ".cm-activeLine": {
        backgroundColor: "rgba(96, 165, 250, 0.05)",
      },
    });

    // Create the merge view
    const mergeView = new MergeView({
      a: {
        doc: originalText,
        extensions: [
          bookZangDarkTheme,
          oneDark,
          keymap.of(defaultKeymap),
          EditorView.lineWrapping,
          // Make original pane read-only
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
        ],
      },
      b: {
        doc: cleanedText,
        extensions: [
          bookZangDarkTheme,
          oneDark,
          keymap.of(defaultKeymap),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const newText = update.state.doc.toString();
              debouncedOnChange(newText);
            }
          }),
        ],
      },
      parent: containerRef.current,
      // Configure diff behavior
      highlightChanges: true,
      gutter: true,
      // Line/paragraph-level diff by default (more readable for prose)
      collapseUnchanged: {
        margin: 3,
        minSize: 4,
      },
    });

    mergeViewRef.current = mergeView;
    cleanedViewRef.current = mergeView.b;

    return () => {
      mergeView.destroy();
      mergeViewRef.current = null;
      cleanedViewRef.current = null;
    };
  }, []); // Only run on mount

  // Update content when props change (but preserve editor state if possible)
  useEffect(() => {
    const mergeView = mergeViewRef.current;
    if (!mergeView) return;

    const cleanedView = mergeView.b;
    const originalView = mergeView.a;

    // Update cleaned text if different from current editor content
    const currentCleanedText = cleanedView.state.doc.toString();
    if (currentCleanedText !== cleanedText) {
      cleanedView.dispatch({
        changes: {
          from: 0,
          to: cleanedView.state.doc.length,
          insert: cleanedText,
        },
      });
    }

    // Update original text if different
    const currentOriginalText = originalView.state.doc.toString();
    if (currentOriginalText !== originalText) {
      originalView.dispatch({
        changes: {
          from: 0,
          to: originalView.state.doc.length,
          insert: originalText,
        },
      });
    }
  }, [originalText, cleanedText]);

  useEffect(() => {
    if (!focusRange) return;
    if (lastFocusKeyRef.current === focusRange.key) return;

    const cleanedView = cleanedViewRef.current;
    if (!cleanedView) return;

    const docLength = cleanedView.state.doc.length;
    const start = Math.max(0, Math.min(focusRange.startOffset, docLength));
    const end = Math.max(start, Math.min(focusRange.endOffset, docLength));

    cleanedView.dispatch({
      selection: { anchor: start, head: end },
      effects: EditorView.scrollIntoView(start, {
        y: "center",
      }),
    });
    cleanedView.focus();
    lastFocusKeyRef.current = focusRange.key;
  }, [focusRange]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden rounded-lg border border-white/10 ${className}`}
      style={{
        // Ensure the merge editor takes full height
        minHeight: "400px",
      }}
    />
  );
}
