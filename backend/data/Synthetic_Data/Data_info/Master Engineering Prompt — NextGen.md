Master Engineering Prompt — NextGen MIS / NextGen Analytics System
You are refactoring and upgrading the NextGen MIS / NextGen Analytics System into a production-grade institutional analytics platform with enterprise UI/UX, advanced BI capabilities, strict RBAC, PostgreSQL-first optimization, and a modular architecture that scales cleanly.

This is not a cosmetic patch. Treat this as a full platform hardening and analytics modernization initiative.

The final system should look and behave like a blend of:

Power BI

Tableau

modern SaaS admin platforms

institutional decision-support systems

The system must feel professional, analytical, modular, clean, fast, and role-aware.

1. Primary Objective
Upgrade the entire platform so that it becomes a high-end university analytics and management system capable of supporting:

executive decision-making

faculty and department-level monitoring

role-specific dashboards

custom dashboard authoring

reusable charts and KPI assets

SQL-first analytics through NextGen Query

recruitment and feeder-school intelligence

finance, academic, attendance, and risk analytics

strict role-based access control

PostgreSQL-backed performance and analytics reliability

The implementation must align with and incorporate the domain/business logic from the following merged reference body:

Canonical documentation to incorporate into the implementation
Use the merged business and data rules from:

Data_info/data_architecture.md

Data_info/data_description.md

Data_info/overall.md

Data_info/advanced_bi_analytics.md

Data_info/analytics_recommendations.md

Data_info/university_analytics_complete_documentation.md

Data_info/data_shema.md

school_recruitment_analytics_complete.md

And specifically implement in alignment with the unified master reference:

NextGen Analytics System – Master Technical Documentation

Data Description – University Analytics System

These documents define the required:

data architecture

warehouse semantics

schema constraints

grading and academic rules

KPI catalog

dashboard themes

high school recruitment analytics

data quality rules

ETL readiness expectations

time logic and academic timeline constraints

Do not ignore these documents. The application must reflect them in both backend logic and frontend analytics behavior.

2. Non-Negotiable Engineering Standards
Apply the following standards across the entire codebase:

2.1 Architecture
Refactor to a modular, domain-driven, maintainable architecture.

Enforce clear separation of concerns between:

presentation layer

page-level containers

reusable UI components

analytics visualization components

dashboard builder modules

query engine modules

RBAC / authorization modules

service layer

API layer

repository / data-access layer

PostgreSQL query layer

ETL / settings / admin modules

Avoid monolithic pages and duplicated logic.

2.2 Code quality
Enforce:

reusable components

typed contracts/interfaces

consistent naming

feature-based folder structure

composable services

centralized constants/config

centralized theme and design tokens

minimal code duplication

proper loading / empty / error states

safe guards around unauthorized access

scalable chart registry and dashboard metadata models

2.3 Product quality
The final system should feel:

elegant

premium

analytical

fast

organized

trustworthy

enterprise-ready

3. Full UI/UX Professionalization — Highest Priority
Redesign the entire interface across all roles to a modern enterprise standard.

3.1 Global design system
Implement a unified professional design system with:

consistent typography

spacing scale

page rhythm

card system

form styling

table styling

badges/status chips

modals/drawers

tabs

filters

breadcrumbs

chart containers

empty states

loading skeletons

alert banners

success/error messaging

Use a clean and highly professional visual language suitable for an analytics-heavy SaaS system.

3.2 Layout quality
All pages must use:

responsive grid layouts

strong information hierarchy

appropriate whitespace

consistent section headings

professional content density

fixed/clear navigation patterns

high-quality sidebar and page shell

polished header actions and filters

3.3 Dashboard aesthetic target
Dashboards should look like modern BI tools, not student projects.

They must support:

executive-grade KPI cards

drillable visuals

clean legends

contextual tooltips

cross-filter friendly layout

storytelling-driven arrangement

clear segmentation by theme

analytical summaries rather than random chart placement

3.4 Tables and analytics controls
Upgrade all data tables and filter panels to professional standards:

sticky headers where appropriate

searching

sorting

pagination

filter chips

scoped filters

export-ready patterns

visible active filter states

compact but readable layout

consistent row actions

4. Charts, KPIs, and BI Experience — Full Replacement
Remove all current charts and KPI cards. Do not retain the existing analytics visuals unless a component is structurally reusable.

Rebuild the analytics layer from scratch using the merged documentation as the semantic source of truth.

4.1 Replace all existing analytics
Perform a full analytics refresh:

remove all current charts

remove all current KPI cards

regenerate all analytical widgets

redesign chart selection per dashboard

build metrics using meaningful domain logic

stop using repetitive, boring chart patterns

4.2 Visualization quality target
The platform must reach a Power BI / Tableau level presentation standard in terms of:

visual hierarchy

chart selection quality

layout logic

business context

storytelling

drill-down readiness

interpretability

4.3 Chart diversity
Do not overuse bar charts.

Use a strategically varied chart library such as:

KPI cards

line charts

area charts

grouped bars

stacked bars

donut / pie charts where justified

heatmaps

trend charts

cohort-style visuals where applicable

scatter plots for relationship analysis

progress / completion visuals

comparative ranking charts

matrix-style summary views

faculty / department / program distribution charts

risk segmentation visuals

Each chart type must be chosen because it matches the metric story.

4.4 KPI and metrics redesign
Rebuild KPI cards based on the documentation, including but not limited to:

Academic KPIs
average GPA

CGPA distributions

pass rate

fail rate

FCW rate

FEX rate

MEX rate

retake rate

course difficulty score

progression rate

finalist count

at-risk student count

Financial KPIs
total expected tuition

total paid

outstanding balance

collection rate

sponsorship coverage

sponsored students count

payment completion rate

payment trend metrics

Engagement KPIs
attendance rate

absence rate

lateness rate

attendance-to-performance relationships

attendance deterioration alerts

Strategic / Executive KPIs
total students

active students

school / faculty coverage

departmental distribution

risk concentration

top feeder schools

district coverage

revenue by faculty/program

scholarship concentration

retention / persistence indicators

4.5 Dashboard storytelling
Every dashboard must have structure such as:

top summary KPIs

trend section

distribution/comparison section

detail analysis section

anomalies/risk section

optional recommendations / insight text blocks

Do not produce random dashboards with disconnected charts.

5. Strict Role-Based Access Control — Must Be Enforced Everywhere
The system has strict RBAC. This must be enforced at:

route level

page level

API level

query/data-access level

chart/data retrieval level

action/button visibility level

dashboard assignment level

saved chart visibility level

admin feature level

Do not implement RBAC only in the UI. Enforce it deeply.

5.1 Core roles
Implement and preserve the following real RBAC roles exactly:

Student

Staff

HOD

Dean

Senate

Analyst

HR

Finance

Sysadmin

5.2 RBAC interpretation
Use the following role rules as authoritative:

Student
can only view their own dashboards

can only view their own user info

can only edit limited personal fields

no access to user management, ETL, admin settings, or cross-user analytics

Staff
scoped to teaching / department responsibilities

can view students in allowed scope

can access staff dashboard

cannot access system administration or ETL

HOD
department-wide analytics only

can view department-level students and staff

no global access

no system user administration

Dean
faculty-wide analytics only

can view faculty-level students and staff

no global admin access

Senate
institution-wide read-only analytical visibility

no ETL control

no user management

read-only strategic academic governance access

Analyst
broad read access to analytical warehouse views

can create dashboards

can create and save charts

can share charts

can build custom dashboards

can use NextGen Query

cannot manage users or change RBAC definitions

HR
staff-focused analytics only

no broad student analytics except explicitly allowed HR-related views

Finance
payment, fees, sponsorship, and finance analytics access

no RBAC admin powers

Sysadmin
full system administration

user management

role assignment

ETL settings/control

audit log visibility

password reset capability

full access to all areas

5.3 Scope-aware visibility
The backend must apply scope filters where relevant:

students see only self

staff see only allowed courses/department scope

HOD sees department scope

dean sees faculty scope

senate sees read-only institution-wide data

analyst sees broad analytical data but not administrative powers

HR sees HR domain

finance sees finance domain

sysadmin sees all

5.4 Dashboard access model
Dashboards and chart assets must support controlled visibility by:

owner

shared users

shared roles

system role defaults

scoped institutional hierarchy where relevant

6. Custom Dashboards — Major Upgrade
The custom dashboard system needs a serious redesign.

6.1 Required capabilities
Custom dashboards must support:

dashboard creation

dashboard editing

dashboard duplication

dashboard assignment to user(s)

dashboard assignment to role(s)

chart selection from reusable chart library

drag-and-drop or flexible layout arrangement

save/update version flow

dashboard preview before publishing

clean dashboard metadata management

visibility rules based on RBAC

6.2 Current dashboards vs custom dashboards
Improve the dashboard manager experience so it clearly separates:

current/default dashboards by role

custom dashboards created by analysts

assigned dashboards

dashboard preview/open/edit actions

dashboard swapping/replacement workflows where applicable

6.3 Reusable chart asset model
Custom dashboards must be built from reusable chart assets rather than hardcoded widget definitions.

Each chart asset should carry metadata such as:

chart id

title

description

owner

source query / metric definition

chart type

allowed scopes

visibility settings

created by

tags/category

last updated timestamp

6.4 Dashboard builder UX
The dashboard builder should feel premium and organized:

left panel for available saved charts

central canvas/grid

properties panel for layout/config

preview mode

validation messages

assignment controls

7. NextGen Query — Major Enhancement
The NextGen Query page must become a serious analyst workspace, similar in spirit to Power BI query + SQL workbench + BI visualization studio.

7.1 Purpose
Analysts should be able to:

write SQL safely against allowed analytical views/tables

run queries

inspect tabular results

generate visualizations from results

save visualizations as reusable chart assets

reuse them in dashboards

share them to users/roles when permitted

7.2 Workspace layout
Design the page professionally with clear zones:

SQL editor / code area

results grid

visualization preview area

chart configuration controls

save/share actions

query history or recent queries if available

validation/error panel

7.3 Manage Charts rename and restructure
Rename the current section:

Manage charts I Shared

to:

Manage Charts

Inside Manage Charts, create two clear sections:

Manage Charts I Shared
Contains charts the analyst has actively shared with users or roles.

Saved Charts
Contains charts created and saved from NextGen Query or other chart-building workflows.

These are different concepts and must be represented separately.

7.4 Saved chart lifecycle
A chart generated in NextGen Query must support:

save as chart asset

assign title and description

select chart type

tag/category

visibility control

sharing to role/user

later editing of metadata

later reuse in custom dashboards

7.5 Reuse across the system
Saved Charts must become available in:

custom dashboard builder

dashboard editing workflows

analyst chart management page

share/assign workflows

7.6 SQL safety and scope
NextGen Query must not become an unrestricted raw SQL security hole.

Implement guardrails such as:

analyst-only access

safe query execution layer

read-oriented execution against approved schemas/views

blocked destructive statements

pagination/limits where necessary

explainable query errors

timeout and error handling

scoped database permissions appropriate to analyst capabilities

8. PostgreSQL-First Optimization — Mandatory
The system must be optimized around PostgreSQL as the authoritative database platform.

Treat PostgreSQL as essential for this analytics-heavy system.

8.1 Why this matters
This platform powers:

multi-domain analytics

dashboard aggregations

scoped RBAC queries

reusable chart assets

NextGen SQL querying

time-based slicing

future ETL and warehousing needs

The implementation must therefore exploit PostgreSQL strengths appropriately.

8.2 Required PostgreSQL improvements
Refactor data access and schema usage to support:

efficient indexing

query plan friendliness

materialized summary layers where appropriate

optimized joins

normalized relational structure

views for analyst-safe querying

secure role-aware filtering

clean separation between transactional tables and analytical views

8.3 Schema strategy
Align database structures to the merged documentation and warehouse semantics:

Recommended logical warehouse constructs include:

dim_student

dim_program

dim_department

dim_faculty

dim_course

dim_date

And fact-like structures such as:

fact_grades

fact_payments

fact_sponsorships

fact_attendance

fact_academic_performance

fact_transcript

fact_progression

You do not need to rigidly over-engineer, but the system must clearly respect dimensional / analytical modeling principles.

8.4 Query performance expectations
Optimize for common workloads such as:

dashboard aggregates by faculty / department / program / semester

GPA trends

payment trend analysis

attendance summaries

risk scoring

feeder-school analytics

chart-library retrieval

custom dashboard loading

role-scoped views

8.5 Database deliverables
Improve:

indexes

constraints

views

query abstractions

repository methods

analytical SQL definitions

reusable DB utility layer

migration structure if applicable

9. Incorporate the Full Domain Logic from the Master Documentation
The upgraded system must reflect the logic in the merged documentation. This includes both data semantics and analytics semantics.

9.1 Core university domains to support
The system must support the following analytics domains clearly and consistently:

academic performance intelligence

finance and tuition monitoring

sponsorship analysis

attendance and engagement analysis

student risk detection

progression and retake analysis

high school / feeder-school recruitment analytics

district recruitment analysis

executive institutional scorecards

SQL-first exploration via NextGen Query

9.2 Business logic to preserve
Respect the documented rules including:

coursework = 60%

exam = 40%

FCW rule

FEX rule

MEX rule

grade point mapping

GPA / CGPA logic

semester and academic year logic

intake logic

faculty/department/program hierarchy

date-driven analysis

synthetic/anonymized dataset assumptions

9.3 Data quality semantics to reflect in analytics
Analytics views and dashboards should assume and respect the documented constraints:

unique registration numbers

unique access numbers

all faculties/schools represented

all departments represented

all programs represented

coverage across academic, finance, attendance, and high-school domains

10. Recruitment / Feeder School Analytics — Must Be Visible in BI
The platform must incorporate the school recruitment intelligence described in the documentation.

10.1 Required recruitment analytics capabilities
Support analytics such as:

top feeder schools

district recruitment distribution

academic performance by school

failure rate by school

attendance behavior by school

sponsorship distribution by school

program preference by school

retention/persistence by feeder school

10.2 Dashboard coverage
Add or improve dashboards / sections for:

recruitment source analysis

geographic district analysis

feeder school ranking

school-to-performance relationships

school-to-finance / scholarship patterns

school-based strategic targeting insights

These should be presentation-quality and suitable for demos and institutional storytelling.

11. Seed Application Users — Required
Seed realistic app users for demo and system completeness.

11.1 Seed all required roles
Create seed users for all major roles where needed.

11.2 Lecturer seeding requirement
For each department, seed at least 4 to 5 lecturer/staff accounts.

Use realistic names and link them correctly to:

faculty

department

role

scope

11.3 Password requirement
Use the default password:

ChangeMe123
for all seeded demo users unless explicitly overridden by secure environment-specific logic.

11.4 Role correctness
Ensure seeded users reflect RBAC rules correctly, especially for:

dean assignments

HOD uniqueness where required

department scope

faculty scope

analyst users

finance users

HR users

senate users

sysadmin demo accounts

12. Admin and Sysadmin Experience
The Sysadmin role must have a truly professional admin console.

12.1 Admin areas
Support and improve:

User Management

role assignment

faculty/department assignment

password reset flows

ETL settings / ETL job visibility

audit log visibility

system settings

dashboard access oversight where appropriate

12.2 Security quality
Ensure admin actions are:

role-protected

auditable where possible

validated on the backend

reflected correctly in UI permissions

13. Recommended Feature Modules / Refactor Targets
Refactor the codebase into clean feature modules such as:

auth

rbac

users

admin

dashboard-core

dashboard-builder

chart-library

nextgen-query

analytics-academic

analytics-finance

analytics-attendance

analytics-recruitment

analytics-risk

etl

audit

shared-ui

shared-types

shared-utils

database

services

These names are illustrative; the key requirement is modular separation.

14. UI Components and Analytics Components to Standardize
Create or standardize reusable components such as:

page shell

metric card

analytic section header

filter bar

scoped selector controls

faculty/department/program selectors

date/semester selectors

chart card wrapper

empty state

unauthorized state

loading state

query result grid

SQL editor panel

dashboard grid item

chart picker modal

dashboard assignment modal

share chart modal

saved chart list item

role badge / scope badge

audit table

admin user table

15. Implementation Expectations for the Dashboards
Dashboards should be rebuilt or upgraded across the major role experiences.

15.1 Student dashboard
Focus on self-service views:

own GPA/performance

fees and balances

attendance

progression

personal academic summary

15.2 Staff dashboard
Focus on:

teaching views

departmental student insights in allowed scope

attendance and grade-related operational monitoring

15.3 HOD dashboard
Focus on department-level:

student count

GPA distribution

pass/fail patterns

course difficulty

staffing/teaching summaries where applicable

15.4 Dean dashboard
Focus on faculty-wide:

faculty performance

department comparisons

enrollment and finance summaries

risk distribution

15.5 Senate dashboard
Focus on institution-wide strategic, read-only analytics:

academic performance

feeder schools

risk

faculty comparisons

outcome summaries

15.6 Analyst dashboard/workspace
Focus on:

custom dashboards

saved charts

shared charts

NextGen Query

analytical exploration tools

15.7 Finance dashboard
Focus on:

tuition expected vs paid

outstanding balances

payment trends

sponsorship insights

program/faculty revenue views

15.8 HR dashboard
Focus on:

staff analytics

departmental staffing structure

HR-relevant views only

15.9 Sysadmin dashboard
Focus on:

system visibility

user counts

role distribution

ETL status

audit visibility

admin shortcuts

16. Deliverables Expected from This Refactor
Produce a complete implementation that includes:

full professional UI modernization

complete chart/KPI replacement

upgraded custom dashboards

upgraded NextGen Query workspace

Manage Charts with:

Manage Charts I Shared

Saved Charts

saved chart reuse inside dashboard builder

strict RBAC enforcement everywhere

PostgreSQL optimization and query cleanup

modular architecture refactor

seed users for all major roles, including 4–5 lecturers per department

alignment with merged documentation and academic/finance/recruitment logic

no regression of existing critical functionality

17. Final Product Standard
The final result must not look like an academic prototype.

It must look like:

an enterprise institutional analytics system

a premium BI-enabled MIS

a production-ready dashboarding and decision-support platform

The analytics experience should feel close to Power BI / Tableau, while the application shell and administration should feel like a modern enterprise SaaS platform.

Prioritize:

professionalism

clarity

modularity

performance

scalability

maintainability

strict authorization

analytical depth---------

1. Add FCW / MEX / FEX Analytics

Introduce analytics for the academic result status categories:

FCW — Failed Coursework

MEX — Missed Exam

FEX — Failed Exam

These analytics must be added without disrupting the current dashboards, chart logic, permissions, or existing UI behavior.

Required additions
Add analytical views, widgets, or sections that expose:

FCW counts

MEX counts

FEX counts

FCW / MEX / FEX rates

semester trend of FCW / MEX / FEX

faculty / department / program distribution of FCW / MEX / FEX

student-level FCW / MEX / FEX history where applicable

retake-related academic consequences derived from these statuses where applicable

These additions must align with the already documented grading logic:

coursework below threshold -> FCW

missing exam -> MEX

failed exam / failed threshold -> FEX

Do not alter the grading rules; only expose and analyze them better.

2. Correlate FCW / MEX / FEX with High School Data
Add correlation and comparative analytics between academic risk statuses and feeder/high-school background.

Use the existing high school and recruitment data model already present in the system and documentation.

Required correlation analysis
Add analytics showing relationships between:

HIGH_SCHOOL and FCW incidence

HIGH_SCHOOL and MEX incidence

HIGH_SCHOOL and FEX incidence

DISTRICT and FCW / MEX / FEX patterns

SCHOOL_TIER and FCW / MEX / FEX patterns

OWNERSHIP and FCW / MEX / FEX patterns

Recommended insight outputs
Expose views such as:

top high schools associated with highest FCW rates

top high schools associated with highest MEX rates

top high schools associated with highest FEX rates

district-level academic risk pattern summaries

school-tier comparisons for FCW / MEX / FEX

ownership-type comparisons for FCW / MEX / FEX

This should support recruitment, admissions, academic support, and institutional intervention analysis.

Do not remove any existing high-school analytics; only extend them.

3. Respect RBAC for These New Analytics
These new FCW / MEX / FEX and high-school correlation analytics must strictly follow the existing RBAC and scope rules already implemented in the system.

Scope by role
Apply the same visibility logic already used elsewhere:

Student: can only see their own FCW / MEX / FEX history, retake status, and personal academic risk indicators

Staff: only within permitted teaching / departmental scope

HOD: only within department scope

Dean: only within faculty scope

Senate: institution-wide read-only visibility

Analyst: broad analytical visibility

Finance / HR: only where already appropriate under existing access rules

Sysadmin: full visibility as already permitted

Do not broaden access for any role beyond its current authorization model.

4. Student-Level Retake Tracking
Add a student-facing capability that allows a student to clearly track whether they have any retake obligations.

Student experience requirements
The student should be able to see:

whether they currently have any retakes

which course(s) require retake

the reason for retake, where derivable from status history

related status (FCW, MEX, FEX)

attempt number, if available

progression / retake flag, if available

semester / academic year context

whether the retake is pending, completed, or still outstanding, if derivable from existing progression data

This should be presented clearly in the student dashboard or student academic area without changing the rest of the student UI.

Data sources
Use existing available structures such as:

grades

transcript

academic progression

performance facts

Do not invent new business logic if the current data model already supports it.

5. User-Facing Retake and Risk Views for Scoped Roles
Where appropriate for non-student roles, add scoped summaries for retake-risk monitoring.

Examples:

Staff can identify students in their scope with retakes

HOD can view department-level retake concentrations

Dean can view faculty-level retake patterns

Senate / Analyst can review institution-level retake and FCW/MEX/FEX trends

These views must remain within existing scope and permission boundaries.

6. Implementation Constraints
Do not change any of the following unless absolutely necessary for this feature addition:

existing UI structure

existing chart layout

existing dashboard organization

existing route structure

existing role definitions

existing page names

existing functionality

existing business rules

existing permissions

existing workflows

Only extend the system by adding these new analytical capabilities and student retake tracking.

If a new chart, widget, section, or table is needed, it must be added in a way that blends into the current design and architecture without forcing broader changes.

7. Output Standard
The enhancement should feel native to the current system, not like a disconnected patch.

It must:

preserve all existing behavior

add FCW / MEX / FEX insight cleanly

add high school correlation cleanly

give students clear retake visibility

respect all current RBAC and scope boundaries

.

Do not leave the system half-modernized. Upgrade it comprehensively and coherently.


