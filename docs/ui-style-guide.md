# ApiPreview UI Style Guide

## 1. Design Goal

This project uses a consistent UI direction for all future interface work:

- Style: professional API workbench
- Tone: calm, precise, efficient, trustworthy
- Platform feeling: desktop-first, high information density, developer tool quality
- Visual metaphor: glass + instrument panel, not marketing landing page

All future UI discussions, designs, and code changes should follow this guide unless the user explicitly overrides it.

## 2. Theme Color

Primary theme color is fixed to the existing sky/cyan family:

- Brand primary (dark mode): `#38BDF8`
- Brand primary hover (dark mode): `#0EA5E9`
- Brand primary (light mode): `#0284C7`
- Brand primary hover (light mode): `#0369A1`
- Soft accent background (dark mode): `rgba(56, 189, 248, 0.14)`
- Soft accent background (light mode): `rgba(2, 132, 199, 0.10)`

Semantic colors:

- Success: `#34D399` dark, `#059669` light
- Warning: `#FBBF24` dark, `#D97706` light
- Danger: `#F87171` dark, `#DC2626` light

Color usage rules:

- Use the primary color only for key actions, active states, focus, selection, and important data emphasis.
- Keep accent exposure under control. One screen should not compete with multiple saturated colors.
- Prefer neutral slate surfaces and use the accent as a signal color, not a background fill for large areas.
- Diff, status, and validation states use semantic colors before using the brand color.

## 3. Visual Style

The UI style is fixed as:

- Base surfaces: layered slate panels with subtle glass treatment
- Contrast model: dark-first, with equally polished light mode support
- Borders over shadows: use clean borders first, shadows second
- Rounded geometry: soft but controlled, never overly playful
- Motion: short, crisp, and supportive

Avoid these styles:

- Large rainbow gradients
- Bright neon combinations
- Oversized hero sections or consumer-app layouts
- Floating cards with excessive blur or heavy shadow stacking
- More than one dominant accent on the same screen

## 4. Typography

Use the existing font stack consistently:

- UI font: `IBM Plex Sans`, `Inter`, `Segoe UI`, `system-ui`, `sans-serif`
- Code font: `JetBrains Mono`, `Cascadia Code`, `Consolas`, `monospace`

Typography rules:

- Default body size: `13px`
- Dense helper text: `11px` to `12px`
- Standard control text: `13px` to `14px`
- Section title: `16px` to `18px`
- Empty-state title or primary page title: `24px` when needed
- Use semibold for hierarchy, not color alone
- Code, URLs, schema keys, and payload snippets use monospace

## 5. Spacing And Shape

Use a compact desktop spacing rhythm:

- `4px`: tiny gaps, badges, compact tags
- `6px`: inline controls and dense grouping
- `8px`: default local spacing
- `12px`: card internals, section separation
- `16px`: panel padding baseline
- `24px`: larger section separation
- `32px`: empty-state and major layout breathing room

Radius rules:

- `4px`: inline chips
- `6px`: small inputs and compact buttons
- `8px`: cards inside panels
- `12px`: main panels and sticky action bars
- `16px`: modal and elevated overlays

## 6. Component Rules

Panels:

- Top-level panels use elevated surfaces with visible borders.
- Nested content areas use inset surfaces.
- Code and JSON containers use sunken surfaces with monospace.

Buttons:

- Primary button uses the brand primary color.
- Secondary button stays neutral and relies on border + subtle fill.
- Destructive actions use danger color only when the action is truly destructive.

Inputs:

- Inputs use neutral surfaces with border-led emphasis.
- Focus state uses a 2px soft accent ring and stronger border.
- Search fields, URL fields, and token fields may vary in emphasis, but share the same construction language.

Tabs and segmented controls:

- Active state uses soft accent background plus brand-colored text.
- Hover should never overpower the active state.

Lists and sidebars:

- Hover uses subtle neutral lift.
- Selected state uses accent-tinted background, not full solid fill.
- Source, tag, and diff signals should remain readable in both themes.

Badges:

- Default badges are neutral.
- Status badges may use semantic soft backgrounds.
- Use badges for metadata, not as decorative noise.

Dialogs and popovers:

- Must be opaque enough to preserve legibility.
- Use stronger border contrast than background panels.

## 7. States And Feedback

Every new UI should account for:

- Empty state
- Loading state
- Error state
- Disabled state
- Hover state
- Focus-visible state
- Selected or active state

Feedback rules:

- Loading uses restrained animation and never blocks reading unnecessarily.
- Error messages are clear, actionable, and concise.
- Empty states should teach the next step.
- Destructive actions should be explicit and visually differentiated.

## 8. Motion

Use the existing motion system:

- Fast: `150ms`
- Base: `200ms`
- Slow: `300ms`
- Layout: `350ms`

Motion rules:

- Motion explains layout changes and hover response.
- Avoid decorative animation loops unless they communicate loading.
- Prefer opacity, border, and small translate transitions over large movement.

## 9. Accessibility

All future UI work should follow these minimum rules:

- Meet WCAG AA contrast for core text and controls.
- Keyboard focus must always be visible.
- Interactive controls should target at least `36px` height in dense layouts.
- Icon-only buttons need accessible labels or tooltips.
- Do not use color alone to communicate important status changes.

## 10. Implementation Rules

When editing this project:

- Reuse tokens from `src/style.css` before introducing new raw color values.
- Reuse Tailwind extensions from `tailwind.config.js` before adding ad-hoc utility classes.
- Prefer existing shared surface classes such as `panel-surface`, `surface-inset`, `surface-sunken`, `toolbar-button`, and `field-input`.
- Any new component should map to this design system before adding custom visuals.
- If a new visual pattern appears in 2 or more places, promote it to a shared token or class.

## 11. Default UI Decision Policy

If the user asks for UI changes without giving exact visual direction, default to:

- desktop-first layout
- compact spacing
- slate neutral surfaces
- sky/cyan accent
- strong information hierarchy
- understated motion
- clear states for loading, empty, and error

This policy remains active for future UI-related requests in this repository unless the user replaces it with a new rule set.
