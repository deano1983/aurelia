# 01 — Unified Daily Command Timeline

Functionality from velvetcadence page:
- Add deadlines / publishing slots ("Add to my timeline")
- 4 Active + custom slots
- Creator / LinkedIn Executive / Board / Personal / Life categories
- Flexible content upload
- Hard report deadline / Protected life event tags
- Export .ics Calendar

## Recommended tech stack
| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| UI | React + Vite | Date pickers, drag-and-drop reordering, category filters benefit from component model |
| State | localStorage + IndexedDB | Client-only, no backend required for MVP |
| Dates | date-fns | Lightweight, tree-shakable date manipulation |
| Export | ics.js | Generate .ics calendar files client-side |
| Styling | Tailwind CSS | Rapid UI, matches hub design system |

## Interlink dependencies
- Receives deadlines from **06 Tax Invoice** (report due dates)
- Receives payout dates from **07 Affiliate Engine**
- Exports to **02 Asset Vault** (attach .ics as cloud proof pointer)

## Suggested folders
```
01-daily-command-timeline/
  src/
    components/  TimelineItem, CategoryFilter, IcsExportButton
    hooks/       useTimeline, useLocalStorage
    utils/       dateHelpers, icsGenerator
  index.html
  package.json
```
