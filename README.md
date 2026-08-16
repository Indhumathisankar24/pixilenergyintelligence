# PIXIL — Energy Intelligence Platform

**Predict. Detect. Decide.**
AI-powered energy forecasting, anomaly detection and grid intelligence.

A production-quality frontend for electricity boards, distribution utilities, grid operators and
energy planners. React + TypeScript + Vite + Tailwind CSS v4 + Recharts.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle
npm run preview  # serve the built bundle
```

---

## The product argument

Every page answers one operational question, and the navigation is grouped by that:

| Page | Question |
|---|---|
| Overview | What is happening now? |
| Forecasting | What will happen next? |
| Anomalies | What is unusual? |
| Regional Intelligence | Where is the problem? |
| Pattern Drift | Has normal behaviour changed? |
| Model Performance | How reliable is the forecast? |
| 10-Year Planning | What should we prepare for? |
| Reports | What do we report? |

The pipeline the UI is built to communicate:

```
actual -> expected -> deviation -> context-aware threshold -> anomaly
       -> severity -> possible contributing factors -> recommendation
```

Three claims the interface is careful never to make:

- **A difference is not an anomaly.** Expected consumption is model output and every model carries
  error. A deviation is escalated only when it falls outside the band that is normal *for that
  region at that hour* and holds long enough to be corroborated.
- **A correlation is not a cause.** Factor analysis is presented as *possible contributing
  factors*, ranked by association strength, with the source of each signal named.
- **The data resolves to regional level.** No facility, building or equipment attribution is
  fabricated. The deeper hierarchy is shown dashed, labelled as supported-but-unpopulated.

---

## Architecture

```
src/
├── charts/        Recharts wrappers + shared chart chrome (theme.tsx)
├── components/    Domain components (severity, KPI, region grid, factors, drawers)
│   └── ui/        Generic primitives (card, button, drawer, modal, toast, table bits)
├── hooks/         useAsync, useAppContext, useSortableTable
├── layouts/       AppLayout, Sidebar, Header
├── mock/          Synthetic data engine + derivation (replaced by the backend)
├── pages/         One file per route
├── services/      The API seam — the ONLY thing pages import for data
├── types/         Domain model; the contract between UI and data layer
└── utils/         Formatting, severity presentation
```

### The service seam

UI components never import from `src/mock`. They call services, which return the types in
`src/types`. Every call is asynchronous, takes measurable time, honours an `AbortSignal`, and can
fail — which is what forces the loading, empty and error states to be real rather than theoretical.

| Service | Endpoint it will call |
|---|---|
| `overviewService` | `GET /api/overview`, `PATCH /api/alerts/{id}/acknowledge` |
| `forecastService` | `GET /api/forecast` |
| `anomalyService` | `GET /api/anomalies`, `/{id}`, `/summary`, `PATCH /{id}/status` |
| `regionService` | `GET /api/regions`, `/snapshots`, `/{id}` |
| `modelService` | `GET /api/models`, `/{id}` |
| `driftService` | `GET /api/pattern-drift` |
| `planningService` | `GET /api/planning/outlook` |
| `reportService` | `GET /api/reports`, `POST /api/reports`, `/{id}/preview`, `/{id}/export` |

**Connecting FastAPI** is a change to one file. In `src/services/client.ts`, replace the body of
`request()` with a `fetch` against `API_BASE_URL` (reads `VITE_API_BASE_URL`, defaults to `/api`)
and flip `USE_LIVE_API`. Each service's `resolve` callback becomes the response parser. Nothing in
`pages/` or `components/` changes, because nothing there knows where the data comes from.

---

## The synthetic dataset

`src/mock/engine.ts` is not random numbers. It is one physically-plausible load model sampled at
different resolutions, which is why the 24-hour chart, the 10-year outlook and the seasonality
breakdown all agree with each other:

```
mw(region, t) = base
              × trend(t)              long-run compound growth
              × seasonal(region, t)   annual + semi-annual harmonics
              × daily(region, t)      hour-of-day load shape
              × weekly(region, t)     weekday/weekend behaviour
              × calendar(t)           public-holiday suppression
              × (1 + weather(t))      autocorrelated weather deviation
              × anomaly(region, t)    injected excursions
```

Everything is deterministic (hash-seeded, no `Math.random`), so the dataset is identical on every
load. The platform clock is pinned to **13 Aug 2026, 14:00**.

The five regions genuinely differ — a winter-peaking industrial belt behaves nothing like a
summer-peaking residential one:

| Region | Profile | Character | Load factor |
|---|---|---|---|
| North | Industrial | Winter-peaking, flat overnight floor, 3.1% CAGR | 0.68 |
| South | Residential | Strongly summer-peaking, sharp evening ramp, 5.8% CAGR | 0.56 |
| East | Mixed | Mildest seasonal swing on the grid, 3.6% CAGR | 0.62 |
| West | Commercial | Office-hours plateau, EV-charging shoulder, 4.4% CAGR | 0.52 |
| Central | Urban-dense | High overnight floor, dual seasonal peaking, 4.0% CAGR | 0.57 |

Grid totals: ~47 GW current demand, ~50 GW daily peak, 68.5 GW firm capacity.

### Derived, not authored

Three things that would normally be hardcoded are computed instead, so they respond to the data:

**Anomalies** (`mock/anomalies.ts`) are *detected*, not listed. The residual scale is estimated per
region and per hour of day using a median-absolute-deviation estimator — so the excursions being
hunted cannot inflate the very threshold meant to catch them. Detection requires 2.6σ **and** ≥5%
deviation **and** either two corroborating hours or a single ≥3.6σ reading. At 2σ with no
persistence gate the same data yields ~300 detections, 75% of them noise; the tuned detector yields
44 with a realistic severity spread.

**The model leaderboard** (`mock/models.ts`) is scored, not ranked by hand. Seven models are
evaluated against the observed series over a held-out temporal fold (rolling-origin, never a random
split). The winner falls out of the numbers — and it is not the same model everywhere: TFT leads
grid-wide and in four regions, **LightGBM wins West outright**, because tree ensembles do better on
that region's calendar-driven commercial profile. Change the region scope in the header and the
leaderboard re-ranks itself.

**Pattern drift** (`mock/drift.ts`) is measured against a *trend-extrapolated counterfactual*, not
a frozen historical constant. Comparing today's baseline to a fixed past value scores a decade of
ordinary 5% growth as "drift". Detrending first isolates the genuine level shift: South Region reads
+18.6% against where trend alone would have put it, and 259 days of repeat alerts are suppressed as
drift rather than re-reported.

---

## Data visualisation

The chart layer follows a single system defined in `charts/theme.tsx`.

**Palette.** The categorical, actual-vs-expected and ordinal-scenario palettes were run through a
CVD validator against the actual chart surface (`#111725`) and all pass the lightness-band, chroma,
colourblind-separation, normal-vision and contrast gates.

**Encoding decisions worth naming:**
- Actual and forecast share a hue — they are the same quantity, one observed and one projected.
  The dash pattern, the "now" divider and the legend carry the distinction, so it survives greyscale
  and colour-vision deficiency where a hue change alone would not.
- Model comparison is one measure, one colour. Seven models are a *ranking* of one quantity, not
  seven categorical series; giving each its own hue would encode nothing.
- Scenario arms are steps of one blue ramp with the range shaded, because the spread is the point —
  a single line reads as a prediction.
- One y-axis, always. Training cost and accuracy get separate charts rather than a second axis.
- Text wears text tokens, never the series colour; identity comes from the swatch beside it.

**Severity is never colour alone.** Every severity marker carries a distinct glyph
(◆ critical / ▲ high / ● medium / ■ low) *and* a text label. Red and green are inherently
confusable under deuteranopia — which is exactly why the glyph and the word are load-bearing.

---

## Accessibility

Semantic landmarks and a skip link; real `<table>` markup with `<caption>` and `aria-sort`;
radio-group semantics on segmented controls; `role="dialog"` + `aria-modal` with Escape-to-close,
focus capture and scroll lock; visible focus rings throughout; `aria-live` on loading and toast
regions; and `prefers-reduced-motion` honoured globally.

---

## Notes and limitations

- The dashboard is optimised for desktop and laptop, with a working tablet layout (sidebar
  collapses to an off-canvas drawer, tables scroll horizontally).
- "Export PDF" opens the browser print dialog scoped to the report preview. Shipping a PDF library
  to reimplement what the browser already does well was not worth the bundle weight.
- Alert acknowledgement and anomaly status changes persist for the session only. Against the real
  backend these become `PATCH` calls; the local override map in `anomalyService` disappears.
- Building the grid-wide model leaderboard takes ~0.5s of computation. It runs inside the service
  layer behind a loading state and is cached per scope — never on the render path.
