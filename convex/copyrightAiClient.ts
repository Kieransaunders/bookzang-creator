/**
 * AI Copyright Research Client Adapter - Kimi K2 Provider
 *
 * Provider-adapter boundary for Kimi K2 endpoint/model wiring.
 * Uses the same environment configuration as cleanup AI.
 */

import OpenAI from "openai";
import {
  COPYRIGHT_RESEARCH_SYSTEM_PROMPT,
  buildCopyrightResearchPrompt,
  validateCopyrightResponse,
  calculateCopyrightStatus,
  extractHeaderSection,
  checkHeaderWarnings,
  type CopyrightResearchResponse,
  type Contributor,
} from "./copyrightPrompts";

// Re-export types for backward compatibility
export type { CopyrightResearchResponse, Contributor };

/**
 * Configuration for the copyright research AI client
 */
export interface CopyrightAiConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Client interface for copyright research operations
 */
export interface CopyrightAiClient {
  /**
   * Research copyright status for a book
   *
   * @param text - The full text of the book (header will be extracted)
   * @param metadata - Book metadata (title, author, gutenbergId)
   * @returns Validated copyright research response
   */
  researchCopyright(
    text: string,
    metadata: {
      title?: string;
      author?: string;
      gutenbergId?: string;
    },
  ): Promise<CopyrightResearchResponse>;

  /**
   * Quick header scan for warning flags
   *
   * @param text - The full text of the book
   * @returns Array of warning messages found
   */
  scanHeaderForWarnings(text: string): string[];

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean;
}

/**
 * Create a copyright research AI client from environment configuration
 *
 * Requires KIMI_API_KEY to be set - throws error if not configured
 */
export function createCopyrightAiClient(
  config?: Partial<CopyrightAiConfig>,
): CopyrightAiClient {
  const apiKey = config?.apiKey || process.env.KIMI_API_KEY || "";
  const baseURL =
    config?.baseURL ||
    process.env.KIMI_BASE_URL ||
    "https://api.moonshot.cn/v1";
  const model =
    config?.model || process.env.KIMI_MODEL || "kimi-k2-0710-preview";

  if (!apiKey) {
    throw new Error(
      "KIMI_API_KEY not configured. Set it in .env.local to enable copyright research.",
    );
  }

  return createKimiCopyrightAiClient({ apiKey, baseURL, model, ...config });
}

/**
 * Kimi K2 implementation of the copyright research AI client
 */
function createKimiCopyrightAiClient(
  config: CopyrightAiConfig,
): CopyrightAiClient {
  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    maxRetries: 3,
    timeout: 120000, // 2 minute timeout for research
  });

  return {
    isConfigured: () => true,

    async researchCopyright(
      text,
      metadata,
    ): Promise<CopyrightResearchResponse> {
      const headerText = extractHeaderSection(text);
      const userPrompt = buildCopyrightResearchPrompt(headerText, metadata);

      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: COPYRIGHT_RESEARCH_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: config.temperature ?? 0.2, // Slightly higher for research flexibility
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
        throw new Error(
          `Failed to parse AI response as JSON: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      // Validate with zod schema
      const validated = validateCopyrightResponse(parsed);
      if (!validated.success) {
        throw new Error(`AI response validation failed: ${validated.error}`);
      }

      // Recalculate assessment to ensure consistency
      const recalculatedAssessment = calculateCopyrightStatus(
        validated.data.contributors,
      );

      return {
        ...validated.data,
        assessment: recalculatedAssessment,
      };
    },

    scanHeaderForWarnings(text: string): string[] {
      const headerText = extractHeaderSection(text);
      return checkHeaderWarnings(headerText);
    },
  };
}
