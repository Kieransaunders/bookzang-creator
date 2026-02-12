import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("templates").collect();
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("templates").collect();
    if (existing.length > 0) return;

    await ctx.db.insert("templates", {
      name: "Classic",
      description: "Traditional book layout with serif fonts and standard margins",
      preview: "Aa",
      settings: {
        fontSize: 12,
        lineHeight: 1.5,
        margins: { top: 1, bottom: 1, left: 1, right: 1 },
      },
    });

    await ctx.db.insert("templates", {
      name: "Modern",
      description: "Clean, contemporary design with sans-serif fonts",
      preview: "Aa",
      settings: {
        fontSize: 11,
        lineHeight: 1.4,
        margins: { top: 0.8, bottom: 0.8, left: 0.8, right: 0.8 },
      },
    });

    await ctx.db.insert("templates", {
      name: "Large Print",
      description: "Accessibility-focused with larger text and generous spacing",
      preview: "Aa",
      settings: {
        fontSize: 16,
        lineHeight: 1.8,
        margins: { top: 1.2, bottom: 1.2, left: 1.2, right: 1.2 },
      },
    });
  },
});
