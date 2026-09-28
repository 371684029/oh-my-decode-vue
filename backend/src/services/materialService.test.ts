import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, test } from 'vitest';
import { MaterialService } from './materialService';
import { materialManifestValidator, formatZodErrors } from '../validation/materialValidation';
import type { MaterialManifest } from '../types/schema';

function sampleManifest(type = 'custom-user-card'): MaterialManifest {
  return {
    type,
    label: '用户卡片',
    icon: 'Avatar',
    category: 'pro',
    defaultLayout: { w: 6, h: 4 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    schema: [
      {
        id: 'n1',
        type: 'el-card',
        label: '卡片',
        layout: { x: 0, y: 0, w: 6, h: 4, i: 'n1' },
        props: { header: '标题' },
        attrs: {},
        style: {},
        events: {}
      }
    ],
    summary: ['el-card']
  };
}

function deepNode(id: string, depth: number): any {
  if (depth <= 1) {
    return {
      id,
      type: 'el-card',
      label: '节点',
      layout: { x: 0, y: 0, w: 2, h: 2, i: id },
      props: {},
      attrs: {},
      style: {},
      events: {}
    };
  }
  return {
    id,
    type: 'pro-container',
    label: '容器',
    layout: { x: 0, y: 0, w: 2, h: 2, i: id },
    props: {},
    attrs: {},
    style: {},
    events: {},
    children: [deepNode(`${id}-c`, depth - 1)]
  };
}

describe('materialManifestValidator', () => {
  test('接受合法复合物料', () => {
    expect(materialManifestValidator.safeParse(sampleManifest()).success).toBe(true);
  });

  test('拒绝非 custom- 前缀的 type', () => {
    const parsed = materialManifestValidator.safeParse(sampleManifest('pro-table'));
    expect(parsed.success).toBe(false);
    expect(formatZodErrors(parsed.error!)).toMatch(/custom-/);
  });

  test('拒绝超长 label', () => {
    const parsed = materialManifestValidator.safeParse({ ...sampleManifest(), label: 'x'.repeat(51) });
    expect(parsed.success).toBe(false);
  });

  test('composite 必须有非空 schema', () => {
    const parsed = materialManifestValidator.safeParse({ ...sampleManifest(), schema: [] });
    expect(parsed.success).toBe(false);
    expect(formatZodErrors(parsed.error!)).toMatch(/schema/);
  });

  test('拒绝超过 5 层嵌套', () => {
    const parsed = materialManifestValidator.safeParse({ ...sampleManifest(), schema: [deepNode('r', 6)] });
    expect(parsed.success).toBe(false);
    expect(formatZodErrors(parsed.error!)).toMatch(/depth/);
  });

  test('接受 5 层嵌套', () => {
    const parsed = materialManifestValidator.safeParse({ ...sampleManifest(), schema: [deepNode('r', 5)] });
    expect(parsed.success).toBe(true);
  });

  test('拒绝超过 200 节点', () => {
    const nodes = Array.from({ length: 201 }, (_, i) => ({
      ...sampleManifest().schema![0],
      id: `n${i}`,
      layout: { ...sampleManifest().schema![0].layout, i: `n${i}` }
    }));
    const parsed = materialManifestValidator.safeParse({ ...sampleManifest(), schema: nodes });
    expect(parsed.success).toBe(false);
  });
});

describe('MaterialService 存储', () => {
  test('保存 → 列表 → 读取 roundtrip', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lowcode-materials-'));
    const service = new MaterialService(dir);

    await service.saveMaterial(sampleManifest());
    await service.saveMaterial({ ...sampleManifest('custom-search-bar'), label: '搜索栏' });

    const list = await service.listMaterials();
    expect(list.map((m) => m.type).sort()).toEqual(['custom-search-bar', 'custom-user-card']);

    const got = await service.getMaterial('custom-user-card');
    expect(got?.label).toBe('用户卡片');
    expect(got?.schema?.length).toBe(1);
  });

  test('并发保存同一物料不产生残留临时文件', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lowcode-materials-'));
    const service = new MaterialService(dir);

    await Promise.all([
      service.saveMaterial(sampleManifest()),
      service.saveMaterial({ ...sampleManifest(), label: '并发版本' })
    ]);

    const files = await fs.readdir(dir);
    expect(files.filter((name) => name.includes('.tmp'))).toEqual([]);
    const stored = await service.getMaterial('custom-user-card');
    expect(['用户卡片', '并发版本']).toContain(stored?.label);
  });

  test('删除成功与不存在返回 false', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lowcode-materials-'));
    const service = new MaterialService(dir);
    await service.saveMaterial(sampleManifest());

    expect(await service.deleteMaterial('custom-user-card')).toBe(true);
    expect(await service.deleteMaterial('custom-user-card')).toBe(false);
  });

  test('恶意 type 拒绝写盘', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lowcode-materials-'));
    const service = new MaterialService(dir);
    await expect(service.saveMaterial(sampleManifest('../escaped'))).rejects.toThrow(/Unsafe schema id/);
    await expect(service.saveMaterial(sampleManifest('a/b'))).rejects.toThrow(/Unsafe schema id/);
  });
});
