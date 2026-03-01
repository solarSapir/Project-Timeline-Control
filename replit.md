# Solar PM - Project Tracker

## Overview
Solar PM is a project management application designed for solar installation companies. It integrates with Asana to synchronize project data, offering specialized views for managing the entire lifecycle of solar installation projects. Key capabilities include tracking UC applications, contracts, permits, installations, payments, and close-off stages, with automated deadline management and dependency gating. The application aims to streamline operations, improve project visibility, and ensure timely completion of solar projects.

## User Preferences
- Solar installation company (Solar Power Store)
- Uses Asana "Project Manage Team" project for task management
- Two project types: Install and DIY (work views focus on Install; All Customers page shows everything)
- Teams: UC team, AHJ/permitting team, install coordinators, payment collection

## System Architecture

### Stack
- **Frontend**: React + TypeScript, Tailwind CSS, Shadcn UI, Wouter routing, TanStack Query
- **Backend**: Express.js, Drizzle ORM, PostgreSQL

### Core Features and Design
- **Project Lifecycle Management**: Tracks solar projects through stages: UC Applications, Contracts, Site Visits, AHJ/Permitting, Installation, Payments, and Close-off.
- **Asana Two-Way Sync**: Bidirectional integration with Asana, using it as the single source of truth for project data and custom fields.
- **Workflow Configuration**: Settings interface for defining stage dependencies, customizable gap days, and completion criteria with a visual editor.
- **Dependency Gating**: Projects only appear in subsequent workflow views once preceding dependencies are met.
- **Chained Due Dates**: Due dates are calculated relative to previous stages' completion or due dates.
- **Dynamic Gantt Chart**: Visualizes project timelines with target vs. expected dates.
- **Hydro Bill Information Extraction**: UC cards allow manual entry or AI-powered extraction of data from uploaded hydro bill images using OpenAI Vision.
- **Installation Calendar**: Monthly calendar view of installations with cascading target date logic.
- **Project Profile Page**: Comprehensive view for each project, displaying all stage values, Gantt chart, documents, and a unified Customer Timeline merging task actions, UC completions, and rebate completions.
- **Component-Based UI**: Modular frontend structure with reusable components and shared utilities.
- **Property Sector Filtering**: Project views exclude non-residential projects based on an Asana custom field.
- **HRSP Document Checklist & Configuration**: Two-phase document tracking for HRSP based on grant status, configurable via settings, including invoice template editing. All document uploads are logged as task_actions for audit trail and timeline visibility.
- **UC, Rebate & Contract KPI Systems**: Track workflow completions, hide/reappear logic, and key performance indicators with dashboards, configurable workflow rules, and drill-down views for UC, Rebate, and Contract completions. "Avg Days to Submit" KPI uses HRSP subtask creation date (falls back to project creation date if unavailable). Contract KPIs track: This Week completions, Avg Tasks/Day, Avg Days to Upload/Review/Sign/Deposit. All KPI sections use shared FormulaTooltip component for formula explanations.
- **Contract Ready for Review Workflow**: Contracts with uploaded documents can be marked "Ready for Review", which hides the project for a configurable period (default 24h via `contract_workflow_rules`). After the hide period, the project reappears with a follow-up dialog. Sidebar shows expandable Contracts item with "To Create" and "Ready for Review" sub-filters with badge counts.
- **KPI Consistency Rule**: All KPI sections (UC, Rebate, Contract) must include FormulaTooltips on every metric card. When adding tooltips/drilldowns/improvements to one KPI section, apply the same to all KPI sections.
- **Escalated Tickets System**: Staff can flag "stuck" projects, creating escalation tickets with a configurable hide period (default 48 hours, adjustable in Settings > Escalation Settings) for manager resolution. Structured 3-section reporting (done so far / stuck on / need from manager) with file uploads. Resolution notes are saved and posted to the latest matching Asana subtask for the team. Customer profile shows full escalation ticket history with collapsible section and inline respond/resolve actions. Project cards show open/resolved ticket counts via EscalationBadge. UC expanded view also shows inline escalation ticket history. SLA timer (48h) displayed on all open/responded tickets showing countdown or overdue duration. Snooze/Extend Hide feature allows hiding tickets for up to 14 days.
- **Escalation KPI Dashboard**: Dashboard section showing 5 KPI cards: Open Tickets, Past 48h SLA (overdue), Avg Response Time, Avg Resolution Time, and SLA Compliance rate. API endpoint at `/api/escalation/kpi-stats` calculates all metrics from escalation_tickets table.
- **Local File Storage System**: All file uploads are stored locally on the server filesystem, organized by project and category. Asana attachments remain viewable.
- **Project Documents Section**: Project profile includes a Documents section with categorized folders, file management, and SharePoint links.
- **PM Status Change Dialog**: Changing PM Status on the project profile page triggers a required-note popup (with optional file upload) that posts the note and attachments to the Asana main task timeline. Staff name selection required.
- **Main Timeline View**: Project profile page includes a scrollable "Project Main Timeline" section at the bottom, showing all comments and attachments from the Asana parent task — similar to how subtask comments are displayed in individual tabs. Users can also post new comments and upload files directly from this view.
- **Internal App Logic Documentation**: Visual documentation at `/app-logic` with interactive React Flow diagrams for database schema, API map, and workflow logic flows.
- **Live Auto-Refresh**: All data queries poll every 30 seconds by default (staleTime: 15s, refetchInterval: 30s, refetchOnWindowFocus: true). Static config data (field options, workflow config) polls every 5 minutes. Asana API queries (subtask stories/attachments) poll every 60 seconds to avoid rate limiting. Configured in `client/src/lib/queryClient.ts` defaults.
- **Sidebar Badge Counters**: Every work view tab in the sidebar shows a badge counter with the number of items needing action. Escalated Tickets uses a red (destructive) badge; all others use a neutral secondary badge. Zero counts are hidden. Counts computed by `useSidebarCounts` hook using projects, escalation tickets, and workflow config data.
- **Paused Projects View**: New `/paused` page at the top of the sidebar views. Shows all projects where PM Status is "Project Paused" with project name, province, install type, UC/AHJ status, contractor info, and escalation badges. Search functionality included.
- **PM Status Breakdown Chart**: Dashboard pie chart (recharts) showing how many projects are in each PM Status with unique colors per status, counts, percentages, eye toggle to hide/show statuses (recalculates % and total for visible only), drill-down dialog on click, and Install/DIY/All filter tabs. Complete and Project Lost hidden by default.
- **Pause Reason Logging**: Each pause event is logged to `pause_logs` table (like escalation tickets) with reason, note, staff name, and timestamp. Paused project cards have expandable section to log new pause reasons from a dropdown of common reasons (stored in `pause_reasons` table, grows over time with usage counts), custom reason entry, free-text note, and staff selection. Full pause history shown per card. Dedicated `/insights` sidebar tab below Settings shows KPI cards (currently paused, total pause events, unique projects, repeat pausers), reason breakdown with bar charts, AI-powered analysis, and recent pause log feed.
- **Project Planner View**: New `/planner` page between AHJ and Install Coordination in sidebar. Full pre-install preparation checklist: Confirm Scope of Work, Upload Final Proposal (customer-agreed version), Upload Site Plan, Total Project Cost (customer billing amount), Contractor Payout Amount, Contractor Assignment (syncs to Asana), Contractor Contract Sent, Contractor Contract Signed, and Electrical Permit (NS-only). Install projects are hidden from all UC view filters until the full planner checklist is complete; they appear under "Awaiting Planner" filter in UC view. **Proposal and Site Plan sync bidirectionally** between Planner and Contract Documents dialog — uploading from either location stores the file in both planner and contract categories and updates the planner URL fields. Contract dialog shows green "Already uploaded from planner" indicators. **Focus mode**: Each card has Subtasks toggle (inline) and Focus button (opens dialog with checklist + planning subtask side-by-side). Planning subtask connects to Asana subtask containing "Plan" in name, or auto-creates "Planning" subtask. Schema fields: `plannerScopeConfirmed`, `plannerProposalUrl`, `plannerSitePlanUrl`, `plannerTotalCost`, `plannerContractorPayout`, `plannerContractSent`, `plannerContractSigned`, `electricalPermitUrl`.

### Database Tables
- `users`, `projects`, `project_deadlines`, `task_actions`, `install_schedule`, `workflow_config`, `error_logs`, `hrsp_config`, `project_files`, `escalation_tickets`, `uc_completions`, `uc_workflow_rules`, `rebate_completions`, `rebate_workflow_rules`, `staff_members`, `pause_reasons`, `pause_logs`, `task_claims`, `contract_completions`, `contract_workflow_rules`.

## Asana Independence Strategy
**Long-term goal: fully disconnect from Asana without data loss.**
- All new features must store data locally first (database + filesystem). Asana sync is secondary and non-blocking — if Asana calls fail, the app must still work.
- Every feature that currently reads from Asana should have a local fallback or local data copy.
- Document uploads, task actions, comments, and status changes are all stored in our database. Asana gets a copy for backwards compatibility.
- Subtask hierarchy (Parent → Install Team → Client Contract, etc.) is managed in Asana but will eventually be replaced with local task/subtask tracking.
- When reviewing or building features, wrap all Asana API calls in try/catch with non-blocking error handling. The app must function if Asana is unreachable.
- File attachments are stored in PostgreSQL (`project_files.file_data` bytea column) AND on disk in `data/uploads/`. The database is the persistent source of truth; disk is a cache that auto-restores from DB if files are missing. Files also get uploaded to Asana subtasks for backwards compatibility.

## External Dependencies
- **Asana API**: For project synchronization, task management, custom field data, and project stories. (Planned for eventual removal — see Asana Independence Strategy above.)
- **Replit Connector**: Secure authentication and connection to Asana.
- **OpenAI Vision (gpt-4o)**: AI-powered data extraction from hydro bill images.
- **PostgreSQL**: Relational database.
- **PostgreSQL + Local Filesystem**: File uploads stored in DB (persistent) + disk cache. DB is source of truth.

## App Logic Documentation (Maintenance Convention)
- **Location**: `/app-logic` route with sub-routes for schema, API map, and 14 tab-specific flow diagrams
- **Files**: `client/src/pages/app-logic/` (17 files), `client/src/components/app-logic/` (2 files)
- **Library**: `reactflow` for interactive node-based diagrams
- **Standard**: Whenever a new feature is added or an existing feature is modified, update the corresponding App Logic flow diagram and schema view in the same session. This includes:
  - Adding new tables to `SchemaView.tsx` (with correct domain color)
  - Adding new API endpoints to `ApiMapView.tsx` (with method, path, description, tables, usedBy)
  - Updating flow nodes/edges in the relevant `flows/*FlowView.tsx` file
  - Updating `AppLogicIndex.tsx` if the table/endpoint count changes
- **Node types** in flow diagrams: `data` (blue), `filter` (amber), `action` (green), `dialog` (purple), `api` (emerald), `component` (indigo), `logic` (orange)