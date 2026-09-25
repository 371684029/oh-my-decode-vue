import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { STORAGE_PAGES_DIR, STORAGE_COMPONENTS_DIR } from '../config';
import { PageSchema } from '../types/schema';

/** 备份保留代数 */
const MAX_BACKUPS = 5;

export interface BackupInfo {
  index: number;
  filename: string;
  size: number;
  mtime: string;
}

const SAFE_FILE_ID = /^[A-Za-z0-9_-]+$/;

/** 把 schema id 收成安全文件名。含 `/`、`\\` 或 `..` 的 id 直接拒绝，而不是先 basename 再落盘。 */
export function toSafeFileId(id: string): string {
  const raw = String(id ?? '');
  if (raw.includes('/') || raw.includes('\\') || raw.includes('..')) {
    throw new Error(`Unsafe schema id: ${id}`);
  }
  const base = path.basename(raw, '.json');
  if (!SAFE_FILE_ID.test(base)) {
    throw new Error(`Unsafe schema id: ${id}`);
  }
  return base;
}

export class StorageService {
  /** 按 id 的串行写队列，防止并发保存竞态 */
  private writeQueues = new Map<string, Promise<unknown>>();

  constructor(
    private pagesDir: string = STORAGE_PAGES_DIR,
    private componentsDir: string = STORAGE_COMPONENTS_DIR
  ) {}

  private getTargetDir(type: 'page' | 'component' = 'page'): string {
    return type === 'component' ? this.componentsDir : this.pagesDir;
  }

  private getFilePath(id: string, type: 'page' | 'component' = 'page'): string {
    const dir = this.getTargetDir(type);
    return path.join(dir, `${toSafeFileId(id)}.json`);
  }

  private getBackupDir(type: 'page' | 'component' = 'page'): string {
    return path.join(this.getTargetDir(type), 'backups');
  }

  private queueKey(id: string, type: 'page' | 'component'): string {
    return `${type}:${String(id ?? '')}`;
  }

  /** 按类型和 id 串行化写入任务（P2-3 并发写保护） */
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

  /** 备份轮转：保留最近 MAX_BACKUPS 代（.bak.1 最新 → .bak.N 最旧） */
  private async rotateBackups(filePath: string, id: string, type: 'page' | 'component'): Promise<void> {
    const backupDir = this.getBackupDir(type);
    const safeId = toSafeFileId(id);
    await fs.mkdir(backupDir, { recursive: true });

    // 后移旧代
    for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
      const from = path.join(backupDir, `${safeId}.bak.${i}`);
      const to = path.join(backupDir, `${safeId}.bak.${i + 1}`);
      try {
        await fs.rename(from, to);
      } catch {
        // 无该代备份，忽略
      }
    }
    // 当前文件 → .bak.1
    try {
      const exists = await fs.stat(filePath);
      if (exists.isFile()) {
        await fs.copyFile(filePath, path.join(backupDir, `${safeId}.bak.1`));
      }
    } catch {
      // 首次保存无既有文件
    }
  }

  saveSchema(schema: PageSchema): Promise<void> {
    return this.enqueue(this.queueKey(schema.id, schema.type), () => this.doSaveSchema(schema));
  }

  /**
   * 在写队列内读取旧版本、递增并落盘。
   * previous 是递增前的文件内容，供审计 diff 使用。
   */
  saveVersioned(schema: PageSchema): Promise<{ saved: PageSchema; previous: PageSchema | null }> {
    return this.enqueue(this.queueKey(schema.id, schema.type), async () => {
      const existing = await this.getSchema(schema.id, schema.type);
      const saved: PageSchema = {
        ...schema,
        meta: { ...(schema.meta ?? { author: '', description: '', version: '1.0.0' }) }
      };
      if (existing?.meta?.version) {
        saved.meta.prevVersion = existing.meta.version;
        saved.meta.version = bumpVersion(existing.meta.version);
      } else {
        saved.meta.version = saved.meta.version || '1.0.0';
      }
      await this.doSaveSchema(saved);
      return { saved, previous: existing };
    });
  }

  private async doSaveSchema(schema: PageSchema): Promise<void> {
    const filePath = this.getFilePath(schema.id, schema.type);
    // 备份轮转（保留 N 代）
    await this.rotateBackups(filePath, schema.id, schema.type);

    // 原子写入：随机后缀临时文件 + 重命名替换
    const tmpFilePath = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
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

  deleteSchema(id: string, type: 'page' | 'component' = 'page'): Promise<boolean> {
    return this.enqueue(this.queueKey(id, type), async () => {
      try {
        const filePath = this.getFilePath(id, type);
        await fs.unlink(filePath);
        return true;
      } catch {
        return false;
      }
    });
  }

  /** 列出某 schema 的备份代数（P2-2） */
  async listBackups(id: string, type: 'page' | 'component' = 'page'): Promise<BackupInfo[]> {
    const backupDir = this.getBackupDir(type);
    const safeId = toSafeFileId(id);
    const infos: BackupInfo[] = [];
    try {
      const files = await fs.readdir(backupDir);
      for (const file of files) {
        const m = file.match(new RegExp(`^${safeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.bak\\.(\\d+)$`));
        if (m) {
          const stat = await fs.stat(path.join(backupDir, file));
          infos.push({
            index: Number(m[1]),
            filename: file,
            size: stat.size,
            mtime: stat.mtime.toISOString()
          });
        }
      }
    } catch {
      // 备份目录不存在
    }
    return infos.sort((a, b) => a.index - b.index);
  }

  /** 从指定备份代恢复（P2-2 / P1-4 回滚） */
  async restoreBackup(id: string, type: 'page' | 'component' = 'page', index: number): Promise<PageSchema | null> {
    const safeId = toSafeFileId(id);
    const backupPath = path.join(this.getBackupDir(type), `${safeId}.bak.${index}`);
    try {
      const content = await fs.readFile(backupPath, 'utf-8');
      const schema = JSON.parse(content) as PageSchema;
      await this.saveSchema(schema);
      return schema;
    } catch {
      return null;
    }
  }
}

/** 版本号递增：x.y.z → x.y.(z+1)；非 x.y.z 形式 → 数字 +1 */
export function bumpVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? ''));
  if (match) {
    const patch = Number(match[3]) + 1;
    return `${match[1]}.${match[2]}.${patch}`;
  }
  const num = Number(version);
  return Number.isNaN(num) ? '1.0.1' : String(num + 1);
}

export const storageService = new StorageService();
