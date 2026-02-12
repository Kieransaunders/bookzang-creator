# BookZang - Internal Content Production Tool

> **⚠️ INTERNAL TOOL**: BookZang is a **content production pipeline**, not a SaaS product. It is used internally to process public domain books (primarily from Project Gutenberg) into various publishable formats for sale on Amazon KDP, Audible, Gumroad, and other platforms.

## What It Does

BookZang is an internal dashboard for managing the ingestion, cleaning, and export of public domain books:

1. **Library Intake** - Import books from Project Gutenberg or upload files
2. **Job Processing** - Clean and format books (strip headers/footers, normalize text)
3. **Templates** - Apply professional formatting templates for PDF export
4. **Export** - Generate publishable files for various platforms

## Tech Stack

Built with [Chef](https://chef.convex.dev) using [Convex](https://convex.dev) as its backend.

**Frontend**: Vite + React + Tailwind CSS + Liquid Glass UI  
**Backend**: Convex (serverless functions + database)  
**Auth**: Convex Auth with Anonymous sign-in

## Project Structure

```
src/           # Frontend React components
convex/        # Backend Convex functions (queries, mutations, actions)
```

## Development

```bash
npm run dev    # Starts both frontend and backend
```

## Deployment

Connected to Convex deployment: [`knowing-malamute-729`](https://dashboard.convex.dev/d/knowing-malamute-729)

See [Convex Hosting & Deployment docs](https://docs.convex.dev/production/)

## HTTP API

User-defined http routes are defined in `convex/router.ts` (separate from `convex/http.ts` for auth safety).

---

## Revenue Strategy

See [`Project docs/ideas.md`](./Project%20docs/ideas.md) for output-based revenue streams - products that can be generated from this tool and sold.

**Quick Summary**:
- 📚 Published books (Amazon KDP, IngramSpark)
- 🎧 Audiobooks (Audible, Apple Books)
- 📝 Study guides & companion books
- 📖 Curated collections & box sets
- 📱 Digital bundles & subscriptions
- 🎓 Educational licensing
- 🤖 Clean text datasets for AI training

---

*Internal tool - not for public use*
