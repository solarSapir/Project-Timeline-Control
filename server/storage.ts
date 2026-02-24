import { eq, and, lte, isNull, or, desc, asc } from "drizzle-orm";
import { db } from "./db";
import {
  users, projects, projectDeadlines, taskActions, installSchedule,
  type User, type InsertUser,
  type Project, type InsertProject,
  type ProjectDeadline, type InsertProjectDeadline,
  type TaskAction, type InsertTaskAction,
  type InstallSchedule, type InsertInstallSchedule,
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
}

export const storage = new DatabaseStorage();
