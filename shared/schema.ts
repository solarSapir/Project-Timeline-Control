import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  asanaGid: text("asana_gid").unique(),
  name: text("name").notNull(),
  installType: text("install_type"),
  pmStatus: text("pm_status"),
  ucStatus: text("uc_status"),
  ahjStatus: text("ahj_status"),
  designStatus: text("design_status"),
  quotingStatus: text("quoting_status"),
  province: text("province"),
  asanaDueDate: text("asana_due_date"),
  paymentMethod: text("payment_method"),
  rebateStatus: text("rebate_status"),
  contractStatus: text("contract_status"),
  siteVisitStatus: text("site_visit_status"),
  projectCreatedDate: date("project_created_date"),
  ucDueDate: date("uc_due_date"),
  ahjDueDate: date("ahj_due_date"),
  contractDueDate: date("contract_due_date"),
  siteVisitDueDate: date("site_visit_due_date"),
  installDueDate: date("install_due_date"),
  closeOffDueDate: date("close_off_due_date"),
  siteVisitDate: date("site_visit_date"),
  installStartDate: date("install_start_date"),
  equipmentArrivalDate: date("equipment_arrival_date"),
  disconnectReconnectDate: date("disconnect_reconnect_date"),
  finalInspectionDate: date("final_inspection_date"),
  permitPaymentCollected: boolean("permit_payment_collected").default(false),
  engineeringFeeCollected: boolean("engineering_fee_collected").default(false),
  milestonePaymentCollected: boolean("milestone_payment_collected").default(false),
  finalPaymentCollected: boolean("final_payment_collected").default(false),
  customerNotes: text("customer_notes"),
  asanaCustomFields: jsonb("asana_custom_fields"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectDeadlines = pgTable("project_deadlines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  stage: text("stage").notNull(),
  targetDate: date("target_date"),
  actualDate: date("actual_date"),
  status: text("status").default("pending"),
});

export const taskActions = pgTable("task_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  viewType: text("view_type").notNull(),
  actionType: text("action_type").notNull(),
  completedBy: text("completed_by"),
  followUpDate: date("follow_up_date"),
  notes: text("notes"),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const installSchedule = pgTable("install_schedule", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  taskType: text("task_type").notNull(),
  scheduledDate: date("scheduled_date"),
  duration: integer("duration"),
  status: text("status").default("pending"),
  installerName: text("installer_name"),
  notes: text("notes"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  lastSyncedAt: true,
});

export const insertProjectDeadlineSchema = createInsertSchema(projectDeadlines).omit({
  id: true,
});

export const insertTaskActionSchema = createInsertSchema(taskActions).omit({
  id: true,
  completedAt: true,
});

export const insertInstallScheduleSchema = createInsertSchema(installSchedule).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectDeadline = typeof projectDeadlines.$inferSelect;
export type InsertProjectDeadline = z.infer<typeof insertProjectDeadlineSchema>;
export type TaskAction = typeof taskActions.$inferSelect;
export type InsertTaskAction = z.infer<typeof insertTaskActionSchema>;
export type InstallSchedule = typeof installSchedule.$inferSelect;
export type InsertInstallSchedule = z.infer<typeof insertInstallScheduleSchema>;

export const UC_STATUSES = [
  "New Application",
  "Missing Information",
  "Submitted",
  "Approved",
  "Complete",
  "Rejected",
  "Not Required",
  "Close-off",
] as const;

export const AHJ_STATUSES = [
  "New Project",
  "Ready for P.eng",
  "Submitted to P.eng",
  "P.eng Complete - Pending City Submission",
  "Submitted to City",
  "Approved",
  "Complete",
  "Rejected",
  "Close-off",
] as const;

export const PROJECT_STAGES = [
  "uc_application",
  "rebates_payment",
  "contract_signing",
  "site_visit",
  "ahj_permitting",
  "install_booking",
  "installation",
  "close_off",
] as const;

export const STAGE_LABELS: Record<string, string> = {
  uc_application: "UC Application",
  rebates_payment: "Rebates & Payment Method",
  contract_signing: "Contract & Permit Payment",
  site_visit: "Site Visit",
  ahj_permitting: "AHJ/Permitting",
  install_booking: "Install Booking",
  installation: "Installation",
  close_off: "Close-off",
};

export const DEFAULT_DEADLINES_WEEKS: Record<string, { min: number; max: number; dependsOn?: string[] }> = {
  uc_application: { min: 0, max: 4 },
  rebates_payment: { min: 0, max: 2 },
  contract_signing: { min: 4, max: 5, dependsOn: ["uc_application", "rebates_payment"] },
  site_visit: { min: 4, max: 6, dependsOn: ["uc_application", "rebates_payment", "contract_signing"] },
  ahj_permitting: { min: 5, max: 7, dependsOn: ["site_visit"] },
  install_booking: { min: 8, max: 8, dependsOn: ["ahj_permitting"] },
  installation: { min: 9, max: 12, dependsOn: ["install_booking"] },
  close_off: { min: 12, max: 14, dependsOn: ["installation"] },
};
