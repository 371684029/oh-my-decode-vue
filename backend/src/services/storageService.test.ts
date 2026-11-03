import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, test } from 'vitest';
import { pageSchemaValidator } from '../validation/schemaValidation';
import { StorageService, bumpVersion, toSafeFileId } from './storageService';
import { PageSchema } from '../types/schema';

function sampleSchema(id = 'page_demo'): PageSchema {
  return {
    id,
    title: '演示页',
    type: 'page',
    meta: { author: 'tester', description: 'unit', version: '1.0.0' },
    state: {},
    children: [],
    layers: []
  };
}

describe('toSafeFileId / bumpVersion', () => {
  test('接受普通 id，拒绝路径片段', () => {
    expect(toSafeFileId('page_demo')).toBe('page_demo');
    expect(toSafeFileId('pro-table_ab')).toBe('pro-table_ab');
    expect(() => toSafeFileId('../escaped')).toThrow(/Unsafe schema id/);
    expect(() => toSafeFileId('a/b')).toThrow(/Unsafe schema id/);
    expect(() => toSafeFileId('..')).toThrow(/Unsafe schema id/);
  });

  test('版本号只递增补丁位', () => {
    expect(bumpVersion('1.3.0')).toBe('1.3.1');
    expect(bumpVersion('9')).toBe('10');
    expect(bumpVersion('beta')).toBe('1.0.1');
  });
});

describe('pageSchemaValidator', () => {
  test('拒绝含路径穿越的页面 id', () => {
    const parsed = pageSchemaValidator.safeParse(sampleSchema('../etc/passwd'));
    expect(parsed.success).toBe(false);
  });

  test('接受安全 id', () => {
    const parsed = pageSchemaValidator.safeParse(sampleSchema('page_ok'));
    expect(parsed.success).toBe(true);
  });
});

describe('StorageService 备份路径', () => {
  test('连续保存产生备份，恶意 id 不会写出存储目录', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lowcode-storage-'));
    const pagesDir = path.join(root, 'pages');
    const componentsDir = path.join(root, 'components');
    await fs.mkdir(pagesDir);
    await fs.mkdir(componentsDir);
    const service = new StorageService(pagesDir, componentsDir);

    await service.saveSchema(sampleSchema());
    await service.saveSchema({ ...sampleSchema(), title: '第二版' });

    const backups = await service.listBackups('page_demo');
    expect(backups.map((item) => item.index)).toContain(1);
    const stored = await service.getSchema('page_demo');
    expect(stored?.title).toBe('第二版');

    await expect(service.saveSchema(sampleSchema('../escaped'))).rejects.toThrow(/Unsafe schema id/);
    await expect(fs.stat(path.join(root, 'escaped.bak.1'))).rejects.toThrow();
    await expect(fs.stat(path.join(root, '..', 'escaped.json'))).rejects.toThrow();
  });

  test('page 与 component 备份分目录，版本递增在队列内', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lowcode-storage-'));
    const pagesDir = path.join(root, 'pages');
    const componentsDir = path.join(root, 'components');
    await fs.mkdir(pagesDir);
    await fs.mkdir(componentsDir);
    const service = new StorageService(pagesDir, componentsDir);
    const page = sampleSchema('shared_id');
    const component = { ...sampleSchema('shared_id'), type: 'component' as const };

    const [first, second] = await Promise.all([
      service.saveVersioned(page),
      service.saveVersioned({ ...page, title: '并发' })
    ]);
    const versions = [first.saved.meta.version, second.saved.meta.version].sort();
    expect(versions).toEqual(['1.0.0', '1.0.1']);

    await service.saveVersioned(component);
    await service.saveVersioned({ ...component, title: '组件第二版' });
    const pageBackups = await fs.readdir(path.join(pagesDir, 'backups'));
    const componentBackups = await fs.readdir(path.join(componentsDir, 'backups'));
    expect(pageBackups.some((name) => name.includes('shared_id'))).toBe(true);
    expect(componentBackups.some((name) => name.includes('shared_id'))).toBe(true);

    await Promise.all([
      service.deleteSchema('shared_id', 'page'),
      service.saveVersioned({ ...page, title: '删除竞争' })
    ]);
    const leftovers = (await fs.readdir(pagesDir)).filter((name) => name.includes('.tmp'));
    expect(leftovers).toEqual([]);
  });
});

describe('StorageService 非保存路径（v2.7.0 M2 #9）', () => {
  async function makeService(): Promise<{ service: StorageService; root: string }> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lowcode-storage-ro-'));
    const pagesDir = path.join(root, 'pages');
    const componentsDir = path.join(root, 'components');
    await fs.mkdir(pagesDir);
    await fs.mkdir(componentsDir);
    return { service: new StorageService(pagesDir, componentsDir), root };
  }

  test('getSchema 命中返回完整 schema，未命中返回 null', async () => {
    const { service } = await makeService();
    expect(await service.getSchema('page_absent')).toBeNull();

    await service.saveSchema(sampleSchema('page_hit'));
    const stored = await service.getSchema('page_hit');
    expect(stored).toMatchObject({ id: 'page_hit', title: '演示页', type: 'page' });
    expect(stored?.meta).toMatchObject({ version: '1.0.0' });
    expect(Array.isArray(stored?.children)).toBe(true);
    expect(Array.isArray(stored?.layers)).toBe(true);
  });

  test('getSchema 按 type 分流：同名 page 与 component 互不串读', async () => {
    const { service } = await makeService();
    await service.saveSchema(sampleSchema('shared_read'));
    await service.saveSchema({ ...sampleSchema('shared_read'), type: 'component' as const, title: '组件版' });

    expect((await service.getSchema('shared_read', 'page'))?.title).toBe('演示页');
    expect((await service.getSchema('shared_read', 'component'))?.title).toBe('组件版');
  });

  test('listSchemas 只返回同 type 的条目，空目录返回空数组', async () => {
    const { service } = await makeService();
    expect(await service.listSchemas('page')).toEqual([]);

    await service.saveSchema(sampleSchema('list_a'));
    await service.saveSchema(sampleSchema('list_b'));
    await service.saveSchema({ ...sampleSchema('list_c'), type: 'component' as const });

    const pages = await service.listSchemas('page');
    expect(pages.map((s) => s.id).sort()).toEqual(['list_a', 'list_b']);
    const components = await service.listSchemas('component');
    expect(components.map((s) => s.id)).toEqual(['list_c']);
  });

  test('deleteSchema 删除后不可再读，重复删除返回 false', async () => {
    const { service } = await makeService();
    expect(await service.deleteSchema('page_gone')).toBe(false);

    await service.saveSchema(sampleSchema('page_del'));
    expect(await service.deleteSchema('page_del')).toBe(true);
    expect(await service.getSchema('page_del')).toBeNull();
    expect(await service.deleteSchema('page_del')).toBe(false);
  });

  test('deleteSchema 不误删同名异 type 的 schema', async () => {
    const { service } = await makeService();
    await service.saveSchema(sampleSchema('shared_del'));
    await service.saveSchema({ ...sampleSchema('shared_del'), type: 'component' as const, title: '组件版' });

    expect(await service.deleteSchema('shared_del', 'page')).toBe(true);
    expect(await service.getSchema('shared_del', 'page')).toBeNull();
    expect((await service.getSchema('shared_del', 'component'))?.title).toBe('组件版');
  });

  test('listBackups 按代数列出：.bak.1 最新 → .bak.N 最旧', async () => {
    const { service } = await makeService();
    expect(await service.listBackups('page_none')).toEqual([]);

    await service.saveSchema({ ...sampleSchema('page_backup'), title: '第一版' });
    await service.saveSchema({ ...sampleSchema('page_backup'), title: '第二版' });
    await service.saveSchema({ ...sampleSchema('page_backup'), title: '第三版' });

    const backups = await service.listBackups('page_backup');
    // 三次保存 → 两次落备份：.bak.1 是保存前的最新内容（第二版），.bak.2 是更早的（第一版）
    expect(backups.map((b) => b.index)).toEqual([1, 2]);
    expect(backups.every((b) => b.filename.startsWith('page_backup.bak.'))).toBe(true);
  });

  test('restoreBackup 恢复指定代并落为当前 schema', async () => {
    const { service } = await makeService();
    await service.saveSchema({ ...sampleSchema('page_restore'), title: '第一版' });
    await service.saveSchema({ ...sampleSchema('page_restore'), title: '第二版' });

    // .bak.1 = 第一版（保存第二版前的内容）
    const restored = await service.restoreBackup('page_restore', 'page', 1);
    expect(restored?.title).toBe('第一版');
    expect((await service.getSchema('page_restore'))?.title).toBe('第一版');
  });

  test('restoreBackup 代数不存在返回 null，不破坏当前 schema', async () => {
    const { service } = await makeService();
    await service.saveSchema({ ...sampleSchema('page_keep'), title: '现行版' });

    expect(await service.restoreBackup('page_keep', 'page', 99)).toBeNull();
    expect((await service.getSchema('page_keep'))?.title).toBe('现行版');
  });
});
