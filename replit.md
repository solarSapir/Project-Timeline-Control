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
- **Project Lifecycle Management**: The application tracks solar projects through stages: UC Applications, Contracts, Site Visits, AHJ/Permitting, Installation, Payments, and Close-off.
- **Asana Two-Way Sync**: Integrates bidirectionally with Asana, using it as the single source of truth for project data and custom fields. Status changes in the app push back to Asana.
- **Workflow Configuration**: A dedicated settings interface allows users to define stage dependencies, customizable gap days between stages, and completion criteria, with a visual editor for the dependency chain.
- **Dependency Gating**: Projects only appear in subsequent workflow views once all preceding dependencies are met. "Waiting on Dependencies" filters highlight blocked projects.
- **Chained Due Dates**: Due dates for stages are calculated relative to previous stages' completion or due dates, rather than all from project start, with cascading logic for late stages.
- **Dynamic Gantt Chart**: Visualizes project timelines with target vs. expected dates, dynamic date labels, and "zoom to today" functionality.
- **Hydro Bill Information Extraction**: UC cards feature a "Hydro Bill Info" section allowing manual entry or AI-powered extraction of data (company, account number, customer name) from uploaded hydro bill images using OpenAI Vision.
- **Installation Calendar**: Provides a monthly calendar view of installations, with cascading target date logic that adjusts downstream dates if a stage is overdue.
- **Project Profile Page**: A comprehensive view for each project, displaying all stage values, Gantt chart, recent activity, and customer notes.
- **Component-Based UI**: Employs a modular frontend structure with reusable components (e.g., `UCProjectCard`, `ContractCard`, `GanttChart`) and shared hooks/utilities to ensure maintainability and enforce code philosophy.
- **Property Sector Filtering**: All project views are filtered to exclude non-residential projects based on the Asana "Property Sector" custom field.

- **IT / Error Log System**: Automatic frontend error capture with user activity breadcrumbs. Tracks API errors, unhandled exceptions, and unhandled promise rejections. Breadcrumbs record last 20 user actions (navigation, API calls) for debugging context. Viewable at `/error-log` with resolve/clear workflow.
- **HRSP Document Checklist**: Two-phase document tracking based on GRANTS STATUS. **Pre-Approval** (active when status is New/In-progress/Submitted, grayed out when pre-approved): (1) HRSP Invoice, (2) Customer Authorization, (3) Hydro Bill, (4) SLD. **Close-Off** (shown when pre-approved): (1) Roof Installation Photos, (2) Panel Nameplate, (3) Inverter Nameplate, (4) Battery Nameplate, (5) ESA Certificate, (6) Paid Invoice (same quote marked PAID with install date). Routes in `server/routes/hrsp-invoice.ts`, UI in `client/src/components/hrsp/`.
- **HRSP Configuration**: Settings page includes an HRSP config section (`client/src/components/settings/HrspConfigEditor.tsx`) for toggling required documents on/off (split by pre-approval/close-off phase) and editing invoice template values (company info, equipment specs, pricing). Includes sample invoice download. Config stored in `hrsp_config` DB table; defaults in `shared/schema.ts` (`DEFAULT_HRSP_INVOICE_TEMPLATE`, `DEFAULT_HRSP_DOCUMENTS`). API: `GET/PUT /api/hrsp-config`.
- **Collapsible Settings Sections**: All settings page sections (Sync, Auto-Sync, Workflow, HRSP) use `CollapsibleSection` component for minimize/expand capability.
- **Rebate Focus Mode Modal**: The Rebates view has a "Focus" button on each card that opens a full modal dialog showing project details, document checklist, follow-up info, and HRSP subtask activity (stories/comments/attachments). Allows interacting with Asana without leaving the page.
- **Rebate Follow-Up System**: Projects with "In-progress" or "Submitted" GRANTS STATUS enter a 5-day follow-up cycle. `rebateSubmittedDate` tracks when the status changed. Cards show amber borders and "follow-up needed" label when due. Follow-up dialog posts notes to the HRSP subtask (not the main task). A "Needs Follow-Up" filter is available in the dropdown.
- **Subtask-Targeted Comments**: Follow-up comments for UC go to the UC subtask, rebate follow-ups go to the HRSP subtask, and HRSP document uploads go to the HRSP subtask. This keeps Asana organized by posting to the relevant subtask rather than the main task.
- **Auto-Complete on 100% Complete**: When rebate status is changed to "100% complete...", the HRSP subtask is automatically marked as completed in Asana.
- **Local File Storage System**: All file uploads (hydro bills, HRSP docs, contract documents, site visit photos, follow-up screenshots) are stored locally on the server filesystem at `data/uploads/{projectId}/{category}/` instead of being uploaded to Asana. Text comments are still posted to Asana. Asana attachments remain viewable (read-only). Each project has organized folders by team tab: UC, Rebates, Contract, Site Visit, AHJ, Install Coordination, Payment, Close Off.
- **Project Documents Section**: The project profile page includes a Documents section with folder tabs for all 8 categories, file upload/download/delete per folder, file count badges, and a SharePoint quick link extracted from Asana custom fields for legacy clients.

### Database Tables
- `users`
- `projects`
- `project_deadlines`
- `task_actions`
- `install_schedule`
- `workflow_config`
- `error_logs`
- `hrsp_config`
- `project_files` — tracks uploaded files with projectId, category, fileName, storedName, mimeType, fileSize, uploadedBy, notes

## External Dependencies
- **Asana API**: For project synchronization, task management, custom field data, and project stories. Text comments still posted to Asana; file uploads now stored locally.
- **Replit Connector**: Used for secure authentication and connection to Asana (connection:conn_asana_01KJ87H9ZADXMNKS3AVDTX4CKY).
- **OpenAI Vision (gpt-4o)**: Utilized for AI-powered data extraction from hydro bill image uploads.
- **PostgreSQL**: Relational database for storing application data.
- **Local Filesystem**: File storage at `data/uploads/` organized by project and category.