import { describe, expect, test } from 'vitest';
import { buildSaveLogDetails } from './jsonPatch';

describe('buildSaveLogDetails', () => {
  test('第二次保存带上 patch', () => {
    const previous = { title: '旧标题', meta: { version: '1.0.0' } };
    const saved = { title: '新标题', meta: { version: '1.0.1' } };
    const details = buildSaveLogDetails({
      title: '新标题',
      nodeCount: 1,
      version: '1.0.1',
      prevVersion: '1.0.0',
      previous,
      saved
    });
    expect(details.initial).toBe(false);
    expect(details.patch).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'replace', path: '/title', value: '新标题' })])
    );
  });

  test('首次保存不叫 diff', () => {
    const details = buildSaveLogDetails({
      title: '第一版',
      nodeCount: 0,
      version: '1.0.0',
      previous: null,
      saved: { title: '第一版' }
    });
    expect(details.initial).toBe(true);
    expect(details.patch).toBeUndefined();
  });
});
