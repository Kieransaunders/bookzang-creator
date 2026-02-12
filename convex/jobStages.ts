import { v } from "convex/values";

export const mainJobStageValidator = v.union(
  // Import stages
  v.literal("queued"),
  v.literal("loading_file"),
  v.literal("parsing_metadata"),
  v.literal("persisting_metadata"),
  // Deterministic cleanup stages
  v.literal("loading_original"),
  v.literal("boilerplate_removal"),
  v.literal("paragraph_unwrap"),
  v.literal("chapter_detection"),
  v.literal("punctuation_normalization"),
  // AI cleanup stages
  v.literal("ai_chunking"),
  v.literal("ai_processing"),
  v.literal("ai_applying_patches"),
  // Completion stages
  v.literal("completed"),
  v.literal("failed"),
);

export const deterministicCleanupStageValidator = v.union(
  v.literal("queued"),
  v.literal("loading_original"),
  v.literal("boilerplate_removal"),
  v.literal("paragraph_unwrap"),
  v.literal("chapter_detection"),
  v.literal("punctuation_normalization"),
  v.literal("completed"),
  v.literal("failed"),
);

export const aiCleanupStageValidator = v.union(
  v.literal("queued"),
  v.literal("ai_chunking"),
  v.literal("ai_processing"),
  v.literal("ai_applying_patches"),
  v.literal("completed"),
  v.literal("failed"),
);

export const cleanupJobStageValidator = v.union(
  v.literal("queued"),
  v.literal("loading_original"),
  v.literal("boilerplate_removal"),
  v.literal("paragraph_unwrap"),
  v.literal("chapter_detection"),
  v.literal("punctuation_normalization"),
  v.literal("ai_chunking"),
  v.literal("ai_processing"),
  v.literal("ai_applying_patches"),
  v.literal("completed"),
  v.literal("failed"),
);

type DeterministicCleanupStage =
  | "queued"
  | "loading_original"
  | "boilerplate_removal"
  | "paragraph_unwrap"
  | "chapter_detection"
  | "punctuation_normalization"
  | "completed"
  | "failed";

type MainJobCompatibilityStage =
  | "queued"
  | "loading_file"
  | "parsing_metadata"
  | "persisting_metadata"
  | "completed"
  | "failed";

export const mapDeterministicCleanupStageToMainJobStage = (
  stage: DeterministicCleanupStage,
): MainJobCompatibilityStage => {
  switch (stage) {
    case "queued":
      return "queued";
    case "loading_original":
      return "loading_file";
    case "boilerplate_removal":
    case "paragraph_unwrap":
      return "parsing_metadata";
    case "chapter_detection":
    case "punctuation_normalization":
      return "persisting_metadata";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
  }
};
