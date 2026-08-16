# Motion pass — Home & About pages

Add tasteful, professional motion to the public pages: arrows that travel on hover, a livelier "Book a free demo" CTA, and small elements that reveal as you scroll. No layout, copy, or functional changes.

## What changes

**Buttons and arrows**
- "Book a free demo" (hero on Home, CTA on About): subtle lift on hover, soft glow pulse to draw the eye when idle, press-down feedback on click.
- "How we teach" / "About us" / "Back to home" buttons: the arrow icon slides right (or left, for back) on hover, with the button border/background easing in.
- All icon-bearing buttons use the same timing so the site feels consistent.

**Home page small elements**
- Hero badge ("Teaching students in 8 countries"): gentle float, globe icon slowly rotates.
- Hero logo panel: slow floating drift.
- Pillar cards, "How it works" steps, country flags: fade-and-rise into view as you scroll, staggered so they cascade rather than pop in at once.
- Card hover: slight lift and icon tint transition.
- Sign-in strip links: animated underline instead of plain underline.

**About page small elements**
- Section headings and content blocks reveal on scroll with the same fade-and-rise.
- Stat/feature cards stagger in and lift on hover.
- Numbered steps: the number badge scales in slightly ahead of its text.

**Accessibility**
- Everything respects `prefers-reduced-motion`: animations collapse to instant, no float or pulse.

## Technical notes

- Pure CSS/Tailwind — no new animation library.
- Extend `tailwind.config.ts` keyframes/animation with `arrow-nudge`, `float-slow`, `cta-glow`, and stagger delay utilities; reuse existing `fade-up` / `scale-in`.
- Add a small `useInView` hook (IntersectionObserver) plus a `Reveal` wrapper component in `src/components/` so scroll reveals are one-line to apply, with a `delay` prop for stagger.
- Arrow motion via `group-hover:translate-x-1` on existing `ArrowRight` icons — no markup restructuring.
- Add a global `@media (prefers-reduced-motion: reduce)` block in `src/index.css` disabling the new animations.
- Files touched: `tailwind.config.ts`, `src/index.css`, `src/pages/Index.tsx`, `src/pages/About.tsx`, `src/components/DemoRequestForm.tsx`, new `src/components/Reveal.tsx` + `src/hooks/useInView.ts`.
