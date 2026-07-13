---
name: Industrial Logic
colors:
  surface: '#11131a'
  surface-dim: '#11131a'
  surface-bright: '#373941'
  surface-container-lowest: '#0c0e15'
  surface-container-low: '#191b23'
  surface-container: '#1d1f27'
  surface-container-high: '#282a31'
  surface-container-highest: '#32343c'
  on-surface: '#e1e2ec'
  on-surface-variant: '#c3c6d6'
  inverse-surface: '#e1e2ec'
  inverse-on-surface: '#2e3038'
  outline: '#8d90a0'
  outline-variant: '#434654'
  surface-tint: '#b2c5ff'
  primary: '#b2c5ff'
  on-primary: '#002b73'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#0c56d0'
  secondary: '#48d7f9'
  on-secondary: '#003641'
  secondary-container: '#01b8d9'
  on-secondary-container: '#004451'
  tertiary: '#ffb59b'
  on-tertiary: '#5b1a00'
  tertiary-container: '#a33500'
  on-tertiary-container: '#ffc6b2'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#afecff'
  secondary-fixed-dim: '#48d7f9'
  on-secondary-fixed: '#001f27'
  on-secondary-fixed-variant: '#004e5d'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59b'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#812800'
  background: '#11131a'
  on-background: '#e1e2ec'
  surface-variant: '#32343c'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  container-max-width: 1440px
  node-gap: 32px
---

## Brand & Style

The design system is engineered for precision, reliability, and high-velocity development. It targets a technical audience of AI engineers and developers who require a platform that prioritizes information density without sacrificing clarity. 

The aesthetic is **Sophisticated Industrial**. It draws from the structural integrity of modern developer tools and the clean lines of high-end lab equipment. The UI should evoke an emotional response of "controlled power"—where complex RAG (Retrieval-Augmented Generation) pipelines feel manageable through logical grouping, crisp boundaries, and a systematic hierarchy. It avoids unnecessary ornamentation in favor of functional clarity, utilizing a dark-themed environment to reduce eye strain during long-winded orchestration tasks.

## Colors

The palette is anchored in a deep, nocturnal spectrum to provide a high-contrast foundation for technical data.

- **Primary Blue (#0052CC):** Used for primary actions, active node states, and critical paths. It represents the "logic" of the system.
- **Accent Teal (#00B8D9):** Used for "success" states, data visualization highlights, and secondary interactive elements like connectivity lines in node graphs.
- **Neutral Scales:** The system utilizes a range of cool greys and slates. The background is a custom "Deep Ink" to provide more depth than pure black, while surfaces use "Obsidian" tones to distinguish layers.
- **Functional Colors:** Error states use a high-chroma red, while warnings use a muted amber to ensure they do not compete with the primary blue.

## Typography

This design system utilizes a dual-font approach to separate the "User Interface" from the "Data."

1.  **Inter (UI):** A versatile, highly legible sans-serif used for all functional controls, navigation, and primary content. It is chosen for its excellent rendering at small sizes in dark mode.
2.  **JetBrains Mono (Data/Labels):** A technical monospace font used for code snippets, JSON outputs, node labels, and metadata. The monospaced nature reinforces the industrial/developer-centric feel and ensures data alignment is predictable.

**Hierarchy Rules:**
- Use **all-caps labels** in JetBrains Mono for small category tags and metadata.
- Large headlines should use tight letter-spacing to maintain a "packed" industrial look.
- Body text uses a standard weight (400) to ensure legibility against dark backgrounds.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. The main navigation and property panels are fixed-width (typically 240px and 320px respectively), while the central workspace—where RAG nodes and canvases reside—is fluid.

**The 4px Grid:**
All spacing, padding, and margins are multiples of 4px. This ensures mathematical harmony across the technical UI.

- **Information Density:** For data-heavy screens, use the `compact` spacing scale (8px padding). For landing/dashboard views, use `relaxed` (24px padding).
- **Spatial Hierarchy:** Use clear vertical dividing lines (1px width) rather than whitespace alone to separate high-density data columns, mimicking a structured technical drawing.

## Elevation & Depth

In this dark-mode industrial system, depth is conveyed through **Tonal Layering** and **Low-Contrast Outlines** rather than heavy shadows.

- **Base Layer (Level 0):** The primary background.
- **Surface Layer (Level 1):** Cards, sidebars, and panels. These are slightly lighter than the base and defined by a 1px border (#242933).
- **Interactive Layer (Level 2):** Hover states and active nodes. These use a subtle inner glow or a primary-colored border to indicate focus.
- **Backdrop Blurs:** Used sparingly for modal overlays (20px blur) to maintain context of the underlying workspace without causing visual clutter.

Shadows, when used, are "hard" and low-opacity, reinforcing a physical, machined aesthetic rather than a soft, organic one.

## Shapes

The shape language is **Soft (0.25rem)**. This provides just enough curvature to feel modern and accessible while maintaining the rigid, "machined" feel of a professional tool.

- **Standard Elements:** Buttons, inputs, and small cards use 4px (0.25rem) corners.
- **Large Containers:** Main dashboard panels or canvas nodes use 8px (0.5rem) to signify they are larger structural units.
- **Technical Nodes:** In the RAG flow-chart, nodes should have distinct "input/output" ports which are perfectly circular (pill-shaped) to differentiate them from the rectangular body of the node.

## Components

### Buttons & Inputs
Buttons are strictly rectangular with 4px corners. The "Primary" variant is solid #0052CC with white text. The "Secondary" variant is an outline style. Inputs use a darker surface color than the background to create an "inset" feel, with a 1px teal border on focus.

### Interactive Nodes (RAG Canvas)
Nodes represent the core of the product. They feature a header area with a JetBrains Mono label and a body area for configuration.
- **Active State:** A 2px #0052CC border and a subtle outer glow.
- **Processing State:** A pulsing teal #00B8D9 indicator in the header.

### Data Visualization
Charts should use the Secondary Teal (#00B8D9) as the primary data line, with a semi-transparent teal fill for area charts. Grid lines in charts should be kept at 0.5px thickness and #242933 color.

### Chips & Tags
Tags for "Data Sources" or "Models" should use the Monospace font. They are low-contrast (grey background) to avoid competing with primary action buttons.

### Status Indicators
Small, high-chroma dots (8px x 8px) are used to show system health:
- Green (Teal): Operational
- Amber: Latency detected
- Red: Pipeline failure