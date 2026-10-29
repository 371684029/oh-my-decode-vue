import { describe, expect, test, vi } from 'vitest';
import { saveSchemaWithFallback, type SaveDeps } from './schemaSave';
import type { PageSchema } from '../types/designer';

function page(id: string, label: string, version = '1.0.0'): PageSchema {
  return {
    id,
    title: '保存编排页',
    type: 'page',
    meta: { author: 'tester', description: 'schemaSave', version },
    state: {},
    children: [
      {
        id: 'btn_1',
        type: 'el-button',
        label,
        layout: { x: 0, y: 0, w: 4, h: 2, i: 'btn_1' },
        props: {},
        attrs: {},
        style: {},
        events: {}
      }
    ],
    layers: []
  };
}

function depsOf(over: Partial<SaveDeps> = {}): SaveDeps & { post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> } {
  return {
    post: vi.fn(async () => ({ version: '1.0.1' })),
    patch: vi.fn(async () => ({ version: '1.0.1' })),
    ...over
  } as SaveDeps & { post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };
}

describe('saveSchemaWithFallback（自测修复 #2/#3/#4）', () => {
  test('#4 无变更时跳过保存：两个请求都不发，基线保持不变', async () => {
    const saved = page('p1', '按钮');
    const deps = depsOf();
    const result = await saveSchemaWithFallback(page('p1', '按钮'), saved, deps);
    expect(result.mode).toBe('skip');
    expect(deps.patch).not.toHaveBeenCalled();
    expect(deps.post).not.toHaveBeenCalled();
    expect(result.baseline).toEqual(saved);
  });

  test('有变更走 PATCH：携带 baseVersion，基线为提交内容 + 服务端版本回填', async () => {
    const saved = page('p1', '按钮', '1.0.3');
    const submitted = page('p1', '改过的按钮', '1.0.3');
    const deps = depsOf({ patch: vi.fn(async () => ({ version: '1.0.4' })) });
    const result = await saveSchemaWithFallback(submitted, saved, deps);
    expect(result.mode).toBe('patch');
    expect(deps.patch).toHaveBeenCalledWith('p1', expect.any(Array), '1.0.3');
    expect(result.baseline.children[0].label).toBe('改过的按钮');
    expect(result.baseline.meta.version).toBe('1.0.4');
    expect(result.baseline.meta.prevVersion).toBe('1.0.3');
  });

  test('#2 基线是提交快照的深拷贝：提交对象事后被改写不影响基线', async () => {
    const saved = page('p1', '按钮');
    const submitted = page('p1', '改过的按钮');
    const deps = depsOf();
    const result = await saveSchemaWithFallback(submitted, saved, deps);
    // 模拟请求在途期间页面继续被编辑（旧实现正是把这类改动吸收进基线）
    submitted.children[0].label = '在途期间又改了';
    submitted.meta.version = '9.9.9';
    expect(result.baseline.children[0].label).toBe('改过的按钮');
    expect(result.baseline.meta.version).toBe('1.0.1');
  });

  test('#3 PATCH 409 版本冲突 → 回退全量 POST', async () => {
    const saved = page('p1', '按钮', '1.0.3');
    const submitted = page('p1', '改过的按钮', '1.0.3');
    const conflict = Object.assign(new Error('conflict'), {
      response: { status: 409, data: { code: 'VERSION_CONFLICT' } }
    });
    const deps = depsOf({ patch: vi.fn(async () => Promise.reject(conflict)) });
    const result = await saveSchemaWithFallback(submitted, saved, deps);
    expect(result.mode).toBe('full');
    expect(deps.post).toHaveBeenCalledTimes(1);
    expect(result.baseline.meta.version).toBe('1.0.1');
  });

  test('PATCH 其他失败同样只回退全量一次', async () => {
    const saved = page('p1', '按钮');
    const submitted = page('p1', '改过的按钮');
    const deps = depsOf({ patch: vi.fn(async () => Promise.reject(new Error('network down'))) });
    const result = await saveSchemaWithFallback(submitted, saved, deps);
    expect(result.mode).toBe('full');
    expect(deps.post).toHaveBeenCalledTimes(1);
  });

  test('从未保存过（无基线）直接全量 POST', async () => {
    const submitted = page('p_new', '按钮');
    const deps = depsOf({ post: vi.fn(async () => ({ version: '1.0.0' })) });
    const result = await saveSchemaWithFallback(submitted, null, deps);
    expect(result.mode).toBe('full');
    expect(deps.patch).not.toHaveBeenCalled();
    expect(result.baseline.meta.version).toBe('1.0.0');
  });
});
