import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Request, Response } from 'express';
import { parseRestoreIndex } from '../utils/restoreIndex';
import { schemaController } from './schemaController';
import { storageService } from '../services/storageService';
import { logDatabase } from '../db/sqlite';
import { applyPatch } from '../utils/jsonPatch';
import type { OperationLog, PageSchema } from '../types/schema';

// SQLite 审计：捕获 addLog 调用，不落真实库
vi.mock('../db/sqlite', () => ({
  logDatabase: {
    addLog: vi.fn(),
    getLogsByPageId: vi.fn(() => []),
    getAllLogs: vi.fn(() => [])
  }
}));

// 真实 StorageService + 临时目录，验证落盘/往返/不破坏已存文件
vi.mock('../services/storageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/storageService')>();
  const fsp = await import('node:fs/promises');
  const osMod = await import('node:os');
  const pathMod = await import('node:path');
  const root = await fsp.mkdtemp(pathMod.join(osMod.tmpdir(), 'lowcode-patch-'));
  const pagesDir = pathMod.join(root, 'pages');
  const componentsDir = pathMod.join(root, 'components');
  await fsp.mkdir(pagesDir, { recursive: true });
  await fsp.mkdir(componentsDir, { recursive: true });
  return { ...actual, storageService: new actual.StorageService(pagesDir, componentsDir) };
});

function samplePage(id: string): PageSchema {
  return {
    id,
    title: '补丁页',
    type: 'page',
    meta: { author: 'tester', description: 'patch', version: '1.0.0' },
    state: { legacy: 'keep' },
    children: [
      {
        id: 'btn_1',
        type: 'el-button',
        label: '旧按钮',
        layout: { x: 0, y: 0, w: 4, h: 2, i: 'btn_1' },
        props: {},
        attrs: {},
        style: {},
        events: {},
        config: { text: '旧文案' }
      }
    ],
    layers: []
  };
}

function createReq(body: unknown, id: string): Request {
  return { body, params: { id }, query: {}, headers: {} } as unknown as Request;
}

function createRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    }
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseRestoreIndex', () => {
  test('接受 index，也兼容 backup', () => {
    expect(parseRestoreIndex({ index: 2 }, {})).toBe(2);
    expect(parseRestoreIndex({ backup: 3 }, {})).toBe(3);
    expect(parseRestoreIndex({}, { index: '4' })).toBe(4);
    expect(parseRestoreIndex({}, {})).toBe(1);
    expect(parseRestoreIndex({ index: 0 }, {})).toBe(1);
  });
});

describe('patchSchema（PATCH /api/schemas/:id）', () => {
  test('应用 patch 并持久化，版本照常递增', async () => {
    await storageService.saveSchema(samplePage('page_patch_ok'));
    const res = createRes();
    await schemaController.patchSchema(
      createReq({ ops: [{ op: 'replace', path: '/children/0/label', value: '新按钮' }] }, 'page_patch_ok'),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { id: 'page_patch_ok', version: '1.0.1' } });
    const stored = await storageService.getSchema('page_patch_ok');
    expect(stored?.children[0].label).toBe('新按钮');
    expect(stored?.children[0].config?.text).toBe('旧文案');
    expect(stored?.meta.version).toBe('1.0.1');
    expect(stored?.meta.prevVersion).toBe('1.0.0');
  });

  test('保存 → 载入往返一致：落盘内容逐字段等于 patch 结果（仅 meta 版本照常递增）', async () => {
    const before = samplePage('page_patch_roundtrip');
    await storageService.saveSchema(before);
    const ops = [
      { op: 'replace' as const, path: '/title', value: '往返页' },
      { op: 'remove' as const, path: '/state/legacy' },
      { op: 'add' as const, path: '/state/extra', value: 42 },
      {
        op: 'add' as const,
        path: '/children/1',
        value: {
          id: 'btn_2',
          type: 'el-button',
          label: '第二个',
          layout: { x: 4, y: 0, w: 4, h: 2, i: 'btn_2' },
          props: {},
          attrs: {},
          style: {},
          events: {}
        }
      }
    ];
    const res = createRes();
    await schemaController.patchSchema(createReq({ ops }, 'page_patch_roundtrip'), res);
    expect(res.statusCode).toBe(200);

    const expected = applyPatch(before, ops);
    expected.meta = { ...expected.meta, prevVersion: '1.0.0', version: '1.0.1' };
    const stored = await storageService.getSchema('page_patch_roundtrip');
    expect(stored).toEqual(expected);
  });

  test('无效 patch（缺 path）返回 400，不破坏已存 schema，不写审计', async () => {
    const id = 'page_patch_invalid';
    await storageService.saveSchema(samplePage(id));
    const before = await storageService.getSchema(id);
    const res = createRes();
    await schemaController.patchSchema(createReq({ ops: [{ op: 'replace', value: 'x' }] }, id), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false });
    await expect(storageService.getSchema(id)).resolves.toEqual(before);
    expect(vi.mocked(logDatabase.addLog)).not.toHaveBeenCalled();
  });

  test('body 不是 { ops: [...] } 返回 400', async () => {
    const id = 'page_patch_badbody';
    await storageService.saveSchema(samplePage(id));
    const missingOps = createRes();
    await schemaController.patchSchema(createReq({ nope: true }, id), missingOps);
    expect(missingOps.statusCode).toBe(400);
    const notArray = createRes();
    await schemaController.patchSchema(createReq({ ops: 'not-array' }, id), notArray);
    expect(notArray.statusCode).toBe(400);
    expect(vi.mocked(logDatabase.addLog)).not.toHaveBeenCalled();
  });

  test('patch 路径不存在返回 400，不写审计', async () => {
    const id = 'page_patch_badpath';
    await storageService.saveSchema(samplePage(id));
    const before = await storageService.getSchema(id);
    const res = createRes();
    await schemaController.patchSchema(createReq({ ops: [{ op: 'replace', path: '/nope/deep', value: 1 }] }, id), res);
    expect(res.statusCode).toBe(400);
    await expect(storageService.getSchema(id)).resolves.toEqual(before);
    expect(vi.mocked(logDatabase.addLog)).not.toHaveBeenCalled();
  });

  test('patch 结果未通过 Zod 校验返回 400 且不落盘', async () => {
    const id = 'page_patch_invalidschema';
    await storageService.saveSchema(samplePage(id));
    const before = await storageService.getSchema(id);
    const res = createRes();
    await schemaController.patchSchema(
      createReq({ ops: [{ op: 'replace', path: '/children/0/id', value: '../evil' }] }, id),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(String((res.body as { message: string }).message)).toContain('Schema validation failed');
    await expect(storageService.getSchema(id)).resolves.toEqual(before);
    expect(vi.mocked(logDatabase.addLog)).not.toHaveBeenCalled();
  });

  test('不存在的页面返回 404', async () => {
    const res = createRes();
    await schemaController.patchSchema(
      createReq({ ops: [{ op: 'replace', path: '/title', value: 'x' }] }, 'page_missing_xyz'),
      res
    );
    expect(res.statusCode).toBe(404);
  });

  test('patch 不允许改写 id / type', async () => {
    const id = 'page_patch_identity';
    await storageService.saveSchema(samplePage(id));
    const res = createRes();
    await schemaController.patchSchema(createReq({ ops: [{ op: 'replace', path: '/id', value: 'page_hijack' }] }, id), res);
    expect(res.statusCode).toBe(400);
    const stored = await storageService.getSchema(id);
    expect(stored?.id).toBe(id);
    await expect(storageService.getSchema('page_hijack')).resolves.toBeNull();
  });

  test('审计日志记录可读 JSON Patch 差异与客户端提交的 ops', async () => {
    const id = 'page_patch_audit';
    await storageService.saveSchema(samplePage(id));
    const ops = [
      { op: 'replace' as const, path: '/children/0/label', value: '审计按钮' },
      { op: 'replace' as const, path: '/title', value: '审计标题' }
    ];
    const res = createRes();
    await schemaController.patchSchema(createReq({ ops }, id), res);
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(logDatabase.addLog)).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(logDatabase.addLog).mock.calls[0][0] as OperationLog;
    expect(entry.action).toBe('PATCH_SCHEMA');
    expect(entry.page_id).toBe(id);
    const details = JSON.parse(entry.details ?? '{}') as {
      initial: boolean;
      patch: Array<Record<string, unknown>>;
      incomingOps: unknown;
    };
    expect(details.initial).toBe(false);
    // 统一后的逐下标 diff：标题与行 label 各自一条细粒度 replace，逐项可读
    expect(details.patch).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'replace', path: '/title', value: '审计标题' })])
    );
    expect(details.patch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'replace', path: '/children/0/label', value: '审计按钮' })
      ])
    );
    expect(details.incomingOps).toEqual(ops);
  });

  test('#3 baseVersion 与已存版本不符返回 409，不落盘不写审计', async () => {
    const id = 'page_patch_conflict';
    await storageService.saveSchema(samplePage(id));
    const res = createRes();
    await schemaController.patchSchema(
      createReq(
        { ops: [{ op: 'replace', path: '/children/0/label', value: '新按钮' }], baseVersion: '0.9.0' },
        id
      ),
      res
    );
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'VERSION_CONFLICT' });
    const stored = await storageService.getSchema(id);
    expect(stored?.children[0].label).toBe('旧按钮');
    expect(stored?.meta.version).toBe('1.0.0');
    expect(vi.mocked(logDatabase.addLog)).not.toHaveBeenCalled();
  });

  test('baseVersion 匹配时照常应用并递增版本', async () => {
    const id = 'page_patch_base_ok';
    await storageService.saveSchema(samplePage(id));
    const res = createRes();
    await schemaController.patchSchema(
      createReq(
        { ops: [{ op: 'replace', path: '/children/0/label', value: '新按钮' }], baseVersion: '1.0.0' },
        id
      ),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { id, version: '1.0.1' } });
  });

  test('#4 空 ops 为无变更：不递增版本、不轮转备份、不写审计', async () => {
    const id = 'page_patch_empty';
    await storageService.saveSchema(samplePage(id));
    const res = createRes();
    await schemaController.patchSchema(createReq({ ops: [] }, id), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, unchanged: true, data: { id, version: '1.0.0' } });
    const stored = await storageService.getSchema(id);
    expect(stored?.meta.version).toBe('1.0.0');
    expect(stored?.meta.prevVersion).toBeUndefined();
    expect(vi.mocked(logDatabase.addLog)).not.toHaveBeenCalled();
  });
});