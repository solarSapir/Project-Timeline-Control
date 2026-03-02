import { storage } from "./storage";
import { db } from "./db";
import { documentTemplates } from "@shared/schema";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const SEED_PATH = path.resolve(process.cwd(), "data", "template-seeds.json");

interface TemplateSeed {
  id: string;
  name: string;
  viewType: string;
  templateType: string | null;
  fileName: string;
  storedName: string;
  mimeType: string;
  htmlContent: string | null;
  pageCount: number | null;
  enabled: boolean | null;
}

export async function exportTemplateSeedsToFile(): Promise<void> {
  try {
    const templates = await storage.getDocumentTemplates();
    if (templates.length === 0) return;

    const seeds: TemplateSeed[] = templates.map(t => ({
      id: t.id,
      name: t.name,
      viewType: t.viewType,
      templateType: t.templateType,
      fileName: t.fileName,
      storedName: t.storedName,
      mimeType: t.mimeType,
      htmlContent: t.htmlContent,
      pageCount: t.pageCount,
      enabled: t.enabled,
    }));

    const dir = path.dirname(SEED_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(SEED_PATH, JSON.stringify(seeds, null, 2));
    console.log(`[Template Seed] Exported ${seeds.length} template(s) to seed file`);
  } catch (err) {
    console.error("[Template Seed] Failed to export seeds:", err instanceof Error ? err.message : err);
  }
}

export async function seedTemplatesIfNeeded(): Promise<void> {
  try {
    if (!existsSync(SEED_PATH)) {
      return;
    }

    const existing = await storage.getDocumentTemplates();
    const existingIds = new Set(existing.map(t => t.id));
    const existingNames = new Set(existing.map(t => `${t.name}::${t.viewType}`));

    const raw = readFileSync(SEED_PATH, "utf-8");
    const seeds: TemplateSeed[] = JSON.parse(raw);

    let seeded = 0;
    for (const seed of seeds) {
      if (existingIds.has(seed.id)) continue;
      if (existingNames.has(`${seed.name}::${seed.viewType}`)) continue;

      await db.insert(documentTemplates).values({
        id: seed.id,
        name: seed.name,
        viewType: seed.viewType,
        templateType: seed.templateType || "overlay",
        fileName: seed.fileName,
        storedName: seed.storedName,
        mimeType: seed.mimeType,
        htmlContent: seed.htmlContent,
        pageCount: seed.pageCount || 1,
        enabled: seed.enabled !== false,
      });
      seeded++;
    }

    if (seeded > 0) {
      console.log(`[Template Seed] Seeded ${seeded} template(s) from seed file`);
    }
  } catch (err) {
    console.error("[Template Seed] Failed to seed templates:", err instanceof Error ? err.message : err);
  }
}
