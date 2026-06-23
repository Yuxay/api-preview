---
name: "ui-ux-pro-max"
description: "Defines and enforces the ApiPreview UI system. Invoke when the user asks for UI design, theme updates, component styling, layout refinement, or frontend visual consistency."
---

# UI UX Pro Max

Use this skill for UI and UX work in the `api-preview` repository.

## Project-Specific Source Of Truth

Always align with these files first:

- `docs/ui-style-guide.md`
- `src/style.css`
- `tailwind.config.js`

## Required Design Direction

All UI output for this project should follow these defaults unless the user explicitly overrides them:

- Style: professional API workbench
- Tone: calm, precise, efficient
- Platform: desktop-first developer tool
- Density: compact, information-rich
- Primary accent: sky/cyan family
- Surface language: layered slate panels with subtle glass treatment
- Motion: restrained and functional

## Implementation Rules

- Reuse existing design tokens before adding new colors or spacing values.
- Prefer shared surface and control classes over one-off styling.
- Cover hover, focus, empty, loading, error, disabled, and active states.
- Keep accessibility at WCAG AA level for core UI.
- Use semantic colors for success, warning, and danger instead of inventing new accents.

## When Making UI Decisions

If the user does not specify detailed visual direction:

1. Follow `docs/ui-style-guide.md`.
2. Preserve the current theme architecture in `src/style.css`.
3. Keep new UI consistent with the existing panel, toolbar, sidebar, and detail-view patterns.
4. Favor clarity and hierarchy over decoration.

## Deliverables

Depending on the request, provide one or more of:

- updated theme and token recommendations
- component-level styling changes
- layout and spacing adjustments
- UX improvements for flows and feedback states
- implementation-ready code changes

## Output Reminder

Whenever working on UI in this repository, explicitly use the project style guide as the governing rule set.
