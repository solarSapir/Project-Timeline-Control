# Solar PM - Project Tracker

## Overview
Solar PM is a project management application designed for solar installation companies. It synchronizes with Asana to streamline the entire project lifecycle, from UC applications and contracts to installations, payments, and close-off. The application automates deadline management, enforces dependency gating, and aims to significantly improve project visibility and operational efficiency, ensuring projects are completed on time.

## User Preferences
- Solar installation company (Solar Power Store)
- Uses Asana "Project Manage Team" project for task management
- Two project types: Install and DIY (work views focus on Install; All Customers page shows everything)
- Teams: UC team, AHJ/permitting team, install coordinators, payment collection

## System Architecture

### Stack
- **Frontend**: React + TypeScript, Tailwind CSS, Shadcn UI, Wouter routing, TanStack Query
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **AI**: OpenAI Vision (gpt-4o) for hydro bill extraction and AI insights

### Core Features and Design
- **Project Lifecycle Management**: Tracks projects through defined stages: UC Applications, Contracts, Site Visits, AHJ/Permitting, Installation, Payments, and Close-off.
- **Asana Two-Way Sync**: Bidirectional integration with Asana, maintaining it as the single source of truth for project data, with real-time webhook updates and manual sync options.
- **Workflow Configuration**: Customizable stage dependencies, gap days, and completion criteria managed through a visual editor.
- **Dependency Gating & Chained Due Dates**: Ensures project progression only upon meeting dependencies, with automated due date calculations.
- **Dynamic Gantt Chart**: Visual representation of project timelines, comparing target vs. expected dates.
- **AI-Powered Data Extraction**: Utilizes OpenAI Vision for extracting hydro bill information from images, alongside manual entry.
- **Installation Calendar**: Provides a monthly overview of installations with cascading target dates.
- **Comprehensive Project Profile**: A dedicated page for each project, displaying stage values, Gantt chart, documents, and a unified customer timeline.
- **HRSP Document Management**: Two-phase document tracking for HRSP based on grant status, configurable settings, and invoice template editing.
- **KPI Systems**: Tracks key performance indicators for UC, Rebate, and Contract workflows through dedicated dashboards and drill-down views.
- **Contract Generation Flow**: Streamlined process for generating contracts using templates, pre-populated merge fields, and electronic signature support. Contracts are generated as print-optimized HTML.
- **Escalated Tickets System**: Mechanism for flagging "stuck" projects, creating tickets with SLA timers, snooze functionality, and resolution reporting.
- **Document Template System**: Supports two types: overlay templates (visual field placement on PDFs/images) and editable contract templates (rich text editor with .docx import, merge fields, and e-signature).
    - **Template Management**: Includes soft-deletion (archiving), restoration, and automatic purging of expired archives. Templates are seeded from `data/template-seeds.json` for environment synchronization.
- **Local File Storage**: All uploaded files are stored locally on the server filesystem, categorized by project.
- **Project Planner View**: A dedicated view (`/planner`) for pre-install preparation, featuring a checklist that gates projects from UC view filters until completion, with bidirectional sync and a focus mode.
- **Asana Independence Strategy**: Designed to reduce reliance on Asana, prioritizing local data storage and non-blocking Asana synchronization for new features.
- **Filter Criteria Banner**: Displays active filter logic across all work views for transparency and debugging.
- **Paused Projects View**: Manages paused projects with follow-up snoozing, hiding future-dated projects from the main list until their follow-up date.
- **Pause Reason Logging & KPIs**: Logs pause events with reasons and actions, offering a KPI dashboard with various metrics and AI insights.

### Database Tables (22 total)
- **Core**: `users`, `projects`, `project_deadlines`
- **Workflow**: `task_actions`, `install_schedule`, `workflow_config`, `pause_reasons`, `pause_logs`
- **Documents**: `project_files`, `hrsp_config`, `document_templates`, `template_fields`
- **Escalation**: `escalation_tickets`
- **KPI**: `uc_completions`, `uc_workflow_rules`, `rebate_completions`, `rebate_workflow_rules`, `contract_completions`, `contract_workflow_rules`, `task_claims`
- **System**: `error_logs`, `staff_members`

## External Dependencies
- **Asana API**: For project synchronization, task management, custom field data, and project stories.
- **Replit Connector**: Handles secure authentication and connection to Asana.
- **OpenAI Vision (gpt-4o)**: Powers AI-driven data extraction from hydro bill images and provides insights for pause logs.
- **PostgreSQL**: The relational database used for all application data, hosted on Supabase.
- **Local Filesystem**: Used for storing uploaded files, with metadata managed in PostgreSQL.