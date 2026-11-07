---
name: BrandGuard AI
colors:
  surface: '#0e1323'
  surface-dim: '#0e1323'
  surface-bright: '#34394a'
  surface-container-lowest: '#080d1d'
  surface-container-low: '#161b2b'
  surface-container: '#1a1f30'
  surface-container-high: '#25293a'
  surface-container-highest: '#2f3446'
  on-surface: '#dee1f9'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#dee1f9'
  inverse-on-surface: '#2b3041'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00a572'
  on-tertiary-container: '#00311f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0e1323'
  on-background: '#dee1f9'
  surface-variant: '#2f3446'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  code-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system delivers a futuristic, mission-critical workspace tailored for enterprise brand guardians, marketing executives, and content operations teams. The aesthetic pairs the meticulous engineering precision of developer-first platforms with the luxury polish of an executive command suite.

The system synthesizes two core design paradigms:
- **Glassmorphic Precision:** Deep navy canvas depths layered with semi-translucent backdrop filters, micro-frosted cards, and ultra-crisp hairline borders.
- **Electric Accent Minimalism:** Controlled illumination via electric violet and cyber-blue gradients, reserving hyper-saturated glow effects strictly for actionable surfaces, status verification, and real-time AI inference feedback.

The interface evokes uncompromising trust, surgical oversight, and advanced intelligence. Content feels shielded, calculated, and mathematically validated.

## Colors

The palette establishes an obsidian-tier hierarchy engineered specifically for low visual fatigue in dark-mode workflows:

- **Primary Canvas (`#0B1020`):** The bedrock background tone, an ultra-deep navy that provides near-infinite depth without harsh pitch-black contrast.
- **Surface Elevation (`#111827`):** Elevated panels, table rows, and navigational sidebars. Applied at 70% to 85% opacity over canvas backgrounds when combined with backdrop blur.
- **Electric Violet (`#8B5CF6` / `#7C3AED`):** The primary kinetic signal. Represents automated AI audit operations, brand engine calculations, and primary calls to action.
- **Cyber Blue (`#3B82F6`):** Secondary accent driving system connectivity, integration monitors, secondary filters, and data comparison streams.
- **System States:**
  - **Success (`#10B981`):** Brand compliance verified; strict pass criteria met.
  - **Warning (`#F59E0B`):** Drift detected; tone deviation or partial guideline divergence.
  - **Critical (`#EF4444`):** Hard compliance failure; unauthorized tone, trademark misuse, or embargo violations.
- **Typography & Monochrome Scales:** Primary text uses pristine slate-white (`#F8FAFC`), supporting text uses mid-slate (`#94A3B8`), and structural dividing borders use muted navy slate (`#1E293B` to `#334155`).

## Typography

The typographic hierarchy creates tension between high-end modern marketing flair and rigorous technical precision:

- **Display & Headlines (`Plus Jakarta Sans`):** Features wide apertures and clean geometric curves that maintain clarity at scale. It delivers an authoritative executive presence in dashboards and high-level metric views.
- **Interface & Data (`Geist`):** Delivers monolinear, developer-grade precision across dense telemetry, rule engine definitions, AI prompt logs, and complex approval trees. Tight horizontal metrics enable ultra-dense dashboard packaging without compromising readability.
- **Tracking & Kern:** Apply `-0.02em` tracking across all headline levels (`headline-xl` through `headline-sm`) for a sharp lockup. Label styles use `+0.04em` letter-spacing when capitalized to reinforce technical HUD aesthetics.

## Layout & Spacing

The layout is structured around a 12-column adaptive grid designed for high-density monitoring environments:

- **Grid Architecture:** Desktop workstations utilize a 12-column fluid framework with a maximum content constraint of `1600px` for ultra-wide monitors. Column gutters hold strictly at `1.5rem` (`24px`). Mobile viewports compress into a single-column or 4-column fluid layout with `0.75rem` (`12px`) gutters.
- **Section Margins:** Desktop edges enforce a mandatory minimum padding of `2rem` (`32px`), reducing to `1rem` (`16px`) below `768px`.
- **Vertical Rhythm:** Content clusters use an 8px base rhythm. Metric card groupings align to multiples of `space-md` (`1rem`) and `space-lg` (`1.5rem`), maintaining modular alignment across multi-column data views.

## Elevation & Depth

Depth is established through translucent atmospheric light and surgical edge treatment rather than heavy muddy dropshadows:

- **Level 0 (Canvas Base):** Solid deep navy (`#0B1020`), unbordered, no glow.
- **Level 1 (Subsurface Panels):** Background color `#111827` at 60% opacity with `16px` backdrop blur. Enclosed by a 1px hairline border of `rgba(255, 255, 255, 0.08)`.
- **Level 2 (Active Cards & Inspection Panes):** Background color `#111827` at 80% opacity with `24px` backdrop blur. Hairline border of `rgba(139, 92, 246, 0.25)`. Ambient drop shadow: `0 8px 32px -4px rgba(0, 0, 0, 0.5)`.
- **Level 3 (Modal Dialogs & Flying Overlays):** Background color `#0F172A` at 95% opacity with `32px` backdrop blur. Hairline border of `rgba(139, 92, 246, 0.45)`. Diffuse radial halo: `0 0 40px -10px rgba(124, 58, 237, 0.35)`.
- **Specular Highlights:** All interactive glass containers include a subtle top gradient stroke (`linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.0) 100%)`) along their outer edge to mimic precision-milled glass edges under overhead lighting.

## Shapes

With a roundedness index of `2`, the system employs refined geometric curvature:

- **Base Radius (`0.5rem` / `8px`):** Applied to standard control elements including buttons, inputs, badge tags, and search bars.
- **Container Radius (`1rem` / `16px`):** Applied to content cards, data tables, code inspector views, and telemetry graphs.
- **Modal Radius (`1.5rem` / `24px`):** Applied to system modals, dynamic approval dialogs, and drawer panels.
- **Pill Radius (`9999px`):** Strictly reserved for dynamic state pills (e.g., "Active Scan", "Compliant", "Flagged") and avatar enclosures.

## Components

### Buttons
- **Primary:** Solid `#7C3AED` background with a hairline border of `rgba(255,255,255,0.2)`. On hover, transitions to `#8B5CF6` with an exterior blur glow of `0 0 16px rgba(139, 92, 246, 0.5)`. Text is pristine white, semi-bold `Geist`.
- **Secondary:** Transparent background with `rgba(255, 255, 255, 0.06)` fill. Border is 1px `rgba(255, 255, 255, 0.15)`. On hover, border shifts to `#3B82F6` and background to `rgba(59, 130, 246, 0.1)`.
- **Ghost/Tertiary:** No border, transparent background, text color `#94A3B8`. On hover, text shifts to `#F8FAFC` with subtle `rgba(255, 255, 255, 0.05)` fill.

### Cards & Glass Panels
- Standard cards feature `rgba(17, 24, 39, 0.75)` backdrop blur (`20px`) bounded by a 1px border of `rgba(255, 255, 255, 0.08)`.
- Hovering an interactive audit card activates an electric perimeter trace: the border shifts smoothly to `rgba(139, 92, 246, 0.4)` and casts an inner ambient glow of `inset 0 0 12px rgba(139, 92, 246, 0.08)`.

### Input Fields & Search Bars
- Background set to `rgba(11, 16, 32, 0.8)`. Default border is 1px `rgba(255, 255, 255, 0.12)`.
- Active focus state introduces a cyber-blue micro-border (`#3B82F6`) with an outer ring illumination of `0 0 0 3px rgba(59, 130, 246, 0.2)`. Placeholder text sits at `#64748B`.

### Badges & Status Chips
- Height constrained to `24px` with a pill radius (`9999px`).
- Built with a 10% opacity status-colored fill, a matching 1px border at 30% opacity, and bright status typography. For instance, **Audit Verified** renders with `#10B981` text, `rgba(16, 185, 129, 0.1)` fill, and an internal 4px glowing status dot.

### Checkboxes & Radios
- Square with `4px` radius for checkboxes; circular for radios. Base background is `#0B1020` with a 1px border of `rgba(255, 255, 255, 0.2)`.
- Checked state transitions instantly to `#8B5CF6` featuring a centered white check icon and a localized `0 0 8px rgba(139, 92, 246, 0.6)` light discharge.

### Specialized AI Governance Components
- **Rule Inspector Terminal:** A dedicated monospaced diff viewer with syntax-highlighted tone adjustments, token-drift metrics, and inline one-click remediation controls.
- **Score Matrix Gauge:** Circular SVG radial meters with gradient strokes connecting `#3B82F6` to `#8B5CF6`, displaying real-time compliance percentages centered in bold `Plus Jakarta Sans`.