import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, boolean, jsonb, customType, real } from "drizzle-orm/pg-core";
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
  ucTeam: text("uc_team"),
  ucSubmittedDate: text("uc_submitted_date"),
  ucSubmittedBy: text("uc_submitted_by"),
  hrspStatus: text("hrsp_status"),
  hrspDueDate: date("hrsp_due_date"),
  hrspSubtaskGid: text("hrsp_subtask_gid"),
  hrspSubtaskCreatedDate: text("hrsp_subtask_created_date"),
  rebateSubmittedDate: text("rebate_submitted_date"),
  hrspMissing: boolean("hrsp_missing").default(false),
  installTeamStage: text("install_team_stage"),
  propertySector: text("property_sector"),
  customerNotes: text("customer_notes"),
  hydroBillUrl: text("hydro_bill_url"),
  hydroCompanyName: text("hydro_company_name"),
  hydroAccountNumber: text("hydro_account_number"),
  hydroCustomerName: text("hydro_customer_name"),
  hrspInvoiceUrl: text("hrsp_invoice_url"),
  hrspInvoiceGeneratedAt: timestamp("hrsp_invoice_generated_at"),
  hrspServiceAddress: text("hrsp_service_address"),
  hrspQuoteNumber: text("hrsp_quote_number"),
  hrspQuoteDate: text("hrsp_quote_date"),
  hrspAuthDocUrl: text("hrsp_auth_doc_url"),
  hrspAuthDocUploadedAt: timestamp("hrsp_auth_doc_uploaded_at"),
  hrspPowerConsumptionUrl: text("hrsp_power_consumption_url"),
  hrspSldUrl: text("hrsp_sld_url"),
  hrspRoofPicsUrl: text("hrsp_roof_pics_url"),
  hrspPanelNameplateUrl: text("hrsp_panel_nameplate_url"),
  hrspInverterNameplateUrl: text("hrsp_inverter_nameplate_url"),
  hrspBatteryNameplateUrl: text("hrsp_battery_nameplate_url"),
  hrspEsaCertUrl: text("hrsp_esa_cert_url"),
  hrspPaidInvoiceUrl: text("hrsp_paid_invoice_url"),
  hrspLdcAgreementUrl: text("hrsp_ldc_agreement_url"),
  hrspInstallDate: text("hrsp_install_date"),
  asanaCustomFields: jsonb("asana_custom_fields"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  lastUnpausedDate: text("last_unpaused_date"),
  ucConnectionFee: text("uc_connection_fee"),
  ucMeterbaseUrl: text("uc_meterbase_url"),
  electricalPermitUrl: text("electrical_permit_url"),
  electricalPermitUploadedAt: timestamp("electrical_permit_uploaded_at"),
  plannerScopeConfirmed: boolean("planner_scope_confirmed").default(false),
  plannerProposalUrl: text("planner_proposal_url"),
  plannerProposalUploadedAt: timestamp("planner_proposal_uploaded_at"),
  plannerTotalCost: text("planner_total_cost"),
  plannerContractorPayout: text("planner_contractor_payout"),
  plannerSitePlanUrl: text("planner_site_plan_url"),
  plannerSitePlanUploadedAt: timestamp("planner_site_plan_uploaded_at"),
  plannerContractSent: boolean("planner_contract_sent").default(false),
  plannerContractSigned: boolean("planner_contract_signed").default(false),
  rebateCloseOffDate: text("rebate_close_off_date"),
  pauseReason: text("pause_reason"),
  pauseNote: text("pause_note"),
  pauseReasonSetAt: timestamp("pause_reason_set_at"),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  projectAddress: text("project_address"),
  projectCity: text("project_city"),
  projectPostalCode: text("project_postal_code"),
  projectDescription: text("project_description"),
  contractSubtotal: text("contract_subtotal"),
  contractHstAmount: text("contract_hst_amount"),
  contractTotal: text("contract_total"),
  contractHelcimLink: text("contract_helcim_link"),
  contractRepName: text("contract_rep_name"),
  contractMilestones: text("contract_milestones"),
  contractScopeItems: text("contract_scope_items"),
  contractCustomScope: text("contract_custom_scope"),
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

export const workflowConfig = pgTable("workflow_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stage: text("stage").notNull().unique(),
  targetDays: integer("target_days").notNull(),
  dependsOn: text("depends_on").array(),
  gapRelativeTo: text("gap_relative_to"),
  completionCriteria: text("completion_criteria").array(),
});

export const insertWorkflowConfigSchema = createInsertSchema(workflowConfig).omit({
  id: true,
});

export type WorkflowConfig = typeof workflowConfig.$inferSelect;
export type InsertWorkflowConfig = z.infer<typeof insertWorkflowConfigSchema>;

export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  errorMessage: text("error_message").notNull(),
  errorSource: text("error_source"),
  pageUrl: text("page_url"),
  userActions: jsonb("user_actions"),
  apiEndpoint: text("api_endpoint"),
  apiMethod: text("api_method"),
  apiPayload: text("api_payload"),
  stackTrace: text("stack_trace"),
  resolved: boolean("resolved").default(false),
  resolvedNote: text("resolved_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({
  id: true,
  createdAt: true,
});

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;

export const hrspConfig = pgTable("hrsp_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceTemplate: jsonb("invoice_template"),
  requiredDocuments: jsonb("required_documents"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHrspConfigSchema = createInsertSchema(hrspConfig).omit({
  id: true,
  updatedAt: true,
});

export type HrspConfig = typeof hrspConfig.$inferSelect;
export type InsertHrspConfig = z.infer<typeof insertHrspConfigSchema>;

export interface HrspInvoiceTemplate {
  companyName: string;
  address1: string;
  address2: string;
  city: string;
  phone: string;
  email: string;
  gstHst: string;
  panelMake: string;
  panelModel: string;
  panelWatt: number;
  panelQty: number;
  totalKwDc: number;
  panelCost: number;
  batteryMake: string;
  batteryModel: string;
  batterySize: string;
  batteryCost: number;
  otherCost: number;
  subtotal: number;
  hstRate: number;
  hst: number;
  total: number;
  pvOnlyPreTax: number;
}

export interface HrspRequiredDocument {
  key: string;
  label: string;
  type: "generate" | "upload" | "auto";
  phase: "pre" | "closeoff";
  enabled: boolean;
  description?: string;
}

export const DEFAULT_HRSP_INVOICE_TEMPLATE: HrspInvoiceTemplate = {
  companyName: "Solar Power Store Canada LTD",
  address1: "526 Bryne Dr",
  address2: "Unit C",
  city: "Barrie, ON L4N 9P6",
  phone: "1-888-421-5354",
  email: "accounting@solarpowerstore.ca",
  gstHst: "772144143RT0001",
  panelMake: "MAPLE LEAF",
  panelModel: "TS-BGT72(580)",
  panelWatt: 580,
  panelQty: 31,
  totalKwDc: 17980,
  panelCost: 24354.89,
  batteryMake: "FOX ESS",
  batteryModel: "ECS4000-H4",
  batterySize: "12Kwh",
  batteryCost: 10638.97,
  otherCost: 1000,
  subtotal: 35993.86,
  hstRate: 0.13,
  hst: 4679.20,
  total: 40673.06,
  pvOnlyPreTax: 29610.48,
};

export const DEFAULT_HRSP_DOCUMENTS: HrspRequiredDocument[] = [
  { key: "invoice", label: "HRSP Invoice", type: "generate", phase: "pre", enabled: true, description: "Auto-generated PDF invoice with equipment specs" },
  { key: "authorization", label: "Participation Document", type: "upload", phase: "pre", enabled: true, description: "Signed participation document" },
  { key: "hydroBill", label: "Hydro Bill / Power Consumption", type: "auto", phase: "pre", enabled: true, description: "Auto-linked from UC hydro bill, or manual upload" },
  { key: "sld", label: "Single Line Diagram (SLD)", type: "upload", phase: "pre", enabled: true, description: "Electrical single line diagram for the installation" },
  { key: "roofPics", label: "Roof Installation Photos", type: "upload", phase: "closeoff", enabled: true, description: "Photos of solar panels installed on the roof" },
  { key: "panelNameplate", label: "Panel Nameplate Photo", type: "upload", phase: "closeoff", enabled: true, description: "Photo of the solar panel nameplate" },
  { key: "inverterNameplate", label: "Inverter Nameplate Photo", type: "upload", phase: "closeoff", enabled: true, description: "Photo of the inverter nameplate" },
  { key: "batteryNameplate", label: "Battery Nameplate Photo", type: "upload", phase: "closeoff", enabled: true, description: "Photo of the battery nameplate" },
  { key: "esaCert", label: "ESA Certificate of Acceptance", type: "upload", phase: "closeoff", enabled: true, description: "Contractor's ESA certificate of acceptance" },
  { key: "paidInvoice", label: "Paid Invoice", type: "generate", phase: "closeoff", enabled: true, description: "Same quote marked as PAID with installation date" },
  { key: "ldcAgreement", label: "LDC Agreement", type: "upload", phase: "closeoff", enabled: true, description: "Load Displacement Commitment agreement document" },
];

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const projectFiles = pgTable("project_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  uploadedBy: text("uploaded_by"),
  notes: text("notes"),
  fileData: bytea("file_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectFileSchema = createInsertSchema(projectFiles).omit({
  id: true,
  createdAt: true,
});

export type ProjectFile = typeof projectFiles.$inferSelect;
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;

export const FILE_CATEGORIES = [
  "uc", "rebates", "contract", "site_visit", "ahj", "install", "payment", "close_off",
] as const;

export const FILE_CATEGORY_LABELS: Record<string, string> = {
  uc: "UC",
  rebates: "Rebates",
  contract: "Contract",
  site_visit: "Site Visit",
  ahj: "AHJ",
  install: "Install Coordination",
  payment: "Payment",
  close_off: "Close Off",
};

export const escalationTickets = pgTable("escalation_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  viewType: text("view_type").notNull(),
  createdBy: text("created_by").notNull(),
  issue: text("issue").notNull(),
  status: text("status").notNull().default("open"),
  managerResponse: text("manager_response"),
  respondedBy: text("responded_by"),
  respondedAt: timestamp("responded_at"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  resolvedBy: text("resolved_by"),
  hideUntil: timestamp("hide_until"),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEscalationTicketSchema = createInsertSchema(escalationTickets).omit({
  id: true,
  createdAt: true,
});

export type EscalationTicket = typeof escalationTickets.$inferSelect;
export type InsertEscalationTicket = z.infer<typeof insertEscalationTicketSchema>;

export const ESCALATION_VIEW_TYPES = [
  "uc", "contracts", "payments", "ahj", "installs", "site_visits", "close_off",
] as const;

export const ESCALATION_VIEW_LABELS: Record<string, string> = {
  uc: "UC Applications",
  contracts: "Contracts",
  payments: "Rebates",
  ahj: "AHJ / Permitting",
  installs: "Install Coordination",
  site_visits: "Site Visits",
  close_off: "Close-off",
};

export const ucCompletions = pgTable("uc_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  staffName: text("staff_name").notNull(),
  actionType: text("action_type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  notes: text("notes"),
  hideDays: integer("hide_days"),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const insertUcCompletionSchema = createInsertSchema(ucCompletions).omit({
  id: true,
  completedAt: true,
});

export type UcCompletion = typeof ucCompletions.$inferSelect;
export type InsertUcCompletion = z.infer<typeof insertUcCompletionSchema>;

export const rebateCompletions = pgTable("rebate_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  staffName: text("staff_name").notNull(),
  actionType: text("action_type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  notes: text("notes"),
  hideDays: integer("hide_days"),
  followUpDate: text("follow_up_date"),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const insertRebateCompletionSchema = createInsertSchema(rebateCompletions).omit({
  id: true,
  completedAt: true,
});

export type RebateCompletion = typeof rebateCompletions.$inferSelect;
export type InsertRebateCompletion = z.infer<typeof insertRebateCompletionSchema>;

export const ucWorkflowRules = pgTable("uc_workflow_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  triggerAction: text("trigger_action").notNull().unique(),
  hideDays: integer("hide_days").notNull().default(7),
  requiresFiles: boolean("requires_files").default(false),
  requiresNotes: boolean("requires_notes").default(true),
  autoEscalate: boolean("auto_escalate").default(false),
  label: text("label").notNull(),
  description: text("description"),
  enabled: boolean("enabled").default(true),
});

export const insertUcWorkflowRuleSchema = createInsertSchema(ucWorkflowRules).omit({
  id: true,
});

export type UcWorkflowRule = typeof ucWorkflowRules.$inferSelect;
export type InsertUcWorkflowRule = z.infer<typeof insertUcWorkflowRuleSchema>;

export const DEFAULT_UC_WORKFLOW_RULES: InsertUcWorkflowRule[] = [
  {
    triggerAction: "status_to_submitted",
    hideDays: 7,
    requiresFiles: false,
    requiresNotes: false,
    autoEscalate: false,
    label: "New → Submitted",
    description: "When a UC application is submitted, hide for 7 days then check in on the status.",
    enabled: true,
  },
  {
    triggerAction: "follow_up_submitted",
    hideDays: 7,
    requiresFiles: false,
    requiresNotes: true,
    autoEscalate: false,
    label: "Follow-up (Submitted)",
    description: "When following up on a submitted application, push it back for 7 days to check again.",
    enabled: true,
  },
  {
    triggerAction: "status_to_approved",
    hideDays: 14,
    requiresFiles: true,
    requiresNotes: false,
    autoEscalate: false,
    label: "Submitted → Approved",
    description: "When approved, upload approval files and hydro connection fee. Hides for 14 days to check in.",
    enabled: true,
  },
  {
    triggerAction: "status_to_rejected",
    hideDays: 0,
    requiresFiles: true,
    requiresNotes: true,
    autoEscalate: true,
    label: "Submitted → Rejected",
    description: "When rejected, upload rejection files and screenshot. Auto-creates escalation ticket for manager review.",
    enabled: true,
  },
  {
    triggerAction: "follow_up_approved",
    hideDays: 14,
    requiresFiles: false,
    requiresNotes: true,
    autoEscalate: false,
    label: "Follow-up (Approved)",
    description: "When following up on an approved application, push it back for 14 days.",
    enabled: true,
  },
];

export const rebateWorkflowRules = pgTable("rebate_workflow_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  triggerAction: text("trigger_action").notNull().unique(),
  hideDays: integer("hide_days").notNull().default(5),
  requiresFiles: boolean("requires_files").default(false),
  requiresNotes: boolean("requires_notes").default(true),
  autoEscalate: boolean("auto_escalate").default(false),
  label: text("label").notNull(),
  description: text("description"),
  enabled: boolean("enabled").default(true),
});

export const insertRebateWorkflowRuleSchema = createInsertSchema(rebateWorkflowRules).omit({
  id: true,
});

export type RebateWorkflowRule = typeof rebateWorkflowRules.$inferSelect;
export type InsertRebateWorkflowRule = z.infer<typeof insertRebateWorkflowRuleSchema>;

export const DEFAULT_REBATE_WORKFLOW_RULES: InsertRebateWorkflowRule[] = [
  {
    triggerAction: "status_to_in_progress",
    hideDays: 5,
    requiresFiles: false,
    requiresNotes: false,
    autoEscalate: false,
    label: "New → In-Progress",
    description: "When rebate status changes to in-progress. Follow-up indicator shows after this many days.",
    enabled: true,
  },
  {
    triggerAction: "status_to_submitted",
    hideDays: 5,
    requiresFiles: false,
    requiresNotes: false,
    autoEscalate: false,
    label: "New → Submitted",
    description: "When rebate application is submitted to utility. Follow-up indicator shows after this many days.",
    enabled: true,
  },
  {
    triggerAction: "follow_up_submitted",
    hideDays: 5,
    requiresFiles: false,
    requiresNotes: true,
    autoEscalate: false,
    label: "Follow-up (Submitted / In-Progress)",
    description: "When following up on a submitted or in-progress rebate. Resets the follow-up timer by this many days.",
    enabled: true,
  },
  {
    triggerAction: "status_to_closeoff_submitted",
    hideDays: 5,
    requiresFiles: true,
    requiresNotes: false,
    autoEscalate: false,
    label: "Close-off → Submitted",
    description: "When close-off documents are submitted. Follow-up shows after this many days.",
    enabled: true,
  },
  {
    triggerAction: "follow_up_closeoff",
    hideDays: 5,
    requiresFiles: false,
    requiresNotes: true,
    autoEscalate: false,
    label: "Follow-up (Close-off Submitted)",
    description: "When following up on submitted close-off documents. Resets the follow-up timer.",
    enabled: true,
  },
  {
    triggerAction: "closeoff_due_window",
    hideDays: 14,
    requiresFiles: false,
    requiresNotes: false,
    autoEscalate: false,
    label: "Close-off Due Window",
    description: "Number of days after close-off date to set the due date for document submission.",
    enabled: true,
  },
];

export const HRSP_PRE_APPROVAL_STATUSES = [
  "New/ Check if needed",
  "In-progress",
  "Submitted",
];

export const HRSP_POST_APPROVAL_STATUSES = [
  "Complete - (Pre approved, waiting for job to complete)",
  "Close-off",
  "100% complete",
];

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

export const staffMembers = pgTable("staff_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStaffMemberSchema = createInsertSchema(staffMembers).omit({ id: true, createdAt: true });
export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;
export type StaffMember = typeof staffMembers.$inferSelect;

export const pauseReasons = pgTable("pause_reasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reason: text("reason").notNull().unique(),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPauseReasonSchema = createInsertSchema(pauseReasons).omit({
  id: true,
  usageCount: true,
  createdAt: true,
});

export type PauseReason = typeof pauseReasons.$inferSelect;
export type InsertPauseReason = z.infer<typeof insertPauseReasonSchema>;

export const pauseLogs = pgTable("pause_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  reason: text("reason"),
  note: text("note"),
  staffName: text("staff_name"),
  followUpDate: date("follow_up_date"),
  pausedAt: timestamp("paused_at").defaultNow(),
});

export const insertPauseLogSchema = createInsertSchema(pauseLogs).omit({
  id: true,
  pausedAt: true,
});

export type PauseLog = typeof pauseLogs.$inferSelect;
export type InsertPauseLog = z.infer<typeof insertPauseLogSchema>;

export const taskClaims = pgTable("task_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  viewType: text("view_type").notNull(),
  staffName: text("staff_name").notNull(),
  claimedAt: timestamp("claimed_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  completionAction: text("completion_action"),
  active: boolean("active").default(true),
});

export const insertTaskClaimSchema = createInsertSchema(taskClaims).omit({
  id: true,
  claimedAt: true,
  completedAt: true,
  completionAction: true,
  active: true,
});

export type TaskClaim = typeof taskClaims.$inferSelect;
export type InsertTaskClaim = z.infer<typeof insertTaskClaimSchema>;

export const DEFAULT_PAUSE_REASONS = [
  "Waiting for GHL loan approval",
  "Customer unresponsive",
  "Waiting for financing",
  "Customer requested delay",
  "Weather / seasonal delay",
  "Pending permits",
  "Equipment backorder",
  "Site access issues",
  "Customer reconsidering",
  "Internal review needed",
];

export const PROJECT_STAGES = [
  "uc_application",
  "rebates",
  "payment",
  "contract_signing",
  "site_visit",
  "ahj_permitting",
  "install_booking",
  "installation",
  "close_off",
] as const;

export const STAGE_LABELS: Record<string, string> = {
  uc_application: "UC Application",
  rebates: "Rebates",
  payment: "Payment Method",
  contract_signing: "Contract & Permit Payment",
  site_visit: "Site Visit",
  ahj_permitting: "AHJ/Permitting",
  install_booking: "Install Booking",
  installation: "Installation",
  close_off: "Close-off",
};

export const DEFAULT_DEADLINES_WEEKS: Record<string, { min: number; max: number; dependsOn?: string[] }> = {
  uc_application: { min: 0, max: 4 },
  rebates: { min: 0, max: 2 },
  payment: { min: 0, max: 2 },
  contract_signing: { min: 4, max: 5, dependsOn: ["uc_application", "rebates", "payment"] },
  site_visit: { min: 4, max: 6, dependsOn: ["uc_application", "rebates", "payment", "contract_signing"] },
  ahj_permitting: { min: 5, max: 7, dependsOn: ["site_visit"] },
  install_booking: { min: 8, max: 8, dependsOn: ["ahj_permitting"] },
  installation: { min: 9, max: 12, dependsOn: ["install_booking"] },
  close_off: { min: 12, max: 14, dependsOn: ["installation"] },
};

export const contractCompletions = pgTable("contract_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  staffName: text("staff_name").notNull(),
  actionType: text("action_type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  notes: text("notes"),
  hideDays: integer("hide_days").default(0),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const insertContractCompletionSchema = createInsertSchema(contractCompletions).omit({
  id: true,
  completedAt: true,
});

export type ContractCompletion = typeof contractCompletions.$inferSelect;
export type InsertContractCompletion = z.infer<typeof insertContractCompletionSchema>;

export const contractWorkflowRules = pgTable("contract_workflow_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  triggerAction: text("trigger_action").notNull().unique(),
  hideDays: integer("hide_days").notNull().default(1),
  requiresFiles: boolean("requires_files").default(false),
  requiresNotes: boolean("requires_notes").default(false),
  autoEscalate: boolean("auto_escalate").default(false),
  label: text("label").notNull(),
  description: text("description"),
  enabled: boolean("enabled").default(true),
});

export const insertContractWorkflowRuleSchema = createInsertSchema(contractWorkflowRules).omit({
  id: true,
});

export type ContractWorkflowRule = typeof contractWorkflowRules.$inferSelect;
export type InsertContractWorkflowRule = z.infer<typeof insertContractWorkflowRuleSchema>;

export const DEFAULT_CONTRACT_WORKFLOW_RULES: InsertContractWorkflowRule[] = [
  {
    triggerAction: "ready_for_review",
    hideDays: 1,
    requiresFiles: false,
    requiresNotes: false,
    autoEscalate: false,
    label: "Ready for Review",
    description: "When contract documents are uploaded and marked ready for manager review. Hidden for 1 day (24h) while under review.",
    enabled: true,
  },
  {
    triggerAction: "follow_up_review",
    hideDays: 1,
    requiresFiles: false,
    requiresNotes: true,
    autoEscalate: false,
    label: "Follow-up (Review)",
    description: "When following up on a contract under review. Resets the hide timer by 1 day.",
    enabled: true,
  },
  {
    triggerAction: "document_upload",
    hideDays: 0,
    requiresFiles: true,
    requiresNotes: false,
    autoEscalate: false,
    label: "Document Upload",
    description: "When contract documents (contract, proposal, site plan) are uploaded.",
    enabled: true,
  },
  {
    triggerAction: "contract_approved",
    hideDays: 0,
    requiresFiles: false,
    requiresNotes: false,
    autoEscalate: false,
    label: "Contract Approved",
    description: "When a manager approves the uploaded contract documents.",
    enabled: true,
  },
];

export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  viewType: text("view_type").notNull(),
  templateType: text("template_type").default("overlay"),
  fileName: text("file_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileData: bytea("file_data"),
  htmlContent: text("html_content"),
  pageCount: integer("page_count").default(1),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({
  id: true,
  createdAt: true,
});
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

export const templateFields = pgTable("template_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  tag: text("tag").notNull(),
  label: text("label").notNull(),
  fieldType: text("field_type").default("text"),
  page: integer("page").default(1),
  x: real("x").notNull(),
  y: real("y").notNull(),
  width: real("width").notNull(),
  height: real("height").notNull(),
  fontSize: integer("font_size").default(12),
  fontColor: text("font_color").default("#000000"),
  options: text("options"),
  required: boolean("required").default(false),
  defaultValue: text("default_value"),
  sortOrder: integer("sort_order").default(0),
});

export const insertTemplateFieldSchema = createInsertSchema(templateFields).omit({
  id: true,
});
export type InsertTemplateField = z.infer<typeof insertTemplateFieldSchema>;
export type TemplateField = typeof templateFields.$inferSelect;

export const DEFAULT_STAGE_GAPS: Record<string, { gapDays: number; dependsOn: string[]; gapRelativeTo: string | null }> = {
  uc_application: { gapDays: 21, dependsOn: [], gapRelativeTo: null },
  rebates: { gapDays: 14, dependsOn: [], gapRelativeTo: null },
  payment: { gapDays: 14, dependsOn: [], gapRelativeTo: null },
  contract_signing: { gapDays: 7, dependsOn: ["uc_application"], gapRelativeTo: "uc_application" },
  site_visit: { gapDays: 7, dependsOn: ["contract_signing"], gapRelativeTo: "contract_signing" },
  ahj_permitting: { gapDays: 14, dependsOn: ["site_visit"], gapRelativeTo: "site_visit" },
  install_booking: { gapDays: 7, dependsOn: ["ahj_permitting"], gapRelativeTo: "ahj_permitting" },
  installation: { gapDays: 7, dependsOn: ["install_booking"], gapRelativeTo: "install_booking" },
  close_off: { gapDays: 7, dependsOn: ["installation"], gapRelativeTo: "installation" },
};
