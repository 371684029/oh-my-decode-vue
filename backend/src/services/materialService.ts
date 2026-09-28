import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { STORAGE_MATERIALS_DIR } from '../config';
import { toSafeFileId } from './storageService';
import type { MaterialManifest } from '../types/schema';

/**
 * 物料 Manifest 存储服务 (v2.0.0)
 * - 每个物料一个文件：<STORAGE_MATERIALS_DIR>/<safeType>.json
 * - 按 type 串行写队列 + 原子写入（临时文件 + rename），防止并发保存竞态
 */
export class MaterialService {
  private writeQueues = new Map<string, Promise<unknown>>();

  constructor(private materialsDir: string = STORAGE_MATERIALS_DIR) {}

  private getFilePath(type: string): string {
    return path.join(this.materialsDir, `${toSafeFileId(type)}.json`);
  }

  private enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.writeQueues.get(key) ?? Promise.resolve();
    const next = prev.then(task, task);
    this.writeQueues.set(
      key,
      next.catch(() => {
        /* 队列不因单个任务失败而中断 */
      })
    );
    return next;
  }

  /** 保存（新建或整体覆盖）。last-writer-wins。 */
  saveMaterial(manifest: MaterialManifest): Promise<void> {
    return this.enqueue(manifest.type, async () => {
      await fs.mkdir(this.materialsDir, { recursive: true });
      const filePath = this.getFilePath(manifest.type);
      const tmpFilePath = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
      const content = JSON.stringify(manifest, null, 2);
      await fs.writeFile(tmpFilePath, content, 'utf-8');
      await fs.rename(tmpFilePath, filePath);
    });
  }

  async getMaterial(type: string): Promise<MaterialManifest | null> {
    // v2.1 目录结构优先（manifest.json）；兼容 v2.0 单文件 <type>.json
    const dirManifest = path.join(this.materialsDir, toSafeFileId(type), 'manifest.json');
    try {
      const content = await fs.readFile(dirManifest, 'utf-8');
      return JSON.parse(content) as MaterialManifest;
    } catch {
      /* 无目录结构，回落单文件 */
    }
    try {
      const filePath = this.getFilePath(type);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as MaterialManifest;
    } catch {
      return null;
    }
  }

  async listMaterials(): Promise<MaterialManifest[]> {
    try {
      const entries = await fs.readdir(this.materialsDir, { withFileTypes: true });
      const manifests: MaterialManifest[] = [];
      for (const entry of entries) {
        try {
          if (entry.isDirectory()) {
            // v2.1 目录结构
            const content = await fs.readFile(path.join(this.materialsDir, entry.name, 'manifest.json'), 'utf-8');
            manifests.push(JSON.parse(content));
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            // v2.0 单文件
            const content = await fs.readFile(path.join(this.materialsDir, entry.name), 'utf-8');
            manifests.push(JSON.parse(content));
          }
        } catch {
          // 忽略破损文件
        }
      }
      return manifests;
    } catch {
      return [];
    }
  }

  deleteMaterial(type: string): Promise<boolean> {
    return this.enqueue(type, async () => {
      try {
        const filePath = this.getFilePath(type);
        await fs.unlink(filePath);
        return true;
      } catch {
        return false;
      }
    });
  }
}

export const materialService = new MaterialService();
