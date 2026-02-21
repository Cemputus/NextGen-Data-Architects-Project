# UCU Analytics Frontend: SciChart → ECharts & UI Productionization

## 1. Short Plan

### Phase 1 – Global layout & chart migration (priority)
- **Global container**: Refactor main content to use consistent `max-w-7xl mx-auto` with responsive padding (`p-3 sm:p-4 md:p-5 lg:p-6`), no overflow-x.
- **Chart library**: Remove SciChart; add `echarts` + `echarts-for-react`. Introduce reusable `<BaseChart />` and drop-in ECharts equivalents (Line, Bar, Area, StackedBar) with same prop API.
- **Why first**: Charts are used on every analytics/dashboard page; fixing them and the main container unblocks responsive behavior app-wide.

### Phase 2 – Dashboard & analytics pages
- **Role dashboards** (Student, Staff, HOD, Dean, Senate, Finance, HR, Analyst, Sysadmin): Standardize KPI grid (1 col mobile, 2 tablet, 3–4 desktop), reduce card padding, consistent chart container heights (min/max responsive).
- **Analytics sections** (FEX, High School, attendance/payment): Replace SciChart with ECharts; stack filters on small screens; ensure tables and charts don’t overflow.
- **Why next**: Highest density and responsiveness issues; chart-heavy and filter-heavy.

### Phase 3 – Components & polish
- **Cards, modals, tables**: Apply design-system spacing (e.g. CardHeader `p-4`, CardContent `p-4 pt-0`), normalize button/input heights, modal max-width.
- **Export/reports**: Compact forms and filters; professional report preview layout.
- **Why last**: Depends on layout and chart patterns being fixed first.

---

## 2. Top 10 UI pain points (audit)

| # | Issue | Location | Fix |
|---|--------|----------|-----|
| 1 | SciChart fixed heights (e.g. 450px), no container-based resize | All chart pages | ECharts + BaseChart with %/min-height, auto-resize |
| 2 | Over-wide / inconsistent main content width | LayoutModern main | `max-w-7xl mx-auto` + responsive padding |
| 3 | Large card padding (p-6 everywhere) | Card, CardHeader, CardContent | Reduce to p-4; p-4 pt-0 for content |
| 4 | Chart containers too tall (h-[300px]–450px) | Charts.js, RoleBasedCharts, FEX, HighSchool | Responsive min/max height (e.g. min-h-[200px] max-h-[320px]) |
| 5 | KPI/dashboard grids not responsive (fixed cols) | Various dashboards | 1 / 2 / 3–4 cols by breakpoint |
| 6 | Filters in long horizontal rows on mobile | GlobalFilterPanel, analytics pages | Stack vertically on sm |
| 7 | Tables overflowing on small screens | Data tables across app | overflow-x-auto + min-w on table wrapper |
| 8 | Oversized headings (text-2xl page titles) | Page headers | Slightly smaller on mobile (text-xl sm:text-2xl) |
| 9 | Modal / form bloat | Modals, export forms | Max-width, compact padding |
| 10 | Inconsistent spacing scale | Global | Tailwind spacing only (2, 3, 4, 5, 6) |

---

## 3. Design system (Tailwind)

- **Spacing**: 2, 3, 4, 5, 6 (no arbitrary values).
- **Typography**: Page title `text-xl sm:text-2xl`, section `text-lg`, card title `text-base font-semibold`, body `text-sm`, labels `text-xs`.
- **Components**: Button height `h-9`/`h-10`, input `h-9`; card padding `p-4`; modal `max-w-lg`/`max-w-xl`; chart container padding `p-2` inside card.
- **Responsiveness**: sm (480+), md (768+), lg (1024+), xl (1280+), 2xl (1536+). No horizontal scroll on body; grids use `minmax(0, 1fr)` where needed.

---

## 4. Verification checklist (mandatory)

- [ ] Tested at **320px**, **375px**, **768px**, **1024px**, **1440px**, **1920px**.
- [ ] No **overflow-x** on main content or dashboards.
- [ ] Dashboards consistent across **all roles** (KPIs, charts, filters).
- [ ] **Charts resize** correctly with container (ECharts via `echarts-for-react`; `BaseChart` uses min/max height).
- [ ] **Tables** usable on mobile (`overflow-x-auto` on table wrappers).
- [ ] No **oversized** cards, modals, or chart containers (chart containers use `min-h-[200px] max-h-[300px]` or `max-h-[320px]`).
- [ ] **SciChart** fully removed; all charts use **Apache ECharts** via `echarts-for-react` and `<BaseChart />` / `EChartsComponents.jsx` (SciLineChart, SciBarChart, SciAreaChart, SciStackedColumnChart).

## 5. Implemented changes (this pass)

- **DashboardGrid**: Explicit Tailwind grid classes (COLS_MAP, SM_COLS, MD_COLS, LG_COLS) so 1–5 columns work at all breakpoints without purge; gap `gap-3 sm:gap-4`.
- **Charts.js**: Removed fixed `h-[280px]`; chart wrappers use `min-h-[200px] max-h-[300px] w-full`; compact CardHeader/CardContent (`p-4 pb-2`, `p-4 pt-0`); card titles `text-base font-semibold`; grids `grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4`.
- **RoleBasedCharts**: Replaced all `h-[450px]` / `height={450}` with `chartContainerClass` `min-h-[200px] max-h-[320px]`; compact card headers; `space-y-4`; cards use `border shadow-sm` and 4px left border accent.
- **LayoutModern**: Main content padding `px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-6 lg:py-5`; header title `text-base sm:text-lg md:text-xl` with `truncate`.
- **StudentDashboard**: `space-y-4`; responsive page title `text-xl sm:text-2xl`; header stacks on mobile (`flex-col gap-3 sm:flex-row`); TabsList `grid-cols-2 sm:grid-cols-4 gap-1 p-1`.
- **FEXAnalytics**: Responsive header and filters; chart containers `min-h-[200px] max-h-[320px]`; compact cards; TabsList `grid-cols-2 sm:grid-cols-4`; loading state `py-8`, smaller spinner.
- **HighSchoolAnalytics**: Same pattern as FEXAnalytics; TabsList `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`.
- **BaseChart**: Doc comment updated; no logic change (echarts-for-react handles resize).
