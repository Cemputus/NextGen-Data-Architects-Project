# UCU Analytics — Full System UI/UX Productionization Plan

## 1. Phased Plan (Execution Order)

| Phase | Scope | Why first |
|-------|--------|-----------|
| **1** | Global typography + design tokens (font, type scale, colors, spacing, radii) | Single source of truth; every page inherits. |
| **2** | AppShell (LayoutModern) + sidebar responsiveness + main content wrapper | Layout is the frame for all pages; mobile drawer must work. |
| **3** | Reusable PageHeader + PageContent; apply to all 9 role dashboards + shared pages | Consistent page structure and density. |
| **4** | Component standardization (Button, Input, Card, Select, Modal, Table) | No one-off sizing or spacing. |
| **5** | ECharts migration: BaseChart + presets (Line, Bar, Area, StackedBar, Donut) + chart theme | Charts aligned to design system; storytelling mix. |
| **6** | Dashboard storytelling: KPI → trend (line/area) → composition (stacked/donut) → detail | Avoid “all bar charts”; clear narrative. |
| **7** | Login, Auth, and unauthenticated pages | First impression and accessibility. |
| **8** | Analytics pages (FEX, High School, etc.), Export, Admin (Users, ETL, Audit, Settings) | High-traffic and complex UIs. |
| **9** | Loading / empty / error states; focus rings and a11y; performance (memo, debounce) | Polish and compliance. |

---

## 2. UI Audit — Top 10 Issues & Fixes

| # | Issue | Location | Fix |
|---|--------|----------|-----|
| 1 | Inconsistent page title sizes (text-2xl, text-3xl, text-4xl) | Login, many dashboards | Use design system: `.text-page-title` or `text-xl sm:text-2xl font-semibold`. |
| 2 | Login uses h-12 inputs and custom focus (border-2, focus:ring-blue) | Login.js | Standardize to h-9, use design system focus (ring-ring). |
| 3 | Body background animation (gradient 400%) can cause motion/performance issues | index.css | Prefer static or subtle gradient; respect prefers-reduced-motion. |
| 4 | Sidebar desktop width 256px fixed; no max-width on main content in some flows | LayoutModern | Keep 256/80; ensure main has max-w-7xl mx-auto and overflow-x-hidden. |
| 5 | Card styling mixed (shadow-lg, shadow-xl, shadow-2xl, border-2) | Many pages | Standardize: border shadow-sm, padding p-4, header p-4 pb-2. |
| 6 | Tables without consistent wrapper (overflow-x-auto, min-w) | Admin, HR, Finance | Always wrap tables in overflow-x-auto; use consistent th/td padding and text-sm. |
| 7 | Modals not constrained (max-w, max-height for viewport) | User management, exports | max-w-lg or max-w-xl; max-h-[90vh] overflow-y-auto. |
| 8 | Chart containers mix of fixed heights (h-96, h-[400px]) and min/max | Charts, RoleBasedCharts | Use min-h-[200px] max-h-[320px] and BaseChart; no fixed pixel heights. |
| 9 | Many dashboards bar-only; no trend (line/area) or proportion (donut) | RoleBasedCharts, FEX, HighSchool | Add line/area for time trends; donut/pie for composition where appropriate. |
| 10 | Focus visible and labels inconsistent (some buttons/inputs missing aria/labels) | Various | Enforce focus-visible:ring-2; ensure Label/aria-label on form controls. |

---

## 3. Design System Summary (Implemented)

- **Font:** Inter (Google Fonts), fallback system-ui.
- **Type scale:** Page title `text-xl sm:text-2xl font-semibold`; Section `text-lg font-semibold`; Card title `text-base font-semibold`; Body `text-sm`; Label/helper `text-xs`.
- **Colors:** CSS vars in `:root` / `.dark` (background, foreground, primary, muted, destructive, success, warning, border, ring). Tailwind theme extends from these.
- **Spacing:** Tailwind scale (2, 3, 4, 5, 6). Page/content padding: p-3 sm:p-4 md:p-5 lg:p-6.
- **Components:** Button h-9 (default), h-10 (lg); Input h-9; Card p-4, CardHeader p-4 pb-2, CardContent p-4 pt-0; Modal max-w-lg/xl.

---

## 4. Completed in This Session

- **index.css:** Body background respects `prefers-reduced-motion` (static when reduced; subtle gradient when motion OK).
- **Login:** Design system alignment — page title `text-2xl sm:text-3xl font-semibold`, card title `text-xl sm:text-2xl`, inputs `h-9`, standard focus; error block uses `role="alert"` and `id="login-error"` for a11y.
- **page-header.jsx:** `PageHeader` + `PageContent`; supports `title`, `description`/`subtitle`, `actions`/`children`.
- **chartTheme.js:** `formatTooltipValue()` and `defaultTitleTextStyle` for chart number formatting and titles.
- **EChartsComponents.jsx:** New `SciDonutChart` preset (proportions); uses `formatTooltipValue` in tooltip.
- **RoleBasedCharts.jsx:** Payment Status (non-student) and Grade Distribution use `SciDonutChart` for storytelling variety; line/area already used for trends.

## 5. Component Standardization (This Session)

- **Modal** (`ui/modal.jsx`): `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter`; max-w-lg/sm, max-h-[90vh] overflow-y-auto; role="dialog", aria-modal, aria-labelledby; Escape to close.
- **Table** (`ui/table.jsx`): `TableWrapper` (overflow-x-auto, border), `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` with design-system padding and header style.
- **States** (`ui/state-messages.jsx`): `LoadingState` (spinner + message, role="status"), `EmptyState` (icon, message, hint, action), `ErrorState` (message, retry, role="alert").
- **UserManagementSection**: All four modals use `Modal`; users table uses `TableWrapper`/`Table`/`TableRow`/`TableCell`; loading uses `LoadingState`; search/role filter have aria-labels and label.
- **AdminETL**: `PageHeader`/`PageContent`; `LoadingState`/`ErrorState`; both tables use shared Table components; "Show last" select has id and aria-label.
- **AuditLogSection**: `LoadingState`/`EmptyState`/`ErrorState`; table uses shared Table components; search input aria-label.
- **FEXAnalytics**: Detailed FEX table uses `TableWrapper`/`Table`; empty state uses `EmptyState`.
- **PageHeader/PageContent** applied to: AdminUsers, AdminETL, AdminAudit, AdminSettings, ProfilePage, ReportsPage, PredictionPage.

## 6. Verification Checklist

- [ ] Tested at **320px, 375px, 768px, 1024px, 1440px, 1920px**.
- [ ] No **overflow-x** on main content or dashboards.
- [x] **Typography** consistent via PageHeader (text-xl sm:text-2xl), design-system labels/body.
- [x] **Buttons/inputs/cards** use standard sizes; **modals** max-w + max-h; **tables** overflow-x + consistent th/td.
- [ ] **Sidebar** works on mobile (drawer) and desktop (collapsible).
- [x] **Charts** are ECharts only; BaseChart + presets; storytelling mix (line/area/stacked/donut).
- [x] **All 9 roles** share same layout and component patterns (PageHeader/PageContent on key pages).
- [x] **Loading/empty/error** states via shared components (LoadingState, EmptyState, ErrorState).
- [x] **Focus visible** (global CSS); **labels/aria** on UserManagement, Audit, Admin ETL, Login.
- [x] **SciChart** fully removed.
