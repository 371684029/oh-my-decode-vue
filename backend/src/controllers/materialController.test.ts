import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Request, Response } from 'express';
import { materialController } from './materialController';
import { storageService } from '../services/storageService';
import { materialVersionService } from '../services/materialVersionService';
import { logDatabase } from '../db/sqlite';
import type { ComponentNode, MaterialManifest, PageSchema } from '../types/schema';

// SQLite 审计：捕获 addLog 调用，不落真实库
vi.mock('../db/sqlite', () => ({
  logDatabase: {
    addLog: vi.fn(),
    getLogsByPageId: vi.fn(() => []),
    getAllLogs: vi.fn(() => [])
  }
}));

// 根目录指向临时目录：materialRefScan / storageService / materialService / materialVersionService 都从 config 取根路径
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const fsp = await import('node:fs/promises');
  const osMod = await import('node:os');
  const pathMod = await import('node:path');
  const root = await fsp.mkdtemp(pathMod.join(osMod.tmpdir(), 'lowcode-matctl-'));
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

/** 每个用例独立物料 id：临时目录在文件内共享，避免用例间引用计数互相污染 */
let seq = 0;
function uniqueMaterial(tag: string): string {
  seq += 1;
  return `custom-ref-${tag}-${seq}`;
}

function blackboxNode(id: string, materialId: string, version: string): ComponentNode {
  return {
    id,
    type: materialId,
    label: '黑盒实例',
    layout: { x: 0, y: 0, w: 4, h: 3, i: id },
    props: {},
    attrs: {},
    style: {},
    events: {},
    materialRef: { id: materialId, version, follow: 'pin' }
  };
}

function sampleManifest(type: string): MaterialManifest {
  return {
    type,
    label: '黑盒物料',
    icon: 'Box',
    category: 'pro',
    defaultLayout: { w: 4, h: 3 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    schema: [blackboxNode('seed_1', type, '1.0.0')],
    summary: ['el-button']
  };
}

/** 引用某物料的最小合法页面 */
function pageWithRef(id: string, materialId: string, version = '1.0.0'): PageSchema {
  return {
    id,
    title: `引用页 ${id}`,
    type: 'page',
    meta: { author: 'tester', description: 'refs', version: '1.0.0' },
    state: {},
    children: [blackboxNode(`bb_${id}`, materialId, version)],
    layers: []
  };
}

function createReq(input: {
  body?: unknown;
  params: Record<string, string>;
  query?: Record<string, string>;
}): Request {
  return {
    body: input.body ?? {},
    params: input.params,
    query: input.query ?? {},
    headers: {}
  } as unknown as Request;
}

function createRes(): Response & { statusCode: number; body: { success: boolean; data?: unknown; message?: string } } {
  const res = {
    statusCode: 200,
    body: undefined as unknown as { success: boolean; data?: unknown; message?: string },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload as { success: boolean; data?: unknown; message?: string };
      return res;
    }
  };
  return res as unknown as Response & {
    statusCode: number;
    body: { success: boolean; data?: unknown; message?: string };
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('materialController 引用门禁（refs 409 / force）', () => {
  test('删除被引用物料（无 force）返回 409，附引用计数与引用页面清单', async () => {
    const MATERIAL_ID = uniqueMaterial('delete');
    await materialVersionService.registerWithVersion(sampleManifest(MATERIAL_ID), '1.0.0');
    await storageService.saveSchema(pageWithRef('page_ref_delete', MATERIAL_ID));

    const res = createRes();
    await materialController.deleteMaterial(createReq({ params: { id: MATERIAL_ID } }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    const refs = (res.body.data as { refs: { count: number; pages: Array<{ id: string; count: number }> } }).refs;
    expect(refs.count).toBe(1);
    expect(refs.pages).toHaveLength(1);
    expect(refs.pages[0]).toMatchObject({ id: 'page_ref_delete', count: 1 });
    // 门禁拦截：物料仍在，实例不会变占位
    await expect(materialVersionService.getManifest(MATERIAL_ID)).resolves.toBeTruthy();
    expect(vi.mocked(logDatabase.addLog)).not.toHaveBeenCalled();
  });

  test('归档被引用版本（无 force）返回 409，即使实例锁定的是该版本也拦截', async () => {
    const MATERIAL_ID = uniqueMaterial('archive');
    await materialVersionService.registerWithVersion(sampleManifest(MATERIAL_ID), '1.0.0');
    await storageService.saveSchema(pageWithRef('page_ref_archive', MATERIAL_ID, '1.0.0'));

    const res = createRes();
    await materialController.archiveVersion(
      createReq({ params: { id: MATERIAL_ID, v: '1.0.0' } }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('版本 1.0.0 被引用');
    // 版本仍可读取，未被归档
    await expect(materialVersionService.getVersion(MATERIAL_ID, '1.0.0')).resolves.toBeTruthy();
    expect(vi.mocked(logDatabase.addLog)).not.toHaveBeenCalled();
  });

  test('跨多页面的多实例累计计数：409 里的 refs.count 与 pages 明细一致', async () => {
    const MATERIAL_ID = uniqueMaterial('multi');
    await materialVersionService.registerWithVersion(sampleManifest(MATERIAL_ID), '1.0.0');
    await storageService.saveSchema(pageWithRef('page_refs_a', MATERIAL_ID));
    await storageService.saveSchema(pageWithRef('page_refs_b', MATERIAL_ID));

    const res = createRes();
    await materialController.deleteMaterial(createReq({ params: { id: MATERIAL_ID } }), res);

    expect(res.statusCode).toBe(409);
    const refs = (res.body.data as { refs: { count: number; pages: Array<{ id: string; count: number }> } }).refs;
    expect(refs.count).toBe(2);
    expect(refs.pages).toHaveLength(2);
    expect(refs.pages.map((p) => p.id).sort()).toEqual(['page_refs_a', 'page_refs_b']);
  });

  test('force=true 绕过引用门禁，删除成功并记审计（含 refCount）', async () => {
    const MATERIAL_ID = uniqueMaterial('force');
    await materialVersionService.registerWithVersion(sampleManifest(MATERIAL_ID), '1.0.0');
    await storageService.saveSchema(pageWithRef('page_ref_force', MATERIAL_ID));

    const res = createRes();
    await materialController.deleteMaterial(
      createReq({ params: { id: MATERIAL_ID }, query: { force: 'true' } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    await expect(materialVersionService.getManifest(MATERIAL_ID)).resolves.toBeNull();
    expect(vi.mocked(logDatabase.addLog)).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(logDatabase.addLog).mock.calls[0][0] as {
      action: string;
      details?: string;
    };
    expect(entry.action).toBe('DELETE_MATERIAL');
    expect(JSON.parse(entry.details ?? '{}')).toMatchObject({ type: 'material', refCount: 1 });
    // 引用页面本身不受影响
    await expect(storageService.getSchema('page_ref_force')).resolves.toBeTruthy();
  });

  test('无引用时删除直接成功，不需 force，审计 refCount 为 0', async () => {
    const MATERIAL_ID = uniqueMaterial('clean');
    await materialVersionService.registerWithVersion(sampleManifest(MATERIAL_ID), '1.0.0');

    const res = createRes();
    await materialController.deleteMaterial(createReq({ params: { id: MATERIAL_ID } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    await expect(materialVersionService.getManifest(MATERIAL_ID)).resolves.toBeNull();
    const entry = vi.mocked(logDatabase.addLog).mock.calls[0][0] as { details?: string };
    expect(JSON.parse(entry.details ?? '{}')).toMatchObject({ refCount: 0 });
  });

  test('GET refs 返回扫描结果：未引用时 count 为 0 且 pages 为空', async () => {
    const MATERIAL_ID = uniqueMaterial('probe');
    await materialVersionService.registerWithVersion(sampleManifest(MATERIAL_ID), '1.0.0');
    await storageService.saveSchema(pageWithRef('page_refs_probe', MATERIAL_ID));

    const empty = createRes();
    await materialController.getRefs(createReq({ params: { id: 'custom-never-used' } }), empty);
    expect(empty.statusCode).toBe(200);
    expect(empty.body.data).toEqual({ count: 0, pages: [] });

    const hit = createRes();
    await materialController.getRefs(createReq({ params: { id: MATERIAL_ID } }), hit);
    expect(hit.statusCode).toBe(200);
    expect(hit.body.data).toMatchObject({ count: 1, pages: [{ id: 'page_refs_probe', count: 1 }] });
  });

  test('引用扫描含图层内节点：弹窗里的黑盒实例同样计入门禁', async () => {
    const MATERIAL_ID = uniqueMaterial('layer');
    await materialVersionService.registerWithVersion(sampleManifest(MATERIAL_ID), '1.0.0');
    const page = pageWithRef('page_refs_layer', MATERIAL_ID);
    // 主画布不引用，引用实例放在弹窗图层内
    page.children = [];
    page.layers = [
      {
        id: 'layer_dialog_1',
        type: 'dialog',
        label: '弹窗',
        visible: true,
        zIndex: 10,
        props: {},
        children: [blackboxNode('bb_in_layer', MATERIAL_ID, '1.0.0')]
      }
    ];
    await storageService.saveSchema(page);

    const res = createRes();
    await materialController.deleteMaterial(createReq({ params: { id: MATERIAL_ID } }), res);

    expect(res.statusCode).toBe(409);
    const refs = (res.body.data as { refs: { count: number; pages: Array<{ id: string }> } }).refs;
    expect(refs.count).toBe(1);
    expect(refs.pages[0].id).toBe('page_refs_layer');
  });
});
