import { describe, expect, test } from 'vitest';
import { generateVueSFC } from './codeGenerator';
import { applyStateEntry } from './pageState';
import type { PageSchema } from '../types/designer';

describe('页面状态', () => {
  test('合法键写入 schema，禁止键被拒绝，其它键保留', () => {
    const state: Record<string, unknown> = { page: 1 };
    expect(applyStateEntry(state, '', 'show', 'false')).toBeNull();
    expect(state).toEqual({ page: 1, show: false });
    expect(applyStateEntry(state, '', '__proto__', '{"polluted":true}')).toMatch(/保留字/);
    expect(state).toEqual({ page: 1, show: false });
    expect(applyStateEntry(state, 'show', 'show', 'tru')).toMatch(/JSON/);
    expect(state.show).toBe(false);
  });

  test('初始值出现在出码 reactive 里', () => {
    const schema: PageSchema = {
      id: 'page_state',
      title: '状态页',
      type: 'page',
      meta: { author: 'tester', description: 'unit', version: '1.0.0' },
      state: { show: false, page: 1 },
      children: [],
      layers: []
    };
    const code = generateVueSFC(schema);
    expect(code).toContain('"show": false');
  });
});
