# Solar PM - Project Tracker

## Overview
Solar PM is a project management application designed for solar installation companies. It integrates with Asana to synchronize project data, offering specialized views for managing the entire lifecycle of solar installation projects. Key capabilities include tracking UC applications, contracts, permits, installations, payments, and close-off stages, with automated deadline management and dependency gating. The application aims to streamline operations, improve project visibility, and ensure timely completion of solar projects.

## User Preferences
- Solar installation company (Solar Power Store)
- Uses Asana "Project Manage Team" project for task management
- Two project types: Install and DIY (currently focusing on Install)
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
- **Project Profile Page**: Comprehensive view for each project, displaying all stage values, Gantt chart, activity, and notes.
- **Component-Based UI**: Modular frontend structure with reusable components and shared utilities.
- **Property Sector Filtering**: Project views exclude non-residential projects based on an Asana custom field.
- **HRSP Document Checklist & Configuration**: Two-phase document tracking for HRSP based on grant status, configurable via settings, including invoice template editing.
- **UC & Rebate KPI Systems**: Track application and rebate workflow completions, hide/reappear logic, and key performance indicators with dashboards and configurable workflow rules.
- **Escalated Tickets System**: Staff can flag "stuck" projects, creating escalation tickets with a 48-hour hide period for manager resolution.
- **Local File Storage System**: All file uploads are stored locally on the server filesystem, organized by project and category. Asana attachments remain viewable.
- **Project Documents Section**: Project profile includes a Documents section with categorized folders, file management, and SharePoint links.
- **Internal App Logic Documentation**: Visual documentation at `/app-logic` with interactive React Flow diagrams for database schema, API map, and workflow logic flows.

### Database Tables
- `users`, `projects`, `project_deadlines`, `task_actions`, `install_schedule`, `workflow_config`, `error_logs`, `hrsp_config`, `project_files`, `escalation_tickets`, `uc_completions`, `uc_workflow_rules`, `rebate_completions`, `staff_members`.

## External Dependencies
- **Asana API**: For project synchronization, task management, custom field data, and project stories.
- **Replit Connector**: Secure authentication and connection to Asana.
- **OpenAI Vision (gpt-4o)**: AI-powered data extraction from hydro bill images.
- **PostgreSQL**: Relational database.
- **Local Filesystem**: For storing uploaded project files.