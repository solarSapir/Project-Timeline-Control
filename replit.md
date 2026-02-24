# Solar PM - Project Tracker

## Overview
A solar installation project management application that connects to Asana to sync projects and provides team-specific work views for managing the full lifecycle of solar installation projects. The app tracks UC applications, contracts, permits, installations, payments, and close-off stages with automated deadline tracking.

## Recent Changes
- 2026-02-24: Initial build with Asana integration, all work views, and deadline tracking

## Architecture

### Stack
- **Frontend**: React + TypeScript, Tailwind CSS, Shadcn UI, Wouter routing, TanStack Query
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Integration**: Asana API via Replit connector (connection:conn_asana_01KJ87H9ZADXMNKS3AVDTX4CKY)

### Database Tables
- `users` - App users
- `projects` - Synced from Asana with custom field mappings (UC status, AHJ status, payment tracking, etc.)
- `project_deadlines` - Calculated deadline targets for each project stage
- `task_actions` - Team member task completions and follow-ups
- `install_schedule` - Installation scheduling (equipment, start dates, inspections)

### Pages / Views
- `/` - Dashboard with stats, charts, and project overview
- `/uc` - UC Application view for managing utility connection stages
- `/contracts` - Contracts & Payment view (rebates, payment method, contract signing, permit fees)
- `/site-visits` - Site Visit booking and tracking
- `/ahj` - AHJ/Permitting view for building permit workflow
- `/installs` - Installation Coordination (scheduling, installer management)
- `/payments` - Payment Collection (milestone + final balance)
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
