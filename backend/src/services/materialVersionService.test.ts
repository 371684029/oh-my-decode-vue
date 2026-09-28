import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, test } from 'vitest';
import { MaterialVersionService } from './materialVersionService';
import { materialVersionValidator } from '../validation/materialValidation';
import type { MaterialManifest, MaterialVersion } from '../types/schema';

function node(id: string, type = 'el-button', props: Record<string, unknown> = {}): any {
  return { id, type, label: type, layout: { x: 0, y: 0, w: 2, h: 2, i: id }, props, attrs: {}, style: {}, events: {} };
}

function baseManifest(type = 'custom-user-card'): MaterialManifest {
  return {
    type,
    label: '用户卡片',
    icon: 'Avatar',
    category: 'pro',
    defaultLayout: { w: 6, h: 4 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    summary: ['el-button']
  };
}

function draft(schema: any[], contract: any = { inputs: [], outputs: [] }, overrides: Record<string, unknown> = {}): MaterialVersion {
  return {
    version: '0.0.0', // draft 版本号占位，发布时重写
    schema,
    contract,
    contractSignature: '',
    summary: [],
    changelog: '',
    publishedAt: '',
    releasedBy: 'tester',
    ...overrides
  };
}

async function setupService(): Promise<{ dir: string; service: MaterialVersionService }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lowcode-mv-'));
  const service = new MaterialVersionService(dir);
  // 首次注册：manifest.json + versions/1.0.0.json
  await service.registerWithVersion(
    {
      ...baseManifest(),
      kind: 'composite',
      summary: ['el-button'],
      schema: [node('n1', 'el-button', { text: '旧' })],
      contract: { inputs: [], outputs: [] }
    },
    '1.0.0'
  );
  return { dir, service };
}

describe('materialVersionService 版本存储', () => {
  test('首次发布生成 1.0.0 与版本索引', async () => {
    const { dir, service } = await setupService();
    const version = await service.getVersion('custom-user-card', '1.0.0');
    expect(version?.version).toBe('1.0.0');
    const manifest = await service.getManifest('custom-user-card');
    expect(manifest?.currentVersion).toBe('1.0.0');
    expect(manifest?.versions?.['1.0.0']).toBeTruthy();
    // 目录结构：versions/ 下存在 1.0.0.json
    const files = await fs.readdir(path.join(dir, 'custom-user-card', 'versions'));
    expect(files).toContain('1.0.0.json');
  });

  test('发布不可变：二次发布产生新版本而非覆盖', async () => {
    const { service } = await setupService();
    const r1 = await service.publish('custom-user-card', draft([node('n1', 'el-button', { text: '新文案' })]));
    expect(r1.version).toBe('1.0.1'); // patch
    const v1 = await service.getVersion('custom-user-card', '1.0.0');
    const v2 = await service.getVersion('custom-user-card', '1.0.1');
    expect(v1?.schema[0].props.text).toBe('旧');
    expect(v2?.schema[0].props.text).toBe('新文案');
  });

  test('空内容发布被拒绝', async () => {
    const { service } = await setupService();
    await expect(service.publish('custom-user-card', draft([node('n1', 'el-button', { text: '旧' })]))).rejects.toThrow(/内容未变化/);
  });

  test('契约变化 → major', async () => {
    const { service } = await setupService();
    const r = await service.publish('custom-user-card', draft([node('n1')], { inputs: [{ name: 'title', label: '标题', type: 'string', nodeId: 'n1', fieldPath: 'props.title', required: false }], outputs: [] }));
    expect(r.bump).toBe('major');
    expect(r.version).toBe('2.0.0');
  });

  test('rollback 把历史版本设为当前', async () => {
    const { service } = await setupService();
    await service.publish('custom-user-card', draft([node('n1', 'el-button', { text: '新文案' })]));
    const r = await service.setCurrent('custom-user-card', '1.0.0');
    expect(r.version).toBe('1.0.0');
    const manifest = await service.getManifest('custom-user-card');
    expect(manifest?.currentVersion).toBe('1.0.0');
  });

  test('当前版本不可归档，历史版本可归档', async () => {
    const { service } = await setupService();
    await service.publish('custom-user-card', draft([node('n1', 'el-button', { text: '新文案' })]));
    await expect(service.archiveVersion('custom-user-card', '1.0.1')).rejects.toThrow(/当前版本/);
    await service.archiveVersion('custom-user-card', '1.0.0');
    const manifest = await service.getManifest('custom-user-card');
    expect(manifest?.versions?.['1.0.0']).toBeUndefined();
  });

  test('fork 从指定版本派生新物料', async () => {
    const { service } = await setupService();
    const forked = await service.fork('custom-user-card', '1.0.0', 'custom-forked-card', '派生卡片', 'Box');
    expect(forked.type).toBe('custom-forked-card');
    expect(forked.currentVersion).toBe('1.0.0');
    const v = await service.getVersion('custom-forked-card', '1.0.0');
    expect(v?.schema.length).toBe(1);
  });

  test('草稿保存/读取/丢弃', async () => {
    const { service } = await setupService();
    await service.saveDraft('custom-user-card', draft([node('n1'), node('n2')]));
    const d = await service.getDraft('custom-user-card');
    expect(d?.schema.length).toBe(2);
    await service.discardDraft('custom-user-card');
    expect(await service.getDraft('custom-user-card')).toBeNull();
  });

  test('旧 v2.0 单文件惰性迁移到目录结构', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lowcode-mv-legacy-'));
    // 写旧格式单文件（含 schema）
    const legacy = { ...baseManifest('custom-legacy'), schema: [node('n1')] };
    await fs.writeFile(path.join(dir, 'custom-legacy.json'), JSON.stringify(legacy), 'utf-8');
    const service = new MaterialVersionService(dir);
    const manifest = await service.getManifest('custom-legacy');
    expect(manifest?.currentVersion).toBe('1.0.0');
    const version = await service.getVersion('custom-legacy', '1.0.0');
    expect(version?.schema.length).toBe(1);
    // 旧文件已迁移删除
    const files = await fs.readdir(dir);
    expect(files).not.toContain('custom-legacy.json');
    expect(files).toContain('custom-legacy');
  });
});

describe('materialVersionValidator', () => {
  test('接受合法版本 draft', () => {
    const parsed = materialVersionValidator.safeParse(draft([node('n1')]));
    expect(parsed.success).toBe(true);
  });
  test('拒绝非法版本号', () => {
    const parsed = materialVersionValidator.safeParse(draft([node('n1')], undefined, { version: 'abc' }));
    expect(parsed.success).toBe(false);
  });
});
