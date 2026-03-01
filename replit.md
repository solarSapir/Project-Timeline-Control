# Solar PM - Project Tracker

## Overview
Solar PM is a project management application for solar installation companies. It synchronizes with Asana to manage the entire lifecycle of solar installation projects, including UC applications, contracts, permits, installations, payments, and close-off stages. The application provides automated deadline management, dependency gating, and aims to enhance project visibility and operational efficiency for timely project completion.

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
- **Project Lifecycle Management**: Tracks projects through stages: UC Applications, Contracts, Site Visits, AHJ/Permitting, Installation, Payments, and Close-off.
- **Asana Two-Way Sync**: Bidirectional integration with Asana, serving as the single source of truth for project data.
- **Workflow Configuration**: Settings for defining stage dependencies, customizable gap days, and completion criteria with a visual editor.
- **Dependency Gating & Chained Due Dates**: Projects progress only when dependencies are met, with due dates calculated relative to preceding stages.
- **Dynamic Gantt Chart**: Visualizes project timelines with target vs. expected dates.
- **Hydro Bill Information Extraction**: UC cards support manual entry or AI-powered data extraction from uploaded hydro bill images using OpenAI Vision.
- **Installation Calendar**: Monthly view of installations with cascading target date logic.
- **Project Profile Page**: Comprehensive view per project, including stage values, Gantt chart, documents, and a unified Customer Timeline.
- **Property Sector Filtering**: Excludes non-residential projects based on an Asana custom field.
- **HRSP Document Checklist & Configuration**: Two-phase document tracking for HRSP based on grant status, configurable via settings, with invoice template editing.
- **UC, Rebate & Contract KPI Systems**: Track workflow completions and key performance indicators with dashboards and drill-down views. All KPI sections use `CollapsibleKpiSection` wrapper and `FormulaTooltip` for explanations.
- **Contract Ready for Review Workflow**: Manages contracts marked "Ready for Review" with a configurable hide period and follow-up dialog.
- **Escalated Tickets System**: Allows staff to flag "stuck" projects, creating escalation tickets with configurable hide periods and resolution reporting. Includes SLA timer and snooze/extend hide features.
- **Escalation KPI Dashboard**: Displays 5 KPI cards: Open Tickets, Past 48h SLA, Avg Response Time, Avg Resolution Time, and SLA Compliance rate.
- **Document Template System**: Supports two template types:
    1. **Overlay templates**: Visual placement of fillable fields on PDFs/images for auto-generation.
    2. **Editable contract templates**: Rich text editor with .docx import, full formatting, merge fields, and electronic signature support.
- **Local File Storage System**: All file uploads are stored locally on the server filesystem, organized by project and category.
- **Project Documents Section**: Provides categorized folders, file management, and SharePoint links within the project profile.
- **PM Status Change Dialog**: Requires a note and staff selection for PM Status changes, posting to Asana.
- **Main Timeline View**: Displays Asana parent task comments and attachments, with direct comment and file upload capabilities.
- **Internal App Logic Documentation**: Visual documentation at `/app-logic` with interactive React Flow diagrams for database schema, API map, and workflow logic flows.
- **Live Auto-Refresh**: Data queries poll every 30 seconds (static config data every 5 minutes, Asana API every 60 seconds).
- **Sidebar Badge Counters**: Displays item counts needing action for each work view tab.
- **Paused Projects View**: Dedicated `/paused` page listing projects with "Project Paused" status, including search.
- **PM Status Breakdown Chart**: Dashboard pie chart visualizing projects by PM Status with drill-down and filtering.
- **Pause Reason Logging**: Logs pause events with reasons, notes, and staff. Includes a dedicated `/insights` tab for KPIs and analysis of pause logs.
- **Project Planner View**: A `/planner` page for pre-install preparation, including a checklist (Scope, Proposals, Site Plan, Costs, Contractor Assignment, Permits) which gates projects from UC view filters until completion. Features bidirectional sync for proposal/site plan and a focus mode for subtask management.
- **Asana Independence Strategy**: Designed for eventual disconnection from Asana, with all new features prioritizing local data storage and non-blocking Asana sync.

### Database Tables
- `users`, `projects`, `project_deadlines`, `task_actions`, `install_schedule`, `workflow_config`, `error_logs`, `hrsp_config`, `project_files`, `escalation_tickets`, `uc_completions`, `uc_workflow_rules`, `rebate_completions`, `rebate_workflow_rules`, `staff_members`, `pause_reasons`, `pause_logs`, `task_claims`, `contract_completions`, `contract_workflow_rules`, `document_templates`, `template_fields`.

## External Dependencies
- **Asana API**: Project synchronization, task management, custom field data, and project stories.
- **Replit Connector**: Secure authentication and connection to Asana.
- **OpenAI Vision (gpt-4o)**: AI-powered data extraction from hydro bill images.
- **PostgreSQL**: Relational database.
- **Local Filesystem**: Used in conjunction with PostgreSQL for file storage (DB as source of truth, disk as cache).