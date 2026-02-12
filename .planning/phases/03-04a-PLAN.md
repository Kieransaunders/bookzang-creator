---
phase: 03-typography-templates-and-kdp-interior-export
plan: 04a
type: execute
wave: 4
depends_on: ["03-03"]
files_modified:
  - src/components/interiors/TemplateBrowser.tsx
  - src/components/interiors/TemplateCustomizer.tsx
  - src/components/interiors/InteriorManager.tsx
autonomous: true
must_haves:
  truths:
    - "User can browse and select templates from book detail page"
    - "User can customize typography before generation"
    - "Template gallery shows presets with typography summary"
  artifacts:
    - path: "src/components/interiors/TemplateBrowser.tsx"
      provides: "Template preset gallery with selection"
    - path: "src/components/interiors/TemplateCustomizer.tsx"
      provides: "Typography customization controls"
    - path: "src/components/interiors/InteriorManager.tsx"
      provides: "Container component for template selection UI"
  key_links:
    - from: "TemplateBrowser"
      to: "api.templates.list"
      via: "useQuery hook"
      pattern: "useQuery\\(api.templates.list"
    - from: "TemplateCustomizer"
      to: "TemplateBrowser"
      via: "onChange callback updates selected template config"
---

# Plan 03-04a: Template Selection UI

## Goal
Build the user interface for browsing and customizing templates before generation.

## Tasks

<task type="auto">
  <name>Task 1: Create TemplateBrowser component</name>
  <files>src/components/interiors/TemplateBrowser.tsx</files>
  <action>
    Create TemplateBrowser component:
    
    Props:
    - selectedId: string | null
    - onSelect: (template: Template) => void
    
    Features:
    - Query templates via useQuery(api.templates.list)
    - Display preset cards horizontally (Classic, Modern, Minimal)
    - Each card shows:
      * Preset name and icon
      * Typography summary (font, size)
      * Trim size badge (5"×8" or 6"×9")
      * Select button (highlighted if selected)
    - Handle loading and empty states
  </action>
  <verify>Run `npm run lint`, mount component with mock data, verify selection works</verify>
  <done>Component displays templates and calls onSelect when clicked</done>
</task>

<task type="auto">
  <name>Task 2: Create TemplateCustomizer component</name>
  <files>src/components/interiors/TemplateCustomizer.tsx</files>
  <action>
    Create TemplateCustomizer component:
    
    Props:
    - template: Template
    - customizations: Partial<TemplateConfig>
    - onChange: (updates: Partial<TemplateConfig>) => void
    
    Controls:
    - Font family dropdown (Libre Baskerville, Source Serif 4, EB Garamond)
    - Font size slider: 9pt - 14pt
    - Line height slider: 1.2 - 2.0
    - Margin inputs: top, bottom, outer (with 0.35" min validation)
    - Page number position: bottom_center, bottom_outer, none
    - Drop cap toggle
    
    Layout: Collapsible panel below template selection
  </action>
  <verify>Run `npm run lint`, test each control updates onChange correctly</verify>
  <done>All customization controls work and validate input correctly</done>
</task>

<task type="auto">
  <name>Task 3: Create InteriorManager container</name>
  <files>src/components/interiors/InteriorManager.tsx</files>
  <action>
    Create InteriorManager component:
    
    Props:
    - bookId: string
    
    State:
    - selectedTemplate: Template | null
    - customizations: Partial<TemplateConfig>
    
    Layout:
    ```
    ┌─────────────────────────────────────────┐
    │ Template Gallery                        │
    │ [Classic] [Modern] [Minimal]           │
    ├─────────────────────────────────────────┤
    │ Customization Panel (collapsible)      │
    │ Font: [Dropdown] Size: [Slider]        │
    ├─────────────────────────────────────────┤
    │ [Proceed to Generation] → (links to    │
    │   full generation flow in 03-04b)      │
    └─────────────────────────────────────────┘
    ```
    
    Check book has approved text before allowing proceed.
  </action>
  <verify>Run `npm run lint`, integrate into book detail page tab</verify>
  <done>Manager renders browser + customizer and validates book state</done>
</task>

## Testing Checklist
- [ ] Can select template from gallery
- [ ] Customization changes reflect in preview
- [ ] Generate button disabled if no approved text
- [ ] UI matches design layout

## Time Estimate
20-25 minutes
