import fs from 'fs/promises';
import path from 'path';
import { STORAGE_PAGES_DIR, STORAGE_COMPONENTS_DIR } from '../config';
import { PageSchema } from '../types/schema';

export class StorageService {
  private getTargetDir(type: 'page' | 'component' = 'page'): string {
    return type === 'component' ? STORAGE_COMPONENTS_DIR : STORAGE_PAGES_DIR;
  }

  private getFilePath(id: string, type: 'page' | 'component' = 'page'): string {
    const dir = this.getTargetDir(type);
    // 限制文件名防止路径穿越
    const safeId = path.basename(id, '.json');
    return path.join(dir, `${safeId}.json`);
  }

  async saveSchema(schema: PageSchema): Promise<void> {
    const filePath = this.getFilePath(schema.id, schema.type);
    const content = JSON.stringify(schema, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async getSchema(id: string, type: 'page' | 'component' = 'page'): Promise<PageSchema | null> {
    try {
      const filePath = this.getFilePath(id, type);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as PageSchema;
    } catch (err) {
      return null;
    }
  }

  async listSchemas(type: 'page' | 'component' = 'page'): Promise<PageSchema[]> {
    const dir = this.getTargetDir(type);
    const files = await fs.readdir(dir);
    const schemas: PageSchema[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(dir, file), 'utf-8');
          schemas.push(JSON.parse(content));
        } catch {
          // 忽略破损文件
        }
      }
    }

    return schemas;
  }

  async deleteSchema(id: string, type: 'page' | 'component' = 'page'): Promise<boolean> {
    try {
      const filePath = this.getFilePath(id, type);
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService = new StorageService();
