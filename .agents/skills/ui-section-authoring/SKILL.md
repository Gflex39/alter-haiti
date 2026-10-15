---
name: ui-section-authoring
description: Design and build UI sections, components, and styles for the Alter Haiti Foundation website. Use when modifying src/App.tsx or src/index.css, adding new landing page sections (donation, impact stats, project cards, contact), or switching between the dark editorial theme and the light mockup theme.
---

# UI Section Authoring & Design System

This skill documents the visual language, CSS architecture, and domain context for the Alter Haiti Foundation Inc. website.

## Domain & Brand Context

- **Organization**: Alter Haiti Foundation Inc. (`NON-PROFIT FOUNDATION` / `ALTER HAITI`)
- **Location & Focus**: Revitalizing Jacmel, Haiti through three core pillars:
  1. **Solar Illumination** (installing solar street lights for safety and extended community hours)
  2. **Education** (supporting local schools and students)
  3. **Community Sanitation** (improving clean water and sanitation infrastructure)
- **Official Contact**: `alterhaitinyfoundationinc@gmail.com`
- **Instagram Handle**: `@alterhaitinyfoundationinc` (`https://www.instagram.com/alterhaitinyfoundationinc/`)

## Design Tokens (`src/index.css`)

The production app uses a dark editorial aesthetic defined in `:root`:

```css
:root {
  --bg-color: #050505;
  --text-primary: #ffffff;
  --text-secondary: #a3a3a3;
  --accent: #3b82f6;
  --card-bg: #121212;
  --border-color: rgba(255, 255, 255, 0.1);
}
```

> **Light Theme Concept**: A light-theme alternative (`--bg-color: #f9fafb`, `--text-main: #111827`, `--accent: #2563eb`) exists as a standalone reference in `public/mockup_light.html`. Always default to the dark editorial theme in `src/index.css` unless the user specifically asks for the light theme.

## Layout & Typography Conventions

1. **Section Structure**:
   - Content sections use `padding: 5rem 5%` with `margin: 0 auto` and a constrained `max-width` (`1000px` for text-focused sections like `.mission-section`, `1400px` for grid sections like `.gallery-section`).
   - Full-bleed media sections (`.hero-section`, `.banner-section`) use `position: relative; width: 100%; overflow: hidden` with darkened `<video>` or `<img>` elements (`filter: brightness(0.5)` to `0.7`) and absolute text overlays.
2. **Typography**:
   - Headings use tight tracking (`letter-spacing: -0.02em` to `-0.04em`) and bold/heavy weights (`700`–`800`).
   - Eyebrow/label text uses uppercase and wide tracking (`font-size: 0.75rem`–`0.85rem`, `letter-spacing: 0.1em`–`0.2em`, `text-transform: uppercase`, `color: var(--text-secondary)`).
3. **Cards & Interactive Surfaces**:
   - Surface styling: `background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden;`
   - Hover micro-interaction:
     ```css
     transition: transform 0.3s ease, box-shadow 0.3s ease;
     /* on :hover */
     transform: translateY(-4px);
     box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
     ```
4. **Icons**:
   - `lucide-react` (`^0.380.0`) is installed in `package.json` and can be imported directly into React components (e.g., `import { Sun, BookOpen, Droplets, Mail, Instagram } from 'lucide-react'`).
5. **Responsive Breakpoint**:
   - Add mobile overrides inside the `@media (max-width: 768px)` block at the bottom of `src/index.css`.
   - Scale down display headings (`3.5rem -> 2.2rem`, `2.75rem -> 1.8rem`) and collapse multi-column grids gracefully.
