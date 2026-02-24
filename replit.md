# Solar PM - Project Tracker

## Overview
A solar installation project management application that connects to Asana to sync projects and provides team-specific work views for managing the full lifecycle of solar installation projects. The app tracks UC applications, contracts, permits, installations, payments, and close-off stages with automated deadline tracking.

## Recent Changes
- 2026-02-24: Chained Due Dates — due dates now chain relative to each other (UC → Contract +7d → SV +7d → AHJ +14d → Install +7d → Close-off +7d) instead of all from project start. When AHJ is "Not Required" or "Closed", AHJ due = SV due (0 gap). Install calendar cascading logic updated to match. Settings page shows gap days relative to previous stage with cumulative timeline.
- 2026-02-24: Workflow Configuration — Settings page now has visual workflow editor showing stage dependency chain (which stages depend on others, which run in parallel). Editable gap days per stage with cumulative timeline overview bar chart. Persisted in `workflow_config` DB table. API: GET/PUT /api/workflow-config.
- 2026-02-24: UC Hydro Bill Info — each UC card has a "Hydro Bill Info" section where staff can upload hydro bill (sent to Asana as attachment) or manually enter hydro company name, account number, and customer name on bill. AI-powered scan auto-extracts fields from image uploads using OpenAI vision (gpt-4o). DB fields: hydroBillUrl, hydroCompanyName, hydroAccountNumber, hydroCustomerName. Route: POST /api/projects/:id/hydro-bill.
- 2026-02-24: UC Expanded Focus View — "Expand" button on each UC card opens a full-screen dialog with project details (status, UC team, province, utility, due dates, SharePoint link), hydro bill info, and all UC subtasks side by side for focused work.
- 2026-02-24: All Projects view — table of all install/residential projects with color-coded status pills for every stage (UC, Rebates, Contract, Site Visit, AHJ, Install, Close-off). Searchable, filterable by province, sortable columns. Route: /all.
- 2026-02-24: Fixed Asana sync pagination — switched from SDK client to direct REST API calls to properly paginate all tasks (was only getting first 100, now fetches all ~450).
- 2026-02-24: Project Profile page — click any project name across all views to see full profile with all stage values, Gantt chart (target vs expected dates), recent activity, and customer notes. Route: /project/:id.
- 2026-02-24: Install Calendar — cascading target date logic: when a stage is late (past due and not complete), its adjusted target = today + 7 days, and all downstream stages cascade (UC→Contract: +14d, Contract→SV: +7d, SV→AHJ: +14d, AHJ→Install: +7d). Day cells are clickable to expand full project list in a dialog. Stage gaps: UC→Contract 14d, Contract→SV 7d, SV→AHJ 14d, AHJ→Install 7d. Route: /install-calendar.
- 2026-02-24: Installation Coordination rebuilt — projects enter when AHJ Status = "Permit Issued". Target due = AHJ due + 7 days. Expected due = AHJ completion date + 7 days (from task_actions). Shows Running Late when expected > target. Filters: Permit Issued, Waiting AHJ, Late, Overdue, Scheduled. Schedule dialog for equipment, install, disconnect, inspection tasks.
- 2026-02-24: AHJ view rebuilt — depends on site visit completion. Target due date stays fixed (from project gantt). Expected due date = site visit completion + 21 days (based on task_actions completedAt). Shows "Running Late" when expected > target. Filters: Action Needed (site visit done), Waiting Site Visit, Late, Overdue, Complete. P.eng fee is part of the $1,500 deposit (not separate).
- 2026-02-24: Site Visits view rebuilt — only shows projects where Install Team Stage = "Pending site visit". Due date = contract due + 7 days. When "Site visit Request" = "Visit Complete", user uploads photos + installer notes via dialog → creates "Site visit Photos" subtask in Asana with attachments and comments. Filters: Pending, Booked, Complete, Overdue.
- 2026-02-24: Install Team Stage workflow — 3 checkboxes: Contract Sent (→ "Pending Contract to be signed"), Contract Signed (→ "Pending Deposit"), $1,500 Deposit (→ "Pending site visit" if site visit not done, "Active Install" if Visit Complete/Booked). Contract follow-up dialog (24hr cadence) with screenshot upload posts to Asana timeline. Auto-corrects "NEW CX pending other teams" → "Need contract" when UC complete. Auto-advances "Pending site visit" → "Active Install" when site visit done. All syncs to Asana bidirectionally.
- 2026-02-24: Contract document upload & approval — staff upload Word contract, proposal, and site plan to Asana (labeled CONTRACT/PROPOSAL/SITE PLAN). Manager reviews downloads from Asana, then clicks Approve to post approval comment. Status tracked per project (Pending Review / Approved). Routes: POST /api/projects/:id/contract-documents (multipart), POST /api/projects/:id/contract-approve.
- 2026-02-24: Contracts view added — tracks contract creation for UC-ready projects (Approved/Complete/Not Required). Due date = UC due + 7 days. Shows "Date Contract sent to customer" and follow-up dates from Asana. Filters: needs contract, sent, overdue.
- 2026-02-24: Property Sector filter — all views exclude non-residential projects (Commercial, Industrial, Agricultural, Institutional, Multi-Residential). Blank/null = Residential. Field synced from Asana "Property Sector" custom field.
- 2026-02-24: Rebates view enhanced — for Load Displacement + Ontario projects, fetches "Home Renovation Savings Program (ON)" subtask GRANTS STATUS from Asana. Flags missing HRSP subtasks. 14-day deadline from project creation. Sidebar reordered: Rebates now right below UC Applications.
- 2026-02-24: UC view enhanced — shows "UC Team" badge (Net metering/Load displacement/No-Off grid), tracks submission date & user from Asana Stories API, weekly follow-up alerts for submitted projects, follow-up dialog with screenshot upload posts to Asana timeline. Off-grid projects (UC TEAM = "No/ Off grid") get UC due date = creation date.
- 2026-02-24: Fixed UC field mapping — now reads "UC TEAM STATUS" (not "UC Team" which is a different field). Completed UC apps (Approved/Complete/Not Required) hidden by default with filter options.
- 2026-02-24: Replaced "Contracts & Payments" with "Payment Method" view (tracks "How will the customer pay" Asana field, 7-day deadline from project creation) and "Payment Collection" with "Rebates" view (tracks "GRANTS STATUS." Asana field). Both sync bidirectionally with Asana.
- 2026-02-24: Added due date calculations from project creation date (UC +21d, contract +35d, site visit +42d, AHJ +56d, install +70d, close-off +84d) with overdue badges
- 2026-02-24: Added two-way Asana sync — status changes in the app now push back to Asana via REST API. All dropdowns dynamically load enum options from Asana custom fields. Asana is the single source of truth.
- 2026-02-24: Initial build with Asana integration, all work views, and deadline tracking

## Architecture

### Stack
- **Frontend**: React + TypeScript, Tailwind CSS, Shadcn UI, Wouter routing, TanStack Query
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Integration**: Asana API via Replit connector (connection:conn_asana_01KJ87H9ZADXMNKS3AVDTX4CKY)

### Database Tables
- `users` - App users
- `projects` - Synced from Asana with custom field mappings (UC status, UC team, AHJ status, payment tracking, ucSubmittedDate/By from Stories API, etc.)
- `project_deadlines` - Calculated deadline targets for each project stage
- `task_actions` - Team member task completions and follow-ups
- `install_schedule` - Installation scheduling (equipment, start dates, inspections)

### Pages / Views
- `/` - Dashboard with stats, charts, and project overview
- `/all` - All Projects table with color-coded stage status pills
- `/uc` - UC Application view for managing utility connection stages
- `/contracts` - Payment Method view (tracks "How will the customer pay" from Asana, 7-day deadline from creation)
- `/contract-creation` - Contracts view (UC-ready projects needing contracts, due UC+7d, reads "Date Contract sent to customer" from Asana)
- `/site-visits` - Site Visit booking and tracking
- `/ahj` - AHJ/Permitting view for building permit workflow
- `/installs` - Installation Coordination (scheduling, installer management)
- `/payments` - Rebates view (tracks "GRANTS STATUS." from Asana)
- `/close-off` - Project close-off (final docs, permits, photos, marketing notification)
- `/install-calendar` - Monthly calendar view of expected install start dates
- `/project/:id` - Project profile with all stage details, Gantt chart, recent activity
- `/sync` - Asana Sync settings

### Key Files
- `shared/schema.ts` - Database schema, types, status constants, deadline configs
- `server/asana.ts` - Asana API integration (auth via Replit connector)
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - Database CRUD operations
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/components/task-action-dialog.tsx` - Task completion + follow-up dialog
- `client/src/components/status-badge.tsx` - Color-coded status badges
- `client/src/components/timeline-indicator.tsx` - Project timeline health indicators

### Default Deadline Timeline (weeks from project start)
- UC Application: 0-4 weeks
- Rebates & Payment Method: 0-2 weeks
- Contract & Permit Payment: weeks 4-5 (after UC + rebates)
- Site Visit: weeks 4-6 (after contract)
- AHJ/Permitting: weeks 5-7 (after site visit)
- Install Booking: week 8 (after AHJ)

## User Preferences
- Solar installation company (Solar Power Store)
- Uses Asana "Project Manage Team" project for task management
- Two project types: Install and DIY (currently focusing on Install)
- Teams: UC team, AHJ/permitting team, install coordinators, payment collection
