import { query, mutation, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Default disclaimer text
const DEFAULT_DISCLAIMER = `This study guide is an independent companion resource. It does not contain the original copyrighted text of the work being studied. All summaries, analysis, and educational content are original creations.`;

// Template configurations for guide generation
type SectionDef = {
  type: string;
  title: string;
  required: boolean;
  perChapter?: boolean;
};

type TemplateConfig = {
  sections: SectionDef[];
};

const GUIDE_TEMPLATES: Record<string, TemplateConfig> = {
  high_school_study: {
    sections: [
      { type: "historical_background", title: "Historical Background", required: true },
      { type: "literary_context", title: "Literary Context", required: true },
      { type: "about_author", title: "About the Author", required: true },
      { type: "chapter_summary", title: "Chapter Summary", required: true, perChapter: true },
      { type: "character_analysis", title: "Character Analysis", required: true },
      { type: "theme_breakdown", title: "Themes & Analysis", required: true },
      { type: "discussion_questions", title: "Discussion Questions", required: true, perChapter: true },
      { type: "vocabulary_list", title: "Key Vocabulary", required: true },
      { type: "essay_prompts", title: "Essay Prompts", required: true },
    ],
  },
  teachers_edition: {
    sections: [
      { type: "historical_background", title: "Historical Background", required: true },
      { type: "literary_context", title: "Literary Context", required: true },
      { type: "about_author", title: "About the Author", required: true },
      { type: "chapter_summary", title: "Chapter Summary", required: true, perChapter: true },
      { type: "character_analysis", title: "Character Analysis", required: true },
      { type: "theme_breakdown", title: "Themes & Analysis", required: true },
      { type: "symbolism_guide", title: "Symbolism & Motifs", required: true },
      { type: "discussion_questions", title: "Discussion Questions (with Answers)", required: true, perChapter: true },
      { type: "essay_prompts", title: "Essay Prompts (with Rubrics)", required: true },
      { type: "vocabulary_list", title: "Vocabulary & Definitions", required: true },
    ],
  },
  exam_prep: {
    sections: [
      { type: "quick_summary", title: "Quick Summary", required: true },
      { type: "character_cheat_sheet", title: "Character Cheat Sheet", required: true },
      { type: "theme_matrix", title: "Themes at a Glance", required: true },
      { type: "quotation_bank", title: "Quotations to Remember", required: true },
      { type: "practice_essays", title: "Practice Essay Questions", required: true },
      { type: "chapter_summary", title: "Chapter Summaries", required: true, perChapter: true },
    ],
  },
  book_club: {
    sections: [
      { type: "about_author", title: "About the Author", required: true },
      { type: "historical_background", title: "Context & Background", required: true },
      { type: "quick_summary", title: "Book Summary", required: true },
      { type: "discussion_questions", title: "Discussion Questions", required: true },
      { type: "reflection_pages", title: "Reflection & Connection", required: true },
      { type: "theme_breakdown", title: "Major Themes", required: true },
    ],
  },
};

// Prompt templates for each section type
const SECTION_PROMPTS: Record<string, (bookTitle: string, bookAuthor: string, chapterTitle?: string) => string> = {
  about_author: (title, author) => `
Write an "About the Author" section for a study guide on "${title}" by ${author}.

Include:
- Brief biographical overview
- Author's major works and literary significance
- Historical context of when and why they wrote this book
- Their writing style and common themes

Write in an engaging, accessible style suitable for students. 300-400 words.`,

  historical_background: (title, author) => `
Write a "Historical Background" section for a study guide on "${title}" by ${author}.

Include:
- The era in which the book was written
- Major historical events that influenced the work
- Social and cultural context of the time
- How this context shapes the book's themes

Write for high school students. 300-400 words.`,

  literary_context: (title, author) => `
Write a "Literary Context" section for a study guide on "${title}" by ${author}.

Include:
- The literary movement or genre this work belongs to
- Influences on the author
- How this work fits into the author's body of work
- Literary significance and reception

Write for high school students. 250-350 words.`,

  chapter_summary: (title, author, chapterTitle) => `
Write a chapter summary for "${chapterTitle || 'this chapter'}" from "${title}" by ${author}.

Include:
- Main events and plot points
- Key character developments
- Important moments or revelations
- Connection to overall story arc

Write in present tense, clear and concise. 200-300 words.`,

  character_analysis: (title, author) => `
Write a "Character Analysis" section for a study guide on "${title}" by ${author}.

Include analysis of:
- The protagonist: their traits, motivations, and arc
- The antagonist or main opposing force
- 2-3 supporting characters and their roles
- Key relationships between characters
- How characters represent broader themes

Write for high school students. 400-500 words.`,

  theme_breakdown: (title, author) => `
Write a "Themes & Analysis" section for a study guide on "${title}" by ${author}.

Analyze 3-4 major themes:
- Name and define each theme
- Provide evidence from the text
- Explain the theme's significance
- Connect to modern relevance

Write in an analytical but accessible style. 400-500 words.`,

  symbolism_guide: (title, author) => `
Write a "Symbolism & Motifs" section for a study guide on "${title}" by ${author}.

Include:
- Major symbols in the work and their meanings
- Recurring motifs and their significance
- How symbols develop throughout the story
- Connections between symbols and themes

Provide specific examples. 300-400 words.`,

  discussion_questions: (title, author, chapterTitle) => `
Write 5 discussion questions for ${chapterTitle ? `"${chapterTitle}" from ` : ""}"${title}" by ${author}.

Requirements:
- Mix of comprehension, analysis, and opinion questions
- Questions should provoke deep thinking
- Avoid simple yes/no answers
- Connect to themes, characters, and author choices

Format as a numbered list.`,

  vocabulary_list: (title, author) => `
Create a vocabulary list for "${title}" by ${author}.

Include:
- 10-15 challenging or archaic words from the text
- Part of speech for each
- Definition in modern English
- Example sentence from or inspired by the book

Format as a clear list suitable for study.`,

  essay_prompts: (title, author) => `
Write 3 essay prompts for "${title}" by ${author}.

Requirements:
- Analytical, not summary-based
- Open-ended with room for interpretation
- Connect to themes, character development, or author choices
- Appropriate for high school level

Include brief guidance on what a strong response might address.`,

  reflection_pages: (title, author) => `
Write reflection prompts for "${title}" by ${author}.

Create 4-5 prompts that help readers:
- Connect the book to their own experiences
- Consider different perspectives
- Reflect on the book's message
- Think critically about their own values

Make them personal and thought-provoking.`,

  quick_summary: (title, author) => `
Write a concise summary of "${title}" by ${author}.

Include:
- Overall plot (without excessive detail)
- Main characters
- Central conflict
- Major themes
- Resolution

Aim for 150-200 words. This should give readers the gist without reading the book.`,

  character_cheat_sheet: (title, author) => `
Create a "Character Cheat Sheet" for "${title}" by ${author}.

For each major character include:
- Name and role
- 2-3 key traits
- Their main motivation
- Key relationships
- Important quote or moment

Format as a quick-reference table or list.`,

  theme_matrix: (title, author) => `
Create a "Themes at a Glance" matrix for "${title}" by ${author}.

Identify 3-4 themes and for each:
- Theme name
- Brief description
- Key evidence from text
- Characters involved
- Modern relevance

Format for quick study and review.`,

  quotation_bank: (title, author) => `
Create a "Quotations to Remember" list for "${title}" by ${author}.

Include 8-10 significant quotes:
- The quotation itself
- Who said it and in what context
- Why it's significant
- What theme or idea it illustrates

Choose quotes that are analysis-worthy.`,

  practice_essays: (title, author) => `
Write 3 practice essay questions for "${title}" by ${author}.

Requirements:
- Timed essay format (40-45 minutes)
- Clear thesis required
- Textual evidence needed
- Analytical depth expected

Include a brief outline of what an excellent response would cover.`,
};

// List all study guides for a book
export const listByBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const guides = await ctx.db
      .query("studyGuides")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .order("desc")
      .collect();

    return await Promise.all(
      guides.map(async (guide) => {
        const sections = await ctx.db
          .query("studyGuideSections")
          .withIndex("by_guide_id", (q) => q.eq("guideId", guide._id))
          .collect();

        return {
          ...guide,
          sectionCount: sections.length,
          completedSections: sections.filter((s) => s.status === "approved").length,
        };
      }),
    );
  },
});

// Get a single study guide with sections
export const get = query({
  args: { guideId: v.id("studyGuides") },
  handler: async (ctx, args) => {
    const guide = await ctx.db.get(args.guideId);
    if (!guide) return null;

    const sections = await ctx.db
      .query("studyGuideSections")
      .withIndex("by_guide_id_order", (q) => q.eq("guideId", args.guideId))
      .collect();

    const book = await ctx.db.get(guide.bookId);

    return {
      ...guide,
      sections,
      bookTitle: book?.title,
      bookAuthor: book?.author,
    };
  },
});

// Create a new study guide
export const create = mutation({
  args: {
    bookId: v.id("books"),
    title: v.string(),
    subtitle: v.optional(v.string()),
    guideType: v.optional(v.union(
      v.literal("study_guide"),
      v.literal("companion"),
      v.literal("workbook"),
      v.literal("exam_prep"),
      v.literal("teacher_edition"),
      v.literal("book_club"),
    )),
    targetAudience: v.optional(v.union(
      v.literal("middle_school"),
      v.literal("high_school"),
      v.literal("college"),
      v.literal("graduate"),
      v.literal("general_readers"),
      v.literal("book_club"),
      v.literal("educators"),
    )),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const guideId = await ctx.db.insert("studyGuides", {
      bookId: args.bookId,
      title: args.title,
      subtitle: args.subtitle,
      guideType: args.guideType,
      targetAudience: args.targetAudience,
      status: "draft",
      disclaimer: DEFAULT_DISCLAIMER,
      createdAt: now,
      updatedAt: now,
    });

    return guideId;
  },
});

// Create guide from template and start generation
export const createFromTemplate = mutation({
  args: {
    bookId: v.id("books"),
    templateId: v.union(
      v.literal("high_school_study"),
      v.literal("teachers_edition"),
      v.literal("exam_prep"),
      v.literal("book_club"),
    ),
    customTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    const template = GUIDE_TEMPLATES[args.templateId];
    const guideType = args.templateId === "high_school_study" ? "study_guide" :
                      args.templateId === "teachers_edition" ? "teacher_edition" :
                      args.templateId === "exam_prep" ? "exam_prep" : "book_club";

    // Generate default title if not provided
    const title = args.customTitle || `${book.title}: ${
      args.templateId === "high_school_study" ? "A Study Guide" :
      args.templateId === "teachers_edition" ? "Teacher's Edition" :
      args.templateId === "exam_prep" ? "Exam Prep Companion" : "Book Club Guide"
    }`;

    const guideId = await ctx.db.insert("studyGuides", {
      bookId: args.bookId,
      title,
      guideType,
      targetAudience: args.templateId === "teachers_edition" ? "educators" : "high_school",
      status: "generating",
      disclaimer: DEFAULT_DISCLAIMER,
      generationMethod: "ai_assisted",
      createdAt: now,
      updatedAt: now,
    });

    // Count total sections needed
    const chapters = await ctx.db
      .query("cleanupChapters")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();

    let totalSections = 0;
    for (const section of template.sections) {
      if (section.perChapter) {
        totalSections += chapters.length || 1;
      } else {
        totalSections += 1;
      }
    }

    // Create generation job
    const jobId = await ctx.db.insert("guideGenerationJobs", {
      bookId: args.bookId,
      guideId,
      stage: "queued",
      totalSections,
      completedSections: 0,
      queuedAt: now,
    });

    // Schedule generation
    await ctx.scheduler.runAfter(0, internal.studyGuides.generateGuide, {
      jobId,
      guideId,
      bookId: args.bookId,
      templateId: args.templateId,
    });

    return { guideId, jobId };
  },
});

// Update guide metadata
export const update = mutation({
  args: {
    guideId: v.id("studyGuides"),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("generating"),
      v.literal("review_pending"),
      v.literal("published"),
    )),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: any = {};
    
    if (args.title !== undefined) updates.title = args.title;
    if (args.subtitle !== undefined) updates.subtitle = args.subtitle;
    if (args.status !== undefined) updates.status = args.status;
    updates.updatedAt = now;

    if (args.status === "published") {
      updates.publishedAt = now;
    }

    await ctx.db.patch(args.guideId, updates);
    return args.guideId;
  },
});

// Delete a guide and all its sections
export const deleteGuide = mutation({
  args: { guideId: v.id("studyGuides") },
  handler: async (ctx, args) => {
    // Delete all sections
    const sections = await ctx.db
      .query("studyGuideSections")
      .withIndex("by_guide_id", (q) => q.eq("guideId", args.guideId))
      .collect();

    for (const section of sections) {
      await ctx.db.delete(section._id);
    }

    // Delete generation job if exists
    const jobs = await ctx.db
      .query("guideGenerationJobs")
      .withIndex("by_guide_id", (q) => q.eq("guideId", args.guideId))
      .collect();

    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }

    // Delete guide
    await ctx.db.delete(args.guideId);
    return { success: true };
  },
});

// Add or update a section
export const updateSection = mutation({
  args: {
    guideId: v.id("studyGuides"),
    sectionType: v.union(
      v.literal("about_author"),
      v.literal("historical_background"),
      v.literal("literary_context"),
      v.literal("chapter_summary"),
      v.literal("character_analysis"),
      v.literal("theme_breakdown"),
      v.literal("symbolism_guide"),
      v.literal("vocabulary_list"),
      v.literal("discussion_questions"),
      v.literal("essay_prompts"),
      v.literal("reflection_pages"),
      v.literal("quick_summary"),
      v.literal("character_cheat_sheet"),
      v.literal("theme_matrix"),
      v.literal("practice_essays"),
      v.literal("quotation_bank"),
    ),
    chapterId: v.optional(v.id("cleanupChapters")),
    order: v.number(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if section exists
    const existing = await ctx.db
      .query("studyGuideSections")
      .withIndex("by_guide_id", (q) => q.eq("guideId", args.guideId))
      .filter((q) => 
        q.eq(q.field("sectionType"), args.sectionType) &&
        (args.chapterId ? q.eq(q.field("chapterId"), args.chapterId) : q.eq(q.field("chapterId"), undefined))
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        content: args.content,
        updatedAt: now,
        humanEdited: true,
      });
      return existing._id;
    } else {
      const sectionId = await ctx.db.insert("studyGuideSections", {
        guideId: args.guideId,
        sectionType: args.sectionType,
        chapterId: args.chapterId,
        order: args.order,
        title: args.title,
        content: args.content,
        contentFormat: "markdown",
        humanEdited: true,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      return sectionId;
    }
  },
});

// Get generation job status
export const getGenerationStatus = query({
  args: { guideId: v.id("studyGuides") },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("guideGenerationJobs")
      .withIndex("by_guide_id", (q) => q.eq("guideId", args.guideId))
      .first();

    return job;
  },
});

// Internal: Generate guide using AI
export const generateGuide = internalAction({
  args: {
    jobId: v.id("guideGenerationJobs"),
    guideId: v.id("studyGuides"),
    bookId: v.id("books"),
    templateId: v.union(
      v.literal("high_school_study"),
      v.literal("teachers_edition"),
      v.literal("exam_prep"),
      v.literal("book_club"),
    ),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const logs: string[] = [`[${new Date().toISOString()}] Starting guide generation`];

    try {
      // Get book info (using runMutation since we defined them as mutations)
      const book = await ctx.runMutation(internal.studyGuides.getBookInfoQuery, { bookId: args.bookId });
      if (!book) {
        throw new Error("Book not found");
      }

      await ctx.runMutation(internal.studyGuides.updateGenerationProgress, {
        jobId: args.jobId,
        stage: "analyzing_book",
        logs,
      });

      // Get chapters for per-chapter sections
      const chapters = await ctx.runMutation(internal.studyGuides.getBookChaptersQuery, { bookId: args.bookId });
      logs.push(`Found ${chapters.length} chapters`);

      const template = GUIDE_TEMPLATES[args.templateId];
      let completedSections = 0;
      let order = 0;

      await ctx.runMutation(internal.studyGuides.updateGenerationProgress, {
        jobId: args.jobId,
        stage: "generating_sections",
        logs,
      });

      // Generate each section
      for (const sectionDef of template.sections) {
        if ((sectionDef as SectionDef).perChapter && chapters.length > 0) {
          // Generate for each chapter
          for (const chapter of chapters) {
            order++;
            const prompt = SECTION_PROMPTS[sectionDef.type](book.title, book.author, chapter.title);
            
            await ctx.runMutation(internal.studyGuides.updateGenerationProgress, {
              jobId: args.jobId,
              currentSection: `${sectionDef.title} - ${chapter.title}`,
              logs: [...logs, `Generating: ${sectionDef.title} - ${chapter.title}`],
            });

            // Call AI service (placeholder - integrate with your preferred LLM)
            const content = await generateWithAI(prompt);

            await ctx.runMutation(internal.studyGuides.markSectionGenerated, {
              guideId: args.guideId,
              sectionType: sectionDef.type,
              chapterId: chapter._id,
              order,
              title: `${sectionDef.title}: ${chapter.title}`,
              content,
            });

            completedSections++;
            const progress = Math.round((completedSections / template.sections.length) * 100);
            
            await ctx.runMutation(internal.studyGuides.updateGenerationProgress, {
              jobId: args.jobId,
              completedSections,
              progress,
            });
          }
        } else {
          // Generate single section
          order++;
          const prompt = SECTION_PROMPTS[sectionDef.type](book.title, book.author);
          
          await ctx.runMutation(internal.studyGuides.updateGenerationProgress, {
            jobId: args.jobId,
            currentSection: sectionDef.title,
            logs: [...logs, `Generating: ${sectionDef.title}`],
          });

          // Call AI service (placeholder)
          const content = await generateWithAI(prompt);

          await ctx.runMutation(internal.studyGuides.markSectionGenerated, {
            guideId: args.guideId,
            sectionType: sectionDef.type,
            order,
            title: sectionDef.title,
            content,
          });

          completedSections++;
          const progress = Math.round((completedSections / template.sections.length) * 100);
          
          await ctx.runMutation(internal.studyGuides.updateGenerationProgress, {
            jobId: args.jobId,
            completedSections,
            progress,
          });
        }
      }

      logs.push(`[${new Date().toISOString()}] Generation complete in ${Date.now() - startTime}ms`);
      
      await ctx.runMutation(internal.studyGuides.updateGenerationProgress, {
        jobId: args.jobId,
        logs,
      });

      await ctx.runMutation(internal.studyGuides.markGenerationComplete, {
        jobId: args.jobId,
        guideId: args.guideId,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logs.push(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
      
      await ctx.runMutation(internal.studyGuides.markGenerationFailed, {
        jobId: args.jobId,
        guideId: args.guideId,
        error: errorMsg,
      });
    }
  },
});

// Placeholder for AI generation - replace with actual LLM integration
async function generateWithAI(prompt: string): Promise<string> {
  // TODO: Integrate with OpenAI, Anthropic, or other LLM
  // This is a placeholder that returns a mock response
  
  // For now, return placeholder content
  return `# ${prompt.split('\n')[0]}

*[This is AI-generated placeholder content. Integrate with your preferred LLM API (OpenAI, Anthropic, etc.) to generate actual content.]*

## Key Points

- This section would contain AI-generated analysis
- Based on the book's content and the specific prompt
- Written for the target audience (students, teachers, etc.)

## Placeholder

The actual implementation should:
1. Call your LLM API with the prompt
2. Parse and clean the response
3. Return formatted markdown content

Prompt preview:\`\`\`
${prompt.slice(0, 200)}...
\`\`\``;
}

// Internal: Get book info for generation (query version for internalAction)
export const getBookInfoQuery = internalMutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const book = await ctx.db.get(args.bookId);
    return book ? { title: book.title, author: book.author } : null;
  },
});

// Internal: Get chapters for generation (query version for internalAction)
export const getBookChaptersQuery = internalMutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const chapters = await ctx.db
      .query("cleanupChapters")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .order("asc")
      .collect();
    
    return chapters.map(c => ({ _id: c._id, title: c.title, chapterNumber: c.chapterNumber }));
  },
});

// Internal: Mark section as generated
export const markSectionGenerated = internalMutation({
  args: {
    guideId: v.id("studyGuides"),
    sectionType: v.string(),
    chapterId: v.optional(v.id("cleanupChapters")),
    order: v.number(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("studyGuideSections", {
      guideId: args.guideId,
      sectionType: args.sectionType as any,
      chapterId: args.chapterId,
      order: args.order,
      title: args.title,
      content: args.content,
      contentFormat: "markdown",
      aiGenerated: true,
      humanEdited: false,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Internal: Update generation progress
export const updateGenerationProgress = internalMutation({
  args: {
    jobId: v.id("guideGenerationJobs"),
    stage: v.optional(v.string()),
    completedSections: v.optional(v.number()),
    currentSection: v.optional(v.string()),
    progress: v.optional(v.number()),
    logs: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.stage) updates.stage = args.stage;
    if (args.completedSections !== undefined) updates.completedSections = args.completedSections;
    if (args.currentSection) updates.currentSection = args.currentSection;
    if (args.progress !== undefined) updates.progress = args.progress;
    if (args.logs) updates.logs = args.logs;

    await ctx.db.patch(args.jobId, updates);
  },
});

// Internal: Mark generation complete
export const markGenerationComplete = internalMutation({
  args: {
    jobId: v.id("guideGenerationJobs"),
    guideId: v.id("studyGuides"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.jobId, {
      stage: "completed",
      progress: 100,
      completedAt: now,
    });

    await ctx.db.patch(args.guideId, {
      status: "review_pending",
      updatedAt: now,
    });
  },
});

// Internal: Mark generation failed
export const markGenerationFailed = internalMutation({
  args: {
    jobId: v.id("guideGenerationJobs"),
    guideId: v.id("studyGuides"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.jobId, {
      stage: "failed",
      failedAt: now,
      error: args.error,
    });

    await ctx.db.patch(args.guideId, {
      status: "draft",
      updatedAt: now,
    });
  },
});
