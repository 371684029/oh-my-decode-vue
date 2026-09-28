import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { STORAGE_MATERIALS_DIR } from '../config';
import { toSafeFileId } from './storageService';
import type { MaterialManifest, MaterialVersion, MaterialVersionMeta } from '../types/schema';
import { classifyVersionChange, suggestVersion, buildChangelog, contractSignature, type VersionBump } from '../utils/versionClassify';

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/**
 * 物料版本存储服务 (v2.1.0)
 * 目录结构：
 *   materials/<id>/manifest.json     # 元数据 + 版本索引（不含 schema）
 *   materials/<id>/draft.json        # 草稿（仅一份）
 *   materials/<id>/versions/<v>.json # 不可变版本快照（发布后永不改写，无更新入口）
 * 兼容：旧 v2.0 单文件 <id>.json 首次访问时惰性迁移为 versions/1.0.0.json + manifest.json
 */
export class MaterialVersionService {
  private writeQueues = new Map<string, Promise<unknown>>();

  constructor(private materialsDir: string = STORAGE_MATERIALS_DIR) {}

  private dirOf(id: string): string {
    return path.join(this.materialsDir, toSafeFileId(id));
  }

  private fileOf(id: string, name: string): string {
    return path.join(this.dirOf(id), name);
  }

  private versionFileOf(id: string, v: string): string {
    return path.join(this.dirOf(id), 'versions', `${v}.json`);
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

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, content, 'utf-8');
    await fs.rename(tmp, filePath);
  }

  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  /** 惰性迁移：旧 v2.0 单文件 <id>.json → 目录结构（versions/1.0.0.json + manifest.json） */
  private async ensureMigrated(id: string): Promise<void> {
    const manifestPath = this.fileOf(id, 'manifest.json');
    if (await this.fileExists(manifestPath)) return;
    const legacy = await this.readJson<MaterialManifest>(path.join(this.materialsDir, `${toSafeFileId(id)}.json`));
    if (!legacy || !legacy.schema) return;
    const version: MaterialVersion = {
      version: '1.0.0',
      schema: legacy.schema,
      contract: legacy.contract || { inputs: [], outputs: [] },
      contractSignature: contractSignature(legacy.contract || { inputs: [], outputs: [] }),
      summary: legacy.summary || [],
      changelog: '从 v2.0.0 迁移',
      publishedAt: new Date().toISOString(),
      releasedBy: 'system'
    };
    await fs.mkdir(path.join(this.dirOf(id), 'versions'), { recursive: true });
    await this.atomicWrite(this.versionFileOf(id, '1.0.0'), JSON.stringify(version, null, 2));
    await this.atomicWrite(manifestPath, JSON.stringify(this.withVersionIndex(legacy, '1.0.0', version), null, 2));
    // 迁移后删除旧单文件
    try {
      await fs.unlink(path.join(this.materialsDir, `${toSafeFileId(id)}.json`));
    } catch {
      /* 忽略 */
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private withVersionIndex(manifest: MaterialManifest, version: string, v: MaterialVersion): MaterialManifest {
    const meta: MaterialVersionMeta = {
      version,
      contractSignature: v.contractSignature,
      publishedAt: v.publishedAt,
      refCount: 0
    };
    return {
      ...manifest,
      currentVersion: version,
      contract: v.contract,
      schema: undefined, // 索引不含 schema
      versions: { ...(manifest.versions || {}), [version]: meta }
    };
  }

  // ================= 读取 =================

  async getManifest(id: string): Promise<MaterialManifest | null> {
    await this.ensureMigrated(id);
    return this.readJson<MaterialManifest>(this.fileOf(id, 'manifest.json'));
  }

  async getVersion(id: string, v: string): Promise<MaterialVersion | null> {
    if (!SEMVER_RE.test(v)) return null;
    await this.ensureMigrated(id);
    return this.readJson<MaterialVersion>(this.versionFileOf(id, v));
  }

  async listVersions(id: string): Promise<MaterialVersionMeta[]> {
    const manifest = await this.getManifest(id);
    if (!manifest?.versions) return [];
    return Object.values(manifest.versions).sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  }

  async getDraft(id: string): Promise<MaterialVersion | null> {
    return this.readJson<MaterialVersion>(this.fileOf(id, 'draft.json'));
  }

  // ================= 写（全部串行队列） =================

  saveDraft(id: string, draft: MaterialVersion): Promise<void> {
    return this.enqueue(id, () => this.atomicWrite(this.fileOf(id, 'draft.json'), JSON.stringify(draft, null, 2)));
  }

  discardDraft(id: string): Promise<void> {
    return this.enqueue(id, async () => {
      try {
        await fs.unlink(this.fileOf(id, 'draft.json'));
      } catch {
        /* 无草稿 */
      }
    });
  }

  /** 发布：draft → 不可变版本。返回版本号 / 变更摘要 / bump 类型。 */
  publish(id: string, draft: MaterialVersion, forcedVersion?: string): Promise<{ version: string; changelog: string; bump: VersionBump }> {
    return this.enqueue(id, async () => {
      const manifest = await this.getManifest(id);
      if (!manifest) throw new Error(`物料不存在: ${id}`);
      const prev = manifest.currentVersion ? await this.getVersion(id, manifest.currentVersion) : null;

      let version: string;
      let changelog: string;
      let bump: VersionBump;
      if (prev) {
        const result = classifyVersionChange(prev, draft);
        if (result.bump === 'none') throw new Error('内容未变化，禁止发布空版本');
        bump = result.bump;
        version = forcedVersion && SEMVER_RE.test(forcedVersion) ? forcedVersion : suggestVersion(manifest.currentVersion!, bump);
        changelog = buildChangelog(prev, draft, bump);
      } else {
        bump = 'minor';
        version = forcedVersion && SEMVER_RE.test(forcedVersion) ? forcedVersion : '1.0.0';
        changelog = '首次发布';
      }

      // 版本号已被占用 → 自动递增 patch 直到可用
      let finalVersion = version;
      let guard = 0;
      while ((await this.getVersion(id, finalVersion)) && guard < 50) {
        finalVersion = suggestVersion(finalVersion, 'patch');
        guard++;
      }
      if (guard >= 50) throw new Error(`版本号冲突无法分配: ${id}@${version}`);

      const released: MaterialVersion = {
        ...draft,
        version: finalVersion,
        changelog,
        contractSignature: contractSignature(draft.contract),
        publishedAt: new Date().toISOString(),
        releasedBy: 'designer_user'
      };
      await fs.mkdir(path.join(this.dirOf(id), 'versions'), { recursive: true });
      await this.atomicWrite(this.versionFileOf(id, finalVersion), JSON.stringify(released, null, 2));
      await this.atomicWrite(this.fileOf(id, 'manifest.json'), JSON.stringify(this.withVersionIndex(manifest, finalVersion, released), null, 2));
      // 直接删草稿（不可再调用 discardDraft：会以同一 id 再次入队造成自等待死锁）
      try {
        await fs.unlink(this.fileOf(id, 'draft.json'));
      } catch {
        /* 无草稿 */
      }
      return { version: finalVersion, changelog, bump };
    });
  }

  /** 注册物料并发布首个版本（v2.1 黑盒一步到位：manifest.json + versions/1.0.0.json） */
  registerWithVersion(manifest: MaterialManifest, version = '1.0.0'): Promise<{ version: string }> {
    return this.enqueue(manifest.type, async () => {
      const v = SEMVER_RE.test(version) ? version : '1.0.0';
      const contract = manifest.contract || { inputs: [], outputs: [] };
      const snapshot: MaterialVersion = {
        version: v,
        schema: manifest.schema || [],
        contract,
        contractSignature: contractSignature(contract),
        summary: manifest.summary || [],
        changelog: '首次发布',
        publishedAt: new Date().toISOString(),
        releasedBy: 'designer_user'
      };
      await fs.mkdir(path.join(this.dirOf(manifest.type), 'versions'), { recursive: true });
      await this.atomicWrite(this.versionFileOf(manifest.type, v), JSON.stringify(snapshot, null, 2));
      await this.atomicWrite(
        this.fileOf(manifest.type, 'manifest.json'),
        JSON.stringify(this.withVersionIndex(manifest, v, snapshot), null, 2)
      );
      return { version: v };
    });
  }

  /** 回滚：把历史版本设为当前（实例不动，实例显式升级才跟随） */
  setCurrent(id: string, v: string): Promise<{ version: string }> {
    return this.enqueue(id, async () => {
      if (!SEMVER_RE.test(v)) throw new Error(`非法版本号: ${v}`);
      const manifest = await this.getManifest(id);
      if (!manifest) throw new Error(`物料不存在: ${id}`);
      const version = await this.getVersion(id, v);
      if (!version) throw new Error(`版本不存在: ${id}@${v}`);
      await this.atomicWrite(this.fileOf(id, 'manifest.json'), JSON.stringify(this.withVersionIndex(manifest, v, version), null, 2));
      return { version: v };
    });
  }

  /** 归档版本：仅允许归档非当前版本 */
  archiveVersion(id: string, v: string): Promise<void> {
    return this.enqueue(id, async () => {
      if (!SEMVER_RE.test(v)) throw new Error(`非法版本号: ${v}`);
      const manifest = await this.getManifest(id);
      if (!manifest) throw new Error(`物料不存在: ${id}`);
      if (manifest.currentVersion === v) throw new Error(`当前版本不可归档: ${id}@${v}`);
      if (!manifest.versions?.[v]) throw new Error(`版本不存在: ${id}@${v}`);
      const versions = { ...manifest.versions };
      delete versions[v];
      const next: MaterialManifest = { ...manifest, versions };
      await this.atomicWrite(this.fileOf(id, 'manifest.json'), JSON.stringify(next, null, 2));
      try {
        await fs.unlink(this.versionFileOf(id, v));
      } catch {
        /* 文件可能已不存在 */
      }
    });
  }

  /** fork：从指定版本派生新物料（新 id 起点版本作为 1.0.0） */
  fork(id: string, fromVersion: string, newType: string, label: string, icon: string): Promise<MaterialManifest> {
    return this.enqueue(`fork:${newType}`, async () => {
      if (!newType.startsWith('custom-')) throw new Error('新物料 type 必须以 custom- 前缀开头');
      const source = await this.getVersion(id, fromVersion);
      if (!source) throw new Error(`源版本不存在: ${id}@${fromVersion}`);
      const base = await this.getManifest(id);
      if (!base) throw new Error(`物料不存在: ${id}`);
      const draft: MaterialVersion = {
        ...source,
        version: '1.0.0',
        contractSignature: contractSignature(source.contract),
        changelog: `从 ${id}@${fromVersion} fork`,
        publishedAt: new Date().toISOString(),
        releasedBy: 'designer_user'
      };
      const manifest: MaterialManifest = {
        type: newType,
        label,
        icon,
        category: base.category,
        defaultLayout: base.defaultLayout,
        defaultProps: {},
        defaultAttrs: {},
        kind: 'composite',
        summary: source.summary || [],
        schema: undefined,
        contract: source.contract,
        currentVersion: '1.0.0',
        versions: { '1.0.0': { version: '1.0.0', contractSignature: draft.contractSignature, publishedAt: draft.publishedAt, refCount: 0 } }
      };
      await fs.mkdir(path.join(this.dirOf(newType), 'versions'), { recursive: true });
      await this.atomicWrite(this.versionFileOf(newType, '1.0.0'), JSON.stringify(draft, null, 2));
      await this.atomicWrite(this.fileOf(newType, 'manifest.json'), JSON.stringify(manifest, null, 2));
      return manifest;
    });
  }

  /** 删除整目录（含全部版本与草稿） */
  deleteMaterial(id: string): Promise<void> {
    return this.enqueue(id, async () => {
      await fs.rm(this.dirOf(id), { recursive: true, force: true });
    });
  }
}

export const materialVersionService = new MaterialVersionService();
