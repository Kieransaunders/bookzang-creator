---
phase: 03-typography-templates-and-kdp-interior-export
plan: 04b
type: execute
wave: 5
depends_on: ["03-04a"]
files_modified:
  - src/components/interiors/GenerateInteriorButton.tsx
  - src/components/interiors/GenerationProgress.tsx
  - src/components/interiors/InteriorArtifacts.tsx
  - src/components/interiors/DownloadInterior.tsx
  - src/components/interiors/InteriorManager.tsx
autonomous: true
must_haves:
  truths:
    - "Generation progress visible with real-time updates"
    - "Completed interiors show compliance badge and download button"
    - "Previous generations stored in version history"
    - "User can download stored interior artifacts"
  artifacts:
    - path: "src/components/interiors/GenerateInteriorButton.tsx"
      provides: "Trigger generation flow with validation"
    - path: "src/components/interiors/GenerationProgress.tsx"
      provides: "Real-time generation status display"
    - path: "src/components/interiors/InteriorArtifacts.tsx"
      provides: "Version history of generated interiors"
    - path: "src/components/interiors/DownloadInterior.tsx"
      provides: "Download handler with usage tracking"
  key_links:
    - from: "GenerateInteriorButton"
      to: "api.interiors.generate"
      via: "useMutation hook triggering action"
      pattern: "useMutation\\(api.interiors.generate"
    - from: "GenerationProgress"
      to: "api.bookInteriors.getById"
      via: "useQuery polling for status updates"
      pattern: "useQuery\\(api.bookInteriors.getById"
    - from: "InteriorArtifacts"
      to: "api.bookInteriors.listByBook"
      via: "useQuery for interior history"
    - from: "DownloadInterior"
      to: "api.bookInteriors.getDownloadUrl"
      via: "fetch mutation for temporary URL"
---

# Plan 03-04b: Generation Flow & Artifact Management

## Goal
Build the generation trigger, progress tracking, and artifact download UI.

## Tasks

<task type="auto">
  <name>Task 1: Create GenerateInteriorButton component</name>
  <files>src/components/interiors/GenerateInteriorButton.tsx</files>
  <action>
    Create GenerateInteriorButton component:
    
    Props:
    - bookId: string
    - templateId: string
    - config: TemplateConfig (customized)
    - onStarted: () => void
    
    Flow:
    1. Validate book has approved text (Phase 2 gate)
    2. Create bookInterior record via templates:applyToBook
    3. Trigger interiors:generate action
    4. Call onStarted to switch to progress view
    
    States:
    - Default: "Generate Interior"
    - Loading: Spinner with "Starting..."
    - Disabled: If no approved text
  </action>
  <verify>Run `npm run lint`, test click creates bookInterior and triggers generation</verify>
  <done>Button creates record and starts generation, shows loading state</done>
</task>

<task type="auto">
  <name>Task 2: Create GenerationProgress component</name>
  <files>src/components/interiors/GenerationProgress.tsx</files>
  <action>
    Create GenerationProgress component:
    
    Props:
    - bookInteriorId: string
    - onComplete: () => void
    
    Features:
    - Poll bookInterior status via useQuery(api.bookInteriors.getById)
    - Show status: "Queued" → "Generating PDF" → "Validating" → "Complete" | "Failed"
    - Progress bar (indeterminate while generating)
    - Auto-refresh every 2 seconds while not completed/failed
    - Error display with message if failed
    - Call onComplete when status is "completed"
  </action>
  <verify>Run `npm run lint`, simulate status changes, verify UI updates</verify>
  <done>Progress updates in real-time, shows correct status and errors</done>
</task>

<task type="auto">
  <name>Task 3: Create InteriorArtifacts list component</name>
  <files>src/components/interiors/InteriorArtifacts.tsx</files>
  <action>
    Create InteriorArtifacts component:
    
    Props:
    - bookId: string
    - onRegenerate: (config: TemplateConfig) => void
    
    Features:
    - Query bookInteriors via useQuery(api.bookInteriors.listByBook)
    - Display list of generated interiors (newest first)
    - Each card shows:
      * Template name + trim size badge
      * Page count
      * Compliance badge (✅ green / ❌ red)
      * Created date
      * Download button (disabled if validation failed)
      * "Use this config" button to regenerate
    - Empty state: "No interiors generated yet"
  </action>
  <verify>Run `npm run lint`, test with mock interior data</verify>
  <done>List displays interiors with correct badges and actions</done>
</task>

<task type="auto">
  <name>Task 4: Create DownloadInterior component</name>
  <files>src/components/interiors/DownloadInterior.tsx, convex/bookInteriors.ts</files>
  <action>
    Create DownloadInterior component and backend support:
    
    Component:
    - Props: interiorId, fileName
    - On click: call getDownloadUrl mutation
    - Create temporary anchor element to trigger download
    - Call recordDownload mutation after successful download
    
    Backend (convex/bookInteriors.ts):
    - getDownloadUrl(interiorId): Generate temporary storage URL
    - recordDownload(interiorId): Update downloadedAt timestamp
  </action>
  <verify>Test download flow, verify URL generated and timestamp updated</verify>
  <done>Downloads work and record usage in database</done>
</task>

<task type="auto">
  <name>Task 5: Integrate generation flow into InteriorManager</name>
  <files>src/components/interiors/InteriorManager.tsx</files>
  <action>
    Update InteriorManager to handle full flow:
    
    State:
    - view: 'select' | 'generating' | 'complete'
    - activeInteriorId: string | null
    
    Views:
    - 'select': TemplateBrowser + TemplateCustomizer + GenerateInteriorButton
    - 'generating': GenerationProgress (onStarted switches to this)
    - 'complete': InteriorArtifacts list + button to generate another
    
    Complete flow:
    1. User selects template + customizes
    2. Clicks GenerateInteriorButton
    3. View switches to GenerationProgress
    4. On complete, view switches to InteriorArtifacts
    5. User can download or generate another
  </action>
  <verify>Run `npm run lint`, test full flow end-to-end</verify>
  <done>Full generation flow works: select → generate → download</done>
</task>

## Testing Checklist
- [ ] Generation triggers and shows progress
- [ ] Progress updates in real-time during generation
- [ ] Download works and records timestamp
- [ ] Failed interiors show error details
- [ ] Version history displays correctly
- [ ] Can regenerate with same config

## Time Estimate
25-30 minutes
