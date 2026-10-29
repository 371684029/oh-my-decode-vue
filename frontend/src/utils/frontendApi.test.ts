import { describe, expect, test } from 'vitest';
import { applyMockBindings, planSchemaSave, renderApiMarkdown } from './frontendApi';
import { applyPatch, createPatch } from './jsonPatch';
import { generateVueSFC } from './codeGenerator';
import type { PageSchema } from '../types/designer';

function schema(): PageSchema {
  return {
    id: 'page_mock',
    title: '订单页',
    type: 'page',
    meta: { author: 'tester', description: '', version: '1.0.0' },
    state: {},
    children: [
      {
        id: 'tbl_1',
        type: 'pro-table',
        label: '高端表格',
        layout: { x: 0, y: 0, w: 12, h: 6, i: 'tbl_1' },
        props: {},
        attrs: {},
        style: {},
        events: {},
        config: {
          columns: [
            { prop: 'id', label: 'ID' },
            { prop: 'name', label: '姓名' }
          ]
        }
      },
      {
        id: 'form_1',
        type: 'pro-form',
        label: '高端表单',
        layout: { x: 0, y: 6, w: 12, h: 5, i: 'form_1' },
        props: {},
        attrs: {},
        style: {},
        events: {},
        config: { items: [{ field: 'username', label: '用户名', component: 'input' }] },
        apiBinding: { url: 'https://api.example.com/profile', method: 'GET', responsePath: 'data' }
      }
    ]
  };
}

describe('一键 Mock 与接口文档', () => {
  test('只补没有地址的表格，已有 URL 保持不变', () => {
    const page = schema();
    const added = applyMockBindings(page);
    expect(added).toEqual(['tbl_1']);
    expect(page.children[0].apiBinding?.url).toBe('/api/mock/tbl_1');
    expect(page.children[0].apiBinding?.responsePath).toBe('data.list');
    expect(page.children[1].apiBinding?.url).toBe('https://api.example.com/profile');
    expect(applyMockBindings(page)).toEqual([]);
  });

  test('文档包含方法、路径和响应示例', () => {
    const page = schema();
    applyMockBindings(page);
    const markdown = renderApiMarkdown(page);
    expect(markdown).toContain('GET');
    expect(markdown).toContain('/api/mock/tbl_1');
    expect(markdown).toContain('https://api.example.com/profile');
    expect(markdown).toContain('"list"');
    expect(markdown).toContain('张三');
  });

  test('出码保留 Mock 地址，不写入 example 标记', () => {
    const page = schema();
    applyMockBindings(page);
    const example = page.children[0].apiBinding?.example as { data: { list: Array<Record<string, string>> } };
    example.data.list[0].secret = 'MOCK_ONLY_TOKEN';
    const vue = generateVueSFC(page);
    expect(vue).toContain('/api/mock/tbl_1');
    expect(vue).not.toContain('MOCK_ONLY_TOKEN');
  });
});

/** 35 节点的大页面，用于增量保存 Payload 对比 */
function bigPage(): PageSchema {
  const children = Array.from({ length: 35 }, (_, i) => ({
    id: `node_${i}`,
    type: 'el-button',
    label: `按钮 ${i}`,
    layout: { x: (i % 4) * 3, y: Math.floor(i / 4) * 2, w: 3, h: 2, i: `node_${i}` },
    props: {},
    attrs: {},
    style: {},
    events: {},
    config: { text: `点击我 ${i}`, size: 'default', description: `第 ${i} 个按钮的说明文案` }
  }));
  return {
    id: 'page_big',
    title: '大页面',
    type: 'page',
    meta: { author: 'tester', description: 'big page for patch payload proof', version: '1.0.0' },
    state: { count: 0 },
    children
  };
}

describe('planSchemaSave 增量保存决策', () => {
  test('从未保存过（无快照）走全量 POST', () => {
    expect(planSchemaSave(null, bigPage())).toEqual({ mode: 'full' });
  });

  test('页面 id 变化（换了载入的页面）走全量 POST', () => {
    const before = bigPage();
    const after = { ...before, id: 'page_other' };
    expect(planSchemaSave(before, after)).toEqual({ mode: 'full' });
  });

  test('大页面单属性改动走 PATCH，payload 至少小 10 倍，且 patch 可还原目标 Schema', () => {
    const before = bigPage();
    const after = bigPage();
    after.children[12].label = '重命名的按钮';

    const plan = planSchemaSave(before, after);
    expect(plan.mode).toBe('patch');
    if (plan.mode !== 'patch') return;

    const patchBytes = JSON.stringify({ ops: plan.ops }).length;
    const fullBytes = JSON.stringify(after).length;
    // v2.4.0 P1-1 验收：大页面自动保存 Payload 下降一个数量级
    expect(patchBytes * 10).toBeLessThanOrEqual(fullBytes);
    // payload 证据：本次度量（供验收报告引用）
    console.info(`[payload-proof] full=${fullBytes}B patch=${patchBytes}B ratio=${(fullBytes / patchBytes).toFixed(1)}x`);

    // 往返：把 patch 应用到旧快照应等于当前 Schema
    expect(applyPatch(before, plan.ops)).toEqual(after);
  });

  test('patch 并不比全量小时回退全量 POST', () => {
    const tiny: PageSchema = {
      id: 'page_tiny',
      title: '页面A',
      type: 'page',
      meta: { author: 'a', description: 'd', version: '1.0.0' },
      state: {},
      children: []
    };
    const next: PageSchema = {
      ...tiny,
      title: '页面B',
      meta: { ...tiny.meta, author: 'a2', description: 'd2' },
      state: { a: 1, b: 2 }
    };
    // 5 个小字段改动：op 开销超过全量本身
    const ops = createPatch(tiny, next);
    expect(ops).toHaveLength(5);
    expect(JSON.stringify(ops).length).toBeGreaterThanOrEqual(JSON.stringify(next).length);
    expect(planSchemaSave(tiny, next)).toEqual({ mode: 'full' });
  });

  test('无改动时跳过保存（不发请求、不递增版本）', () => {
    const page = bigPage();
    const plan = planSchemaSave(page, bigPage());
    expect(plan).toEqual({ mode: 'skip' });
  });
});
