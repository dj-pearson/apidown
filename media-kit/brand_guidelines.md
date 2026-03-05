# APIdown Brand Guidelines

## Brand Story & Voice

APIdown is the neutral, crowd-sourced ground truth for API health. It exists to answer one burning question for developers: *"Is the API actually down - or is it my code?"*

Our voice is:
- **Authoritative**: We have the hard data. We don't guess.
- **Neutral**: We are not the vendor and we are not the frustrated user. We are the observer.
- **Developer-Focused**: Direct, technical, without marketing fluff.
- **Real-time**: High-velocity and immediate.

## Target Audience

Software Developers, DevOps Engineers, SREs, and IT Administrators building on third-party APIs (Stripe, OpenAI, Twilio, AWS).

## Color Palette

Our primary theme is "Trust & Status," reflecting deep infrastructure with high-contrast, immediate operational signals.

### Primary Colors

- **Deep Navy (Background/Base)**: `#0F172A`
  *Usage*: Main application backgrounds, hero sections. Evokes trust, security, and the terminal environment.
- **Slate Gray (Surface/Cards)**: `#1E293B`
  *Usage*: Card backgrounds, secondary sections. Provides subtle depth against the deep navy.

### Status Colors (Vibrant Accents)

- **Operational Green**: `#10B981` (or `#00FF66` for neon accents)
  *Usage*: "All Systems Operational", healthy API indicators, primary action buttons.
- **Degraded Yellow**: `#F59E0B`
  *Usage*: Elevated latency, minor service disruptions.
- **Incident Red**: `#EF4444`
  *Usage*: Outages, downtime, critical alerts.
- **Electric Cyan (Link/Interactive)**: `#06B6D4`
  *Usage*: Text links, active states, hover effects.

### Text & Neutral Colors

- **Primary Text**: `#F8FAFC` (Near White)
- **Secondary Text**: `#94A3B8` (Muted Gray)
- **Borders/Dividers**: `#334155`

## Typography

To bridge the gap between a clean modern UI and the technical reality of monitoring, we mix a sans-serif for UI with a monospace font for data.

### Primary Typeface (UI & Headings): **Inter**

- *Weights*: Regular (400), Medium (500), SemiBold (600), Bold (700)
- *Usage*: Navigation, readable paragraph text, section headers, standard buttons.

### Secondary Typeface (Data & Metrics): **JetBrains Mono** or **Fira Code**

- *Weights*: Regular (400), Medium (500)
- *Usage*: Latency numbers, status codes, SDK snippets, timestamps.

## Logo Usage

The APIdown logo consists of the icon and the logotype.

### Icon
The icon is a visual representation of signal collection and uptime monitoring. It can be used standalone for avatars, favicons, and condensed mobile interfaces.

### Primary Logo
The logotype should be set in a clean, modern sans-serif typeface, heavily weighted towards the "API" portion, with "down" providing contrast.
- Prefer the white/light version of the logo on the deep navy backgrounds.
- Do not compress or stretch the logo.
- Ensure sufficient clear space around the logo equal to the height of the icon.

## UI Principles

- **Data Density**: Developers want to see the maximum amount of relevant information at a glance. Avoid excessive whitespace that pushes metrics below the fold.
- **High Contrast**: Status colors (green/yellow/red) must pop violently against the dark background to immediately convey the situation.
- **No Surprises**: The UI should behave predictably. Real-time updates should flash subtly to indicate new data without jarring the user.
