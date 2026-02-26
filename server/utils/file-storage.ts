import { randomUUID } from "crypto";
import { existsSync, mkdirSync, unlinkSync, createReadStream } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { storage } from "../storage";
import type { ProjectFile } from "@shared/schema";
import type { ReadStream } from "fs";

const UPLOADS_BASE = path.resolve(process.cwd(), "data", "uploads");

export function ensureUploadDir(projectId: string, category: string): string {
  const dir = path.join(UPLOADS_BASE, projectId, category);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getFilePath(projectId: string, category: string, storedName: string): string {
  return path.join(UPLOADS_BASE, projectId, category, storedName);
}

export async function saveFileLocally(
  projectId: string,
  category: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  uploadedBy?: string,
  notes?: string
): Promise<ProjectFile> {
  const dir = ensureUploadDir(projectId, category);
  const ext = path.extname(originalName);
  const storedName = `${randomUUID()}${ext}`;
  const filePath = path.join(dir, storedName);

  await writeFile(filePath, buffer);

  const record = await storage.createProjectFile({
    projectId,
    category,
    fileName: originalName,
    storedName,
    mimeType: mimeType || null,
    fileSize: buffer.length,
    uploadedBy: uploadedBy || null,
    notes: notes || null,
    fileData: buffer,
  });

  const { fileData: _, ...withoutData } = record;
  return withoutData as ProjectFile;
}

export async function deleteFileLocally(fileId: string): Promise<boolean> {
  const file = await storage.getProjectFile(fileId);
  if (!file) return false;

  const filePath = getFilePath(file.projectId, file.category, file.storedName);
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    console.warn(`[FileStorage] Could not delete file from disk: ${filePath}`);
  }

  return storage.deleteProjectFile(fileId);
}

export function createFileReadStream(projectId: string, category: string, storedName: string): ReadStream | null {
  const filePath = getFilePath(projectId, category, storedName);
  if (!existsSync(filePath)) return null;
  return createReadStream(filePath);
}

export async function getFileBuffer(fileId: string): Promise<Buffer | null> {
  const metaFile = await storage.getProjectFile(fileId);
  if (!metaFile) return null;

  const filePath = getFilePath(metaFile.projectId, metaFile.category, metaFile.storedName);
  if (existsSync(filePath)) {
    const { readFileSync } = await import("fs");
    return readFileSync(filePath);
  }

  const fullFile = await storage.getProjectFileWithData(fileId);
  if (fullFile?.fileData) {
    try {
      ensureUploadDir(fullFile.projectId, fullFile.category);
      await writeFile(filePath, fullFile.fileData);
    } catch {}
    return fullFile.fileData instanceof Buffer ? fullFile.fileData : Buffer.from(fullFile.fileData as any);
  }

  return null;
}

export function getDownloadUrl(projectId: string, fileId: string): string {
  return `/api/projects/${projectId}/files/${fileId}/download`;
}
