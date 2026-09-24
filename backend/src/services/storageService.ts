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
    const backupDir = path.join(path.dirname(filePath), '../backups');
    await fs.mkdir(backupDir, { recursive: true });

    // 1. 如果文件已存在，保留副本至 backups 目录 (.bak)
    try {
      const exists = await fs.stat(filePath);
      if (exists.isFile()) {
        const backupPath = path.join(backupDir, `${schema.id}.bak`);
        await fs.copyFile(filePath, backupPath);
      }
    } catch {
      // 忽略文件不存在的报错
    }

    // 2. 原子写入：先写入 .tmp 临时文件，而后进行重命名替换，防止保存中断造成文件损坏
    const tmpFilePath = `${filePath}.${Date.now()}.tmp`;
    const content = JSON.stringify(schema, null, 2);
    await fs.writeFile(tmpFilePath, content, 'utf-8');
    await fs.rename(tmpFilePath, filePath);
  }

  async getSchema(id: string, type: 'page' | 'component' = 'page'): Promise<PageSchema | null> {
    try {
      const filePath = this.getFilePath(id, type);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as PageSchema;
    } catch {
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
