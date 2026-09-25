import { describe, expect, test } from 'vitest';
import { buildCorpus, mergeCorpusSchemas, renderCorpusJsonl } from './corpus';
import type { PageSchema } from '../types/designer';

function page(id: string, title: string): PageSchema {
  return {
    id,
    title,
    type: 'page',
    meta: { author: 'tester', description: '', version: '1.0.0' },
    state: {},
    children: []
  };
}

describe('语料库', () => {
  test('一页同时产出 Vue 组件和 HTML 组件', () => {
    const entries = buildCorpus([page('page_order', '订单页')]);
    expect(entries.map((entry) => entry.kind)).toEqual(['vue', 'html']);
    expect(entries[0].filename).toBe('page-order.vue');
    expect(entries[0].source).toContain('<template>');
    expect(entries[1].filename).toBe('page-order.html');
    expect(entries[1].source).toContain('<!DOCTYPE html>');
    const jsonl = renderCorpusJsonl(entries);
    expect(jsonl).toContain('"kind":"vue"');
    expect(jsonl).toContain('"kind":"html"');
    expect(jsonl.endsWith('\n')).toBe(true);
  });

  test('同一 id 以最后一份 Schema 为准', () => {
    const merged = mergeCorpusSchemas([page('page_a', '旧标题'), page('page_a', '新标题'), page('page_b', '另一页')]);
    expect(merged.map((item) => item.title)).toEqual(['新标题', '另一页']);
    expect(buildCorpus(merged)).toHaveLength(4);
  });
});
