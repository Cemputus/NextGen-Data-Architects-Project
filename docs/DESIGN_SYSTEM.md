# NextGen Analytics — Design System (Phase 4)

Single source for typography, spacing, colors, and reusable components across all role-based dashboards.

---

## 1. Tokens

### Color (CSS variables)

Defined in `frontend/src/index.css` under `:root` and `.dark`:

- **Semantic:** `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--success`, `--warning`, `--border`, `--input`, `--ring`, `--card`, `--popover`
- **Tailwind:** Use `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, etc.

### Spacing & radius

- **Spacing:** Tailwind default scale (1 = 4px, 2 = 8px, …). JS constants in `frontend/src/config/designTokens.js` (`SPACING`).
- **Radius:** `--radius` (0.5rem); use `rounded-lg`, `rounded-xl` for cards and modals.

### Typography

Classes in `index.css` (use these or Tailwind equivalents):

| Class | Use |
|-------|-----|
| `.text-page-title` | Page title (xl/2xl, semibold) |
| `.text-section-title` | Section heading (lg, semibold) |
| `.text-card-title` | Card/chart title (base, semibold) |
| `.text-body` | Body text (sm) |
| `.text-label` | Labels, captions (xs, muted) |

Font: Inter, system-ui, sans-serif.

### Chart palette

- **JS:** `frontend/src/config/designTokens.js` — `CHART_PALETTE` (10 distinct colors), `CHART_PALETTE_SEQUENTIAL` (5-step), `SEMANTIC_COLORS`.
- Use `CHART_PALETTE` in ECharts/Recharts for series colors so all dashboards share one palette.

---

## 2. Reusable components

| Component | Location | Purpose |
|-----------|----------|---------|
| **PageShell** | `components/shared/PageShell.jsx` | Page wrapper: title, breadcrumbs, actions, main content |
| **PageHeader / PageContent** | `components/ui/page-header.jsx` | Title, description, breadcrumbs (Link-based), actions |
| **MetricCard** | `components/shared/MetricCard.jsx` | KPI tile: title, value, trend, icon, variant |
| **AnalyticSection** | `components/shared/AnalyticSection.jsx` | Section header + divider + content |
| **FilterBar** | `components/shared/FilterBar.jsx` | Faculty / department / program / semester / date filters |
| **ChartCard** | `components/shared/ChartCard.jsx` | Chart wrapper: title, loading/error/empty, optional export |
| **FilterChips** | `components/shared/FilterChips.jsx` | Active filter chips with clear-one / clear-all |
| **DataTable** | `components/shared/DataTable.jsx` | Table: sticky header, sort, pagination, search, export |
| **Badge** | `components/ui/badge.jsx` | Status chips, role labels |
| **Modal** | `components/ui/modal.jsx` | Dialog: ModalHeader, ModalBody, ModalFooter |
| **Tabs** | `components/ui/tabs.jsx` | Tab list + content |
| **AlertBanner** | `components/ui/alert-banner.jsx` | Inline alert: info, success, warning, error |
| **Skeleton** | `components/ui/skeleton.jsx` | Loading placeholders (SkeletonLine, SkeletonCard, SkeletonTable) |
| **EmptyState** | `components/shared/EmptyState.jsx` | No-data state with icon, message, action |
| **UnauthorizedState** | `components/shared/UnauthorizedState.jsx` | Access-restricted state |
| **LoadingState / ErrorState** | `components/ui/state-messages.jsx` | Loading spinner; error with retry |

---

## 3. Layout & navigation

- **App layout:** `LayoutModern.jsx` — sidebar, top bar, mobile drawer. All authenticated routes use this layout.
- **Page hierarchy:** Page title → sections (summary, trends, distributions, details, risk/alerts). Use `PageShell` or `PageHeader` + `PageContent` for consistency.
- **Breadcrumbs:** Provided by `PageHeader` (Link-based) or `PageShell` (breadcrumbs prop). Sidebar and header actions are aligned in `LayoutModern`.

---

## 4. Tables and filters

- **DataTable:** Sticky header, column sort, client-side pagination, optional search and `onExport`. Use for tabular data.
- **FilterBar:** Faculty → department → program cascade; semester and optional date range. Disable by role when scope is fixed.
- **FilterChips:** Show active filters as chips; support remove single / clear all. Place above tables or next to FilterBar.

---

## 5. Accessibility

- Use semantic HTML and ARIA where needed (`role="alert"`, `aria-label`, `aria-live`).
- Focus visible: `*:focus-visible` uses `--ring` in `index.css`.
- Respect `prefers-reduced-motion` for gradients and animations (see `index.css`).
