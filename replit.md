# Solar PM - Project Tracker

## Overview
A solar installation project management application that connects to Asana to sync projects and provides team-specific work views for managing the full lifecycle of solar installation projects. The app tracks UC applications, contracts, permits, installations, payments, and close-off stages with automated deadline tracking.

## Recent Changes
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
- `/uc` - UC Application view for managing utility connection stages
- `/contracts` - Payment Method view (tracks "How will the customer pay" from Asana, 7-day deadline from creation)
- `/contract-creation` - Contracts view (UC-ready projects needing contracts, due UC+7d, reads "Date Contract sent to customer" from Asana)
- `/site-visits` - Site Visit booking and tracking
- `/ahj` - AHJ/Permitting view for building permit workflow
- `/installs` - Installation Coordination (scheduling, installer management)
- `/payments` - Rebates view (tracks "GRANTS STATUS." from Asana)
- `/close-off` - Project close-off (final docs, permits, photos, marketing notification)
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
