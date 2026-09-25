import { describe, expect, test } from 'vitest';
import { applyMockBindings, renderApiMarkdown } from './frontendApi';
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
