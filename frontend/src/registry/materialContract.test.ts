import { describe, expect, test } from 'vitest';
import { missingRequiredFields } from './materialContract';

describe('missingRequiredFields', () => {
  test('删空 columns 时提示列定义', () => {
    const missing = missingRequiredFields({
      type: 'pro-table',
      props: {},
      config: { columns: [] }
    });
    expect(missing.map((field) => field.label)).toEqual(['列定义']);
  });

  test('补回列定义后没有警告', () => {
    const missing = missingRequiredFields({
      type: 'pro-table',
      props: {},
      config: { columns: [{ prop: 'id', label: 'ID' }] }
    });
    expect(missing).toEqual([]);
  });
});
