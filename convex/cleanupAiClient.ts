/**
 * AI Cleanup Client Adapter - Kimi K2 Provider
 * 
 * Provider-adapter boundary for Kimi K2 endpoint/model wiring.
 * Environment-driven configuration allows endpoint/model swaps without
 * rewriting cleanup logic.
 * 
 * Requirements:
 * - KIMI_API_KEY: API key from Kimi provider dashboard
 * - KIMI_BASE_URL: Kimi API endpoint (e.g., https://api.moonshot.cn/v1)
 * - KIMI_MODEL: Model ID (e.g., kimi-k2-0710-preview)
 */

import OpenAI from "openai";
import { z } from "zod";
import { CleanupPatchSchema, CleanupResponseSchema, type CleanupPatch, type CleanupResponse } from "./cleanupPrompts";

// Re-export types for backward compatibility
export type { CleanupPatch, CleanupResponse };

/**
 * Configuration for the AI cleanup client
 */
export interface CleanupAiConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Client interface for AI cleanup operations
 */
export interface CleanupAiClient {
  /**
   * Request cleanup patches for a text segment
   * 
   * @param text - The text to clean up
   * @param context - Optional context about the text (chapter info, etc.)
   * @returns Validated cleanup response with patches
   */
  requestCleanupPatches(
    text: string,
    context?: {
      chapterTitle?: string;
      chapterNumber?: number;
      totalChapters?: number;
      previousContext?: string;
      nextContext?: string;
    }
  ): Promise<CleanupResponse>;

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean;
}

/**
 * Create a cleanup AI client from environment configuration
 * 
 * Falls back to mock client if environment variables are not set
 */
export function createCleanupAiClient(config?: Partial<CleanupAiConfig>): CleanupAiClient {
  const apiKey = config?.apiKey || process.env.KIMI_API_KEY || "";
  const baseURL = config?.baseURL || process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1";
  const model = config?.model || process.env.KIMI_MODEL || "kimi-k2-0710-preview";

  if (!apiKey) {
    console.warn("KIMI_API_KEY not set, using mock AI client");
    return createMockCleanupAiClient();
  }

  return createKimiCleanupAiClient({ apiKey, baseURL, model, ...config });
}

/**
 * Kimi K2 implementation of the cleanup AI client
 */
function createKimiCleanupAiClient(config: CleanupAiConfig): CleanupAiClient {
  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    maxRetries: 3,
    timeout: 120000, // 2 minute timeout for large text chunks
  });

  return {
    isConfigured: () => true,

    async requestCleanupPatches(text, context): Promise<CleanupResponse> {
      const systemPrompt = `You are an expert text preservation editor specializing in public domain literature cleanup.

## Your Task
Analyze the provided text and suggest specific edits to improve OCR errors and punctuation while STRICTLY preserving the original author's voice, spelling, and grammar.

## Critical Preservation Rules
1. NEVER modernize archaic spelling (e.g., "to-day" → keep as "to-day", not "today")
2. NEVER modernize archaic grammar (e.g., "thou hast" → keep as "thou hast")
3. NEVER change dialect or regional language patterns
4. NEVER rewrite sentences for "clarity" - preserve original phrasing
5. PRESERVE original hyphenation at line breaks (remove hyphens, join words)

## What You MAY Fix (with confidence rating)
- OCR errors: garbled characters, misrecognized letters (high confidence only)
- Punctuation normalization: standardize quotes, fix spacing around punctuation
- Obvious typos: "teh" → "the", doubled words like "the the"
- Line-ending hyphenation: remove and join words

## Confidence Guidelines
- HIGH: Clear OCR error with unambiguous correction (e.g., "1ove" → "love")
- LOW: Any uncertainty, stylistic choice, or potentially intentional spelling

## Output Format
Return a JSON object with:
- patches: array of edit objects with start/end offsets, original/replacement text, confidence level, and reason
- summary: brief description of changes
- preservationNotes: list of archaic elements intentionally preserved

If no changes are needed, return empty patches array.`;

      const userPrompt = buildUserPrompt(text, context);

      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: config.temperature ?? 0.1, // Low temperature for consistent, conservative edits
        max_tokens: config.maxTokens ?? 4096,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from Kimi API");
      }

      // Parse and validate response
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        throw new Error(`Failed to parse AI response as JSON: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Validate with zod schema
      const validated = CleanupResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error(`AI response validation failed: ${validated.error.message}`);
      }

      // Additional validation: verify offsets are within text bounds
      const validatedPatches = validated.data.patches.filter(patch => {
        if (patch.start < 0 || patch.end > text.length || patch.start > patch.end) {
          console.warn(`Invalid patch offsets: ${patch.start}-${patch.end} for text length ${text.length}`);
          return false;
        }
        // Verify original text matches
        const actualOriginal = text.slice(patch.start, patch.end);
        if (actualOriginal !== patch.original) {
          console.warn(`Patch original text mismatch at ${patch.start}-${patch.end}: expected "${patch.original}", found "${actualOriginal}"`);
          return false;
        }
        return true;
      });

      return {
        ...validated.data,
        patches: validatedPatches,
      };
    },
  };
}

/**
 * Mock client for development/testing when API key is not available
 */
function createMockCleanupAiClient(): CleanupAiClient {
  return {
    isConfigured: () => false,

    async requestCleanupPatches(): Promise<CleanupResponse> {
      // Return empty patches - no AI changes in mock mode
      console.log("Mock AI client: returning no patches (API key not configured)");
      return {
        patches: [],
        summary: "Mock mode: no AI cleanup performed (KIMI_API_KEY not set)",
        preservationNotes: ["All text preserved in mock mode"],
        stats: {
          highConfidencePatches: 0,
          lowConfidencePatches: 0,
          ocrErrorsFixed: 0,
          punctuationNormalizations: 0,
        },
      };
    },
  };
}

/**
 * Build user prompt with context
 */
function buildUserPrompt(
  text: string,
  context?: {
    chapterTitle?: string;
    chapterNumber?: number;
    totalChapters?: number;
    previousContext?: string;
    nextContext?: string;
  }
): string {
  let prompt = "Please analyze the following text and suggest cleanup edits.\n\n";

  if (context?.chapterTitle) {
    prompt += `Chapter: ${context.chapterTitle}\n`;
  }
  if (context?.chapterNumber && context?.totalChapters) {
    prompt += `Chapter ${context.chapterNumber} of ${context.totalChapters}\n`;
  }

  if (context?.previousContext) {
    prompt += `\n--- Previous Context (for reference only) ---\n${context.previousContext.slice(-200)}\n---\n`;
  }

  prompt += `\n--- TEXT TO ANALYZE ---\n${text}\n--- END TEXT ---\n`;

  if (context?.nextContext) {
    prompt += `\n--- Following Context (for reference only) ---\n${context.nextContext.slice(0, 200)}\n---\n`;
  }

  prompt += "\nRespond with a JSON object containing patches, summary, and preservationNotes.";

  return prompt;
}
