# Copyright AI Integration Plan

**Created:** 2026-02-13
**Purpose:** Integrate Kimi K2 AI for UK copyright research into BookZang intake pipeline

## Architecture Overview

Three-stage copyright verification:

1. **Header scan** - Detect permission/copyright warnings in Gutenberg headers
2. **AI research** - Kimi K2 researches contributor death dates
3. **Assessment** - Calculate UK copyright status (Death + 70 years)

## Implementation Tasks

### Backend Infrastructure

- [x] Create `convex/copyrightPrompts.ts` - Zod schemas and prompts
  - [x] Contributor schema (name, role, deathYear, confidence, source)
  - [x] CopyrightAssessment schema (status, reason, calculations)
  - [x] CopyrightResearchResponse schema
  - [x] System prompt with UK copyright rules
  - [x] Validation functions

- [x] Create `convex/copyrightAiClient.ts` - Kimi K2 client
  - [x] CopyrightAiClient interface
  - [x] Kimi K2 implementation
  - [x] Mock client for dev/testing
  - [x] Header scanning for warnings

- [x] Create `convex/copyrightAi.ts` - Internal actions
  - [x] `researchCopyright` action - Main research flow
  - [x] `scanHeader` action - Quick warning detection
  - [x] Store research results mutations
  - [x] Manual override mutation

- [x] Update `convex/schema.ts`
  - [x] Add `copyrightStatus` to books table
  - [x] Create `copyrightChecks` table with:
    - [x] Contributor data
    - [x] Assessment results
    - [x] Header analysis
    - [x] Audit trail (manual overrides)

### Pipeline Integration

- [x] Update `convex/intakeMetadata.ts`
  - [x] Trigger copyright scan after metadata extraction
  - [x] Schedule `researchCopyright` action
  - [x] Update book status to "checking"

### Frontend Components

- [x] Create copyright status utilities (`src/lib/copyrightStatus.ts`)
  - [x] Status labels and descriptions
  - [x] Badge color classes
  - [x] Status icons

- [x] Create `CopyrightStatusBadge` component
  - [x] Visual badge with icon
  - [x] Hover tooltip with description
  - [x] Color-coded by status

## Status Key

- `unknown` - Not yet researched or research failed
- `checking` - Research in progress
- `cleared` - All contributors died 100+ years ago (safe buffer)
- `flagged` - Within copyright term or unknown dates (needs review)
- `blocked` - Contributor died <70 years ago (in copyright)

## Environment Variables

Uses existing Kimi configuration:

- `KIMI_API_KEY` - API key
- `KIMI_BASE_URL` - Endpoint (default: https://api.moonshot.cn/v1)
- `KIMI_MODEL` - Model ID (default: kimi-k2-0710-preview)

## Files Created/Modified

**New files:**

- `convex/copyrightPrompts.ts` - Zod schemas and prompts
- `convex/copyrightAiClient.ts` - Kimi K2 client adapter
- `convex/copyrightAi.ts` - Internal actions and mutations
- `src/lib/copyrightStatus.ts` - Status utilities
- `src/components/CopyrightStatusBadge.tsx` - Badge component

**Modified files:**

- `convex/schema.ts` - Added copyrightStatus and copyrightChecks table
- `convex/intakeMetadata.ts` - Triggers copyright research after import

## Next Steps (Optional Enhancements)

- [ ] Add copyright column to DiscoveryCandidates table
- [ ] Create manual copyright research trigger button
- [ ] Build copyright details modal with contributor list
- [ ] Add manual override form with audit trail
- [ ] Export copyright report for compliance
