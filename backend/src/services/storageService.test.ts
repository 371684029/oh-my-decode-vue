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
});
