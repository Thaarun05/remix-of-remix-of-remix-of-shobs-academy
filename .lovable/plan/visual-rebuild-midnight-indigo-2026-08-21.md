# Visual Rebuild: Midnight Indigo

A full restyle of the public site and dashboards around a new identity: deep midnight navy-black surfaces, electric indigo accents, Sora headings and Manrope body text, with lively but controlled motion.

## New design identity

- Palette: `#0a0a1a` base, `#141432` surface, `#1e1e5a` elevated, `#4f46e5` electric indigo accent, plus a light mode built from the same hues so both themes stay consistent.
- Typography: Sora for headings and numbers, Manrope for body and UI.
- Depth language: glass panels, soft indigo glow shadows, 1px luminous borders, gradient meshes behind hero sections, rounded-xl geometry.
- Every value lands as a semantic token in the global CSS and Tailwind config; components keep using `bg-card`, `text-foreground`, `bg-primary`, etc.

## Home page

1. Animated hero: kinetic headline that reveals word by word, an animated indigo gradient mesh with slow parallax, floating subject chips drifting behind the copy, magnetic primary CTA ("Book a Free Demo") with a travelling arrow.
2. Live counters: students taught, subjects, countries, hours delivered — count up when scrolled into view.
3. Interactive subject explorer: pick a grade (1-12) on a horizontal selector, then subject cards animate in showing what is covered, level, and a "Book a demo for this" action. Content is a curated static map so it needs no backend.
4. How it works timeline: animated 4-step journey (enquiry, free demo, personalised plan, ongoing progress) with a scroll-drawn connecting line and step icons.
5. Restyled country grid, portal cards, and footer using the new tokens.

## About page

Restyled to the new identity, keeping current content: mission/vision, core values, features, subject lists — with staggered reveals, hover lift, and animated section dividers.

## Login pages and shared shell

Split-screen login layout: brand panel with animated gradient on one side, form on the other. Role-tinted accents kept for Student / Teacher / Admin. Navbar becomes a slim glass bar that condenses on scroll.

## Dashboards

Polish pass across student, teacher, and admin views without touching logic:
- Sidebar and topbar restyled to the midnight surfaces with an indigo active indicator.
- Stat cards get a unified treatment: gradient rims, icon badges, and count-up numbers.
- Tables, tabs, badges, dialogs, empty states, and skeletons aligned to the new tokens.
- Micro-interactions: hover lift on cards, ripple-free button press states, animated tab underline, smooth tab content fade.

## Motion rules

Lively register: parallax hero, scroll-drawn lines, marquee-free counters, magnetic buttons, staggered reveals. All animations are GPU-friendly transforms/opacity, driven by the existing `Reveal` / `useInView` infrastructure, and fully disabled under `prefers-reduced-motion`.

## Technical notes

- Rewrite the token layer in `src/index.css` and `tailwind.config.ts` (colors, gradients, shadows, fonts, keyframes); load Sora + Manrope.
- Add hooks/components: `useCountUp`, `useParallax`, `MagneticButton`, `AnimatedCounter`, `SubjectExplorer`, `HowItWorks`, `HeroBackground`.
- Rework `src/pages/Index.tsx`, `src/pages/About.tsx`, the three login pages, `Navbar.tsx`, `SiteFooter.tsx`, `DashboardLayout.tsx`, and shared UI primitives (`status-badge`, `loading-skeletons`, `PageHeader`, `EmptyState`).
- No database, auth, or business logic changes; dashboard edits stay presentational.
- Update the head title/description and keep the single-H1, alt-text, and contrast rules intact.
