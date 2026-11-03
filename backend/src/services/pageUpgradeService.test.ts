import { describe, expect, test, vi } from 'vitest';
import { upgradeMaterialInstances } from './pageUpgradeService';
import { storageService } from './storageService';
import type { ComponentNode, PageSchema } from '../types/schema';

// 根目录指向临时目录：upgradeMaterialInstances 从 config 取 STORAGE_PAGES_DIR，
// 落盘走 storageService 单例（同样取自 config），两者必须指向同一份临时存储
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const fsp = await import('node:fs/promises');
  const osMod = await import('node:os');
  const pathMod = await import('node:path');
  const root = await fsp.mkdtemp(pathMod.join(osMod.tmpdir(), 'lowcode-upgrade-'));
  const pagesDir = pathMod.join(root, 'pages');
  const componentsDir = pathMod.join(root, 'components');
  const materialsDir = pathMod.join(root, 'materials');
  await fsp.mkdir(pagesDir, { recursive: true });
  await fsp.mkdir(componentsDir, { recursive: true });
  await fsp.mkdir(materialsDir, { recursive: true });
  return {
    ...actual,
    STORAGE_PAGES_DIR: pagesDir,
    STORAGE_COMPONENTS_DIR: componentsDir,
    STORAGE_MATERIALS_DIR: materialsDir
  };
});

const MATERIAL_ID = 'custom-upgrade-target';

function refNode(
  id: string,
  version: string,
  follow?: 'pin' | 'minor' | 'patch'
): ComponentNode {
  return {
    id,
    type: MATERIAL_ID,
    label: '黑盒实例',
    layout: { x: 0, y: 0, w: 4, h: 3, i: id },
    props: {},
    attrs: {},
    style: {},
    events: {},
    materialRef: follow ? { id: MATERIAL_ID, version, follow } : { id: MATERIAL_ID, version }
  };
}

function page(id: string, nodes: ComponentNode[], layers: ComponentNode[] = []): PageSchema {
  return {
    id,
    title: `升级页 ${id}`,
    type: 'page',
    meta: { author: 'tester', description: 'upgrade', version: '1.0.0' },
    state: {},
    children: nodes,
    layers: layers.length
      ? [{ id: `layer_${id}`, type: 'dialog', label: '弹窗', visible: true, zIndex: 10, props: {}, children: layers }]
      : []
  };
}

describe('upgradeMaterialInstances 批量升级（v2.7.0 M2 #8）', () => {
  test('改写命中 fromVersion 的 pin 实例，落盘后读回为 toVersion', async () => {
    const id = 'page_up_pin';
    await storageService.saveSchema(page(id, [refNode('bb_1', '1.0.0'), refNode('bb_2', '1.0.0')]));

    const results = await upgradeMaterialInstances({
      materialId: MATERIAL_ID,
      fromVersion: '1.0.0',
      toVersion: '1.1.0'
    });

    expect(results).toEqual([{ pageId: id, updated: 2 }]);
    const stored = await storageService.getSchema(id);
    expect(stored?.children.map((n) => n.materialRef?.version)).toEqual(['1.1.0', '1.1.0']);
  });

  test('follow 非 pin 的实例跳过不改写（由解析层自动跟随）', async () => {
    const id = 'page_up_follow';
    await storageService.saveSchema(
      page(id, [
        refNode('bb_pin', '1.0.0', 'pin'),
        refNode('bb_minor', '1.0.0', 'minor'),
        refNode('bb_patch', '1.0.0', 'patch')
      ])
    );

    const results = await upgradeMaterialInstances({
      materialId: MATERIAL_ID,
      fromVersion: '1.0.0',
      toVersion: '1.1.0'
    });

    expect(results).toEqual([{ pageId: id, updated: 1 }]);
    const stored = await storageService.getSchema(id);
    const versions = Object.fromEntries((stored?.children ?? []).map((n) => [n.id, n.materialRef?.version]));
    expect(versions).toEqual({ bb_pin: '1.1.0', bb_minor: '1.0.0', bb_patch: '1.0.0' });
  });

  test('非目标 fromVersion 与其它物料 id 一律不动', async () => {
    const id = 'page_up_other';
    await storageService.saveSchema(
      page(id, [
        refNode('bb_newer', '2.0.0'),
        {
          ...refNode('bb_else', '1.0.0'),
          materialRef: { id: 'custom-other-material', version: '1.0.0', follow: 'pin' }
        }
      ])
    );

    const results = await upgradeMaterialInstances({
      materialId: MATERIAL_ID,
      fromVersion: '1.0.0',
      toVersion: '1.1.0'
    });

    // 两个实例都不命中 → 该页不产生结果条目，也不落盘
    expect(results).toEqual([]);
    const stored = await storageService.getSchema(id);
    expect(stored?.children[0].materialRef?.version).toBe('2.0.0');
    expect(stored?.children[1].materialRef?.id).toBe('custom-other-material');
  });

  test('图层内实例同样被改写，计数并入该页', async () => {
    const id = 'page_up_layer';
    await storageService.saveSchema(page(id, [], [refNode('bb_in_layer', '1.0.0')]));

    const results = await upgradeMaterialInstances({
      materialId: MATERIAL_ID,
      fromVersion: '1.0.0',
      toVersion: '1.1.0'
    });

    expect(results).toEqual([{ pageId: id, updated: 1 }]);
    const stored = await storageService.getSchema(id);
    expect(stored?.layers?.[0].children[0].materialRef?.version).toBe('1.1.0');
  });

  test('多页各自计数，无引用页不进入结果', async () => {
    await storageService.saveSchema(page('page_up_a', [refNode('bb_a1', '1.0.0'), refNode('bb_a2', '1.0.0')]));
    await storageService.saveSchema(page('page_up_b', [refNode('bb_b1', '1.0.0')]));
    await storageService.saveSchema(page('page_up_idle', []));

    const results = await upgradeMaterialInstances({
      materialId: MATERIAL_ID,
      fromVersion: '1.0.0',
      toVersion: '1.1.0'
    });

    const byPage = Object.fromEntries(results.map((r) => [r.pageId, r.updated]));
    expect(byPage).toEqual({ page_up_a: 2, page_up_b: 1 });
  });

  test('升级落盘递增页面版本，原内容其余字段不动', async () => {
    const id = 'page_up_version';
    await storageService.saveSchema(page(id, [refNode('bb_1', '1.0.0')]));
    const before = await storageService.getSchema(id);

    await upgradeMaterialInstances({ materialId: MATERIAL_ID, fromVersion: '1.0.0', toVersion: '1.1.0' });

    const after = await storageService.getSchema(id);
    expect(after?.meta.version).not.toBe(before?.meta.version);
    expect(after?.title).toBe(before?.title);
    expect(after?.children[0].label).toBe(before?.children[0].label);
  });
});
