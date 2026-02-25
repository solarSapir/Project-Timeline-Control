import { eq, and, lte, isNull, or, desc, asc, ilike } from "drizzle-orm";
import { db } from "./db";
import {
  users, projects, projectDeadlines, taskActions, installSchedule, workflowConfig, errorLogs, hrspConfig, projectFiles, escalationTickets,
  type User, type InsertUser,
  type Project, type InsertProject,
  type ProjectDeadline, type InsertProjectDeadline,
  type TaskAction, type InsertTaskAction,
  type InstallSchedule, type InsertInstallSchedule,
  type WorkflowConfig, type InsertWorkflowConfig,
  type ErrorLog, type InsertErrorLog,
  type HrspConfig,
  type ProjectFile, type InsertProjectFile,
  type EscalationTicket, type InsertEscalationTicket,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  getProjectByAsanaGid(gid: string): Promise<Project | undefined>;
  upsertProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;

  getProjectDeadlines(projectId: string): Promise<ProjectDeadline[]>;
  upsertProjectDeadline(data: InsertProjectDeadline): Promise<ProjectDeadline>;
  getAllDeadlines(): Promise<ProjectDeadline[]>;

  getTaskActions(projectId: string, viewType?: string): Promise<TaskAction[]>;
  getTaskActionsByView(viewType: string): Promise<TaskAction[]>;
  getFollowUpTasks(viewType: string, beforeDate: string): Promise<TaskAction[]>;
  createTaskAction(data: InsertTaskAction): Promise<TaskAction>;

  getInstallSchedules(projectId: string): Promise<InstallSchedule[]>;
  upsertInstallSchedule(data: InsertInstallSchedule & { id?: string }): Promise<InstallSchedule>;
  getAllInstallSchedules(): Promise<InstallSchedule[]>;

  getWorkflowConfigs(): Promise<WorkflowConfig[]>;
  upsertWorkflowConfig(data: InsertWorkflowConfig): Promise<WorkflowConfig>;

  createErrorLog(data: InsertErrorLog): Promise<ErrorLog>;
  getErrorLogs(filters?: { resolved?: boolean; search?: string }): Promise<ErrorLog[]>;
  markErrorResolved(id: string, note: string): Promise<ErrorLog | undefined>;
  clearResolvedErrors(): Promise<number>;

  getHrspConfig(): Promise<HrspConfig | undefined>;
  upsertHrspConfig(data: { invoiceTemplate?: unknown; requiredDocuments?: unknown }): Promise<HrspConfig>;

  getProjectFiles(projectId: string, category?: string): Promise<ProjectFile[]>;
  getProjectFile(id: string): Promise<ProjectFile | undefined>;
  createProjectFile(data: InsertProjectFile): Promise<ProjectFile>;
  deleteProjectFile(id: string): Promise<boolean>;

  getEscalationTickets(filters?: { status?: string; viewType?: string; projectId?: string }): Promise<EscalationTicket[]>;
  getEscalationTicket(id: string): Promise<EscalationTicket | undefined>;
  createEscalationTicket(data: InsertEscalationTicket): Promise<EscalationTicket>;
  updateEscalationTicket(id: string, data: Partial<{ status: string; managerResponse: string; respondedBy: string; respondedAt: Date; resolvedAt: Date }>): Promise<EscalationTicket | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(asc(projects.name));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjectByAsanaGid(gid: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.asanaGid, gid));
    return project;
  }

  async upsertProject(data: InsertProject): Promise<Project> {
    if (data.asanaGid) {
      const existing = await this.getProjectByAsanaGid(data.asanaGid);
      if (existing) {
        const [updated] = await db.update(projects)
          .set({ ...data, lastSyncedAt: new Date() })
          .where(eq(projects.id, existing.id))
          .returning();
        return updated;
      }
    }
    const [created] = await db.insert(projects).values({ ...data, lastSyncedAt: new Date() }).returning();
    return created;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects)
      .set(data)
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async getProjectDeadlines(projectId: string): Promise<ProjectDeadline[]> {
    return db.select().from(projectDeadlines).where(eq(projectDeadlines.projectId, projectId));
  }

  async upsertProjectDeadline(data: InsertProjectDeadline): Promise<ProjectDeadline> {
    const [existing] = await db.select().from(projectDeadlines)
      .where(and(
        eq(projectDeadlines.projectId, data.projectId),
        eq(projectDeadlines.stage, data.stage)
      ));
    if (existing) {
      const [updated] = await db.update(projectDeadlines)
        .set(data)
        .where(eq(projectDeadlines.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(projectDeadlines).values(data).returning();
    return created;
  }

  async getAllDeadlines(): Promise<ProjectDeadline[]> {
    return db.select().from(projectDeadlines);
  }

  async getTaskActions(projectId: string, viewType?: string): Promise<TaskAction[]> {
    if (viewType) {
      return db.select().from(taskActions)
        .where(and(eq(taskActions.projectId, projectId), eq(taskActions.viewType, viewType)))
        .orderBy(desc(taskActions.completedAt));
    }
    return db.select().from(taskActions)
      .where(eq(taskActions.projectId, projectId))
      .orderBy(desc(taskActions.completedAt));
  }

  async getTaskActionsByView(viewType: string): Promise<TaskAction[]> {
    return db.select().from(taskActions)
      .where(eq(taskActions.viewType, viewType))
      .orderBy(desc(taskActions.completedAt));
  }

  async getFollowUpTasks(viewType: string, beforeDate: string): Promise<TaskAction[]> {
    return db.select().from(taskActions)
      .where(and(
        eq(taskActions.viewType, viewType),
        lte(taskActions.followUpDate, beforeDate),
        eq(taskActions.actionType, "follow_up")
      ))
      .orderBy(asc(taskActions.followUpDate));
  }

  async createTaskAction(data: InsertTaskAction): Promise<TaskAction> {
    const [action] = await db.insert(taskActions).values(data).returning();
    return action;
  }

  async getInstallSchedules(projectId: string): Promise<InstallSchedule[]> {
    return db.select().from(installSchedule)
      .where(eq(installSchedule.projectId, projectId))
      .orderBy(asc(installSchedule.scheduledDate));
  }

  async upsertInstallSchedule(data: InsertInstallSchedule & { id?: string }): Promise<InstallSchedule> {
    if (data.id) {
      const [updated] = await db.update(installSchedule)
        .set(data)
        .where(eq(installSchedule.id, data.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(installSchedule).values(data).returning();
    return created;
  }

  async getAllInstallSchedules(): Promise<InstallSchedule[]> {
    return db.select().from(installSchedule).orderBy(asc(installSchedule.scheduledDate));
  }

  async getWorkflowConfigs(): Promise<WorkflowConfig[]> {
    return db.select().from(workflowConfig);
  }

  async upsertWorkflowConfig(data: InsertWorkflowConfig): Promise<WorkflowConfig> {
    const [existing] = await db.select().from(workflowConfig)
      .where(eq(workflowConfig.stage, data.stage));
    if (existing) {
      const [updated] = await db.update(workflowConfig)
        .set(data)
        .where(eq(workflowConfig.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(workflowConfig).values(data).returning();
    return created;
  }
  async createErrorLog(data: InsertErrorLog): Promise<ErrorLog> {
    const [log] = await db.insert(errorLogs).values(data).returning();
    return log;
  }

  async getErrorLogs(filters?: { resolved?: boolean; search?: string }): Promise<ErrorLog[]> {
    const conditions = [];
    if (filters?.resolved !== undefined) {
      conditions.push(eq(errorLogs.resolved, filters.resolved));
    }
    if (filters?.search) {
      conditions.push(ilike(errorLogs.errorMessage, `%${filters.search}%`));
    }
    if (conditions.length > 0) {
      return db.select().from(errorLogs)
        .where(and(...conditions))
        .orderBy(desc(errorLogs.createdAt))
        .limit(200);
    }
    return db.select().from(errorLogs)
      .orderBy(desc(errorLogs.createdAt))
      .limit(200);
  }

  async markErrorResolved(id: string, note: string): Promise<ErrorLog | undefined> {
    const [updated] = await db.update(errorLogs)
      .set({ resolved: true, resolvedNote: note })
      .where(eq(errorLogs.id, id))
      .returning();
    return updated;
  }

  async clearResolvedErrors(): Promise<number> {
    const result = await db.delete(errorLogs).where(eq(errorLogs.resolved, true));
    return result.rowCount ?? 0;
  }

  async getHrspConfig(): Promise<HrspConfig | undefined> {
    const [config] = await db.select().from(hrspConfig).limit(1);
    return config;
  }

  async upsertHrspConfig(data: { invoiceTemplate?: unknown; requiredDocuments?: unknown }): Promise<HrspConfig> {
    const existing = await this.getHrspConfig();
    if (existing) {
      const [updated] = await db.update(hrspConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(hrspConfig.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(hrspConfig).values(data).returning();
    return created;
  }

  async getProjectFiles(projectId: string, category?: string): Promise<ProjectFile[]> {
    if (category) {
      return db.select().from(projectFiles)
        .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.category, category)))
        .orderBy(desc(projectFiles.createdAt));
    }
    return db.select().from(projectFiles)
      .where(eq(projectFiles.projectId, projectId))
      .orderBy(desc(projectFiles.createdAt));
  }

  async getProjectFile(id: string): Promise<ProjectFile | undefined> {
    const [file] = await db.select().from(projectFiles).where(eq(projectFiles.id, id));
    return file;
  }

  async createProjectFile(data: InsertProjectFile): Promise<ProjectFile> {
    const [file] = await db.insert(projectFiles).values(data).returning();
    return file;
  }

  async deleteProjectFile(id: string): Promise<boolean> {
    const result = await db.delete(projectFiles).where(eq(projectFiles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getEscalationTickets(filters?: { status?: string; viewType?: string; projectId?: string }): Promise<EscalationTicket[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(escalationTickets.status, filters.status));
    if (filters?.viewType) conditions.push(eq(escalationTickets.viewType, filters.viewType));
    if (filters?.projectId) conditions.push(eq(escalationTickets.projectId, filters.projectId));

    if (conditions.length > 0) {
      return db.select().from(escalationTickets)
        .where(and(...conditions))
        .orderBy(desc(escalationTickets.createdAt));
    }
    return db.select().from(escalationTickets).orderBy(desc(escalationTickets.createdAt));
  }

  async getEscalationTicket(id: string): Promise<EscalationTicket | undefined> {
    const [ticket] = await db.select().from(escalationTickets).where(eq(escalationTickets.id, id));
    return ticket;
  }

  async createEscalationTicket(data: InsertEscalationTicket): Promise<EscalationTicket> {
    const [ticket] = await db.insert(escalationTickets).values(data).returning();
    return ticket;
  }

  async updateEscalationTicket(id: string, data: Partial<{ status: string; managerResponse: string; respondedBy: string; respondedAt: Date; resolvedAt: Date }>): Promise<EscalationTicket | undefined> {
    const [ticket] = await db.update(escalationTickets)
      .set(data)
      .where(eq(escalationTickets.id, id))
      .returning();
    return ticket;
  }
}

export const storage = new DatabaseStorage();
