import { FileItem } from '../types/obsidian';

export const INITIAL_VAULT_FILES: FileItem[] = [
  {
    id: 'note-welcome',
    path: 'Getting Started.md',
    title: 'Getting Started',
    folder: '',
    updatedAt: Date.now() - 3600000,
    content: `---
tags:
  - guide
  - obsidian
  - productivity
created: 2026-11-04
status: active
author: Obsidian Core
priority: 1
---

# Welcome to Obsidian Markdown Editor

Experience the signature **Cursor-Aware Live Preview** hybrid editor. Click any line or formatted token to reveal its raw Markdown syntax for immediate in-place editing, then click away to collapse it back into its rendered state.

> [!tip] Cursor-Aware Hybrid Mode
> In **Live Preview**, Markdown syntax (like \`**bold**\`, \`# heading\`, and \`[[links]]\`) is cleanly rendered. Click directly onto any line or token to expand raw syntax for immediate in-place editing!

## 1. Bi-Directional Wiki-Links & Transclusion

Link to other documents in your workspace simply by typing \`[[\`:
- Link with heading subpath: [[Architecture & Core Engine#Rendering Pipeline]]
- Link with custom alias: [[Apollo Roadmap|Q4 Milestone Roadmap]]
- Transclusion Embed (renders live note inline):
![[Component Overview]]

Try typing \`[[\` anywhere to open the fuzzy search popover!

## 2. Interactive Callouts (Admonitions)

> [!note] Project Note
> Standard callouts provide structured highlights for design thoughts and team memos.

> [!warning]- Collapsible Security Warning (Click to toggle)
> This callout has a \`-\` suffix in its definition (\`> [!warning]-\`), rendering it collapsed by default.

> [!todo] Launch Checklist
> - [x] Implement cursor-aware inline rendering
> - [x] Support bi-directional backlink indexer
> - [ ] Complete integration into host app

## 3. Interactive Pipe Table

| Feature | Support Level | Trigger |
| :--- | :---: | ---: |
| Live Preview | Native | Click Line |
| Wiki-Link Autocomplete | Fuzzy | [[ |
| Slash Commands | Built-in | / |
| Dynamic Variables | Resolved | {{ |

## 4. Code Blocks with Syntax Badges

\`\`\`typescript
interface KnowledgeNode {
  id: string;
  title: string;
  links: string[];
  transclusions: string[];
}

export function resolveGraph(nodes: KnowledgeNode[]) {
  return nodes.map(n => ({ id: n.id, degree: n.links.length }));
}
\`\`\`

## 5. Dynamic Variables & Tags

Document metadata variables: {{author}} · Status: {{status}} · Date: {{created}}
Tags across document: #knowledge-base #local-first #obsidian
`,
  },
  {
    id: 'note-architecture',
    path: 'Architecture & Core Engine.md',
    title: 'Architecture & Core Engine',
    folder: 'Engineering',
    updatedAt: Date.now() - 7200000,
    content: `---
tags:
  - architecture
  - engineering
  - parser
created: 2026-11-02
status: approved
author: Systems Architect
priority: 1
---

# Architecture & Core Engine

This document details the internal workings of the local-first hybrid Markdown workspace.

## Rendering Pipeline

The editor operates using **Live Preview**:
- Cursor-aware token expansion where inactive lines render formatted typography and widgets.
- Clicking any line reveals raw Markdown tokens for direct manipulation.

> [!info] Bi-Directional Backlink Sync
> Backlinks are computed in memory across all files. Mentions of [[Getting Started]] or [[Apollo Roadmap]] are indexed instantly.

## Database Layer

The workspace uses a local memory buffer model where edits remain non-destructive.

\`\`\`json
{
  "engine": "Obsidian Hybrid Core",
  "transclusion": true,
  "backlinks": "active",
  "version": "2.4.0"
}
\`\`\`

### Unlinked Text Mentions
Notes discussing Apollo Roadmap or Component Overview will automatically show up in the Backlink Inspector panel!
`,
  },
  {
    id: 'note-roadmap',
    path: 'Apollo Roadmap.md',
    title: 'Apollo Roadmap',
    folder: 'Projects',
    updatedAt: Date.now() - 14400000,
    content: `---
tags:
  - roadmap
  - q4
  - planning
created: 2026-10-28
status: in-progress
author: Product Lead
priority: 2
---

# Apollo Roadmap

Sprint initiatives and architecture deliverables. Referenced by [[Getting Started]] and [[Architecture & Core Engine]].

## Milestones

- [x] Phase 1: Markdown syntax parsing & token hiding
- [x] Phase 2: Wiki-link popup with sub-path navigation (#)
- [x] Phase 3: Transclusion embedding (![[note]])
- [ ] Phase 4: Host application integration

## Delivery Matrix

| Phase | Target Date | Owner | Status |
| :--- | :---: | :---: | ---: |
| Core Parser | Oct 15 | Engineering | Complete |
| Live Preview | Nov 01 | Frontend | Complete |
| Backlink Index | Nov 04 | Systems | In Review |

Reference note: see [[Component Overview]] for modular breakout.
`,
  },
  {
    id: 'note-component-overview',
    path: 'Component Overview.md',
    title: 'Component Overview',
    folder: 'Engineering',
    updatedAt: Date.now() - 28800000,
    content: `---
tags:
  - components
  - ui
created: 2026-11-01
status: stable
author: UI Team
---

# Component Overview

Reusable visual widgets embedded across documents via transclusion (\`![[Component Overview]]\`).

> [!summary] Widget Catalog
> - **Callout Box**: Multi-color thematic admonitions with collapse controls.
> - **Pipe Table**: Interactive tabular matrix with row/column insertion.
> - **Code Block**: Syntax highlighted preview with copy button.
> - **Properties Panel**: YAML Frontmatter editor.
`,
  },
  {
    id: 'note-daily',
    path: 'Daily Notes/2026-11-04.md',
    title: '2026-11-04',
    folder: 'Daily Notes',
    updatedAt: Date.now() - 1200000,
    content: `---
tags:
  - daily
  - standup
created: 2026-11-04
status: active
---

# Daily Log · November 4, 2026

## Focus for Today
- [x] Review [[Architecture & Core Engine]] specification
- [ ] Test Smart List auto-continuation with numbered lists
- [ ] Verify [[Apollo Roadmap]] deliverables with team
- [ ] Check tags #obsidian and #productivity

## Meeting Notes
Discussed transclusion rendering speed and inline token unveiling behaviors.
`,
  },
];
