import { describe, expect, test } from 'vitest';
import { applyPatch, buildSaveLogDetails, parsePatchOps, JsonPatchError } from './jsonPatch';

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

  test('增量保存时 incomingOps 记入审计 details', () => {
    const details = buildSaveLogDetails({
      title: '新标题',
      nodeCount: 1,
      version: '1.0.1',
      previous: { title: '旧标题' },
      saved: { title: '新标题' },
      incomingOps: [{ op: 'replace', path: '/title', value: '新标题' }]
    });
    expect(details.incomingOps).toEqual([{ op: 'replace', path: '/title', value: '新标题' }]);
  });
});

describe('applyPatch（RFC 6902 子集）', () => {
  test('replace / add / remove 按序应用到深拷贝，原文档不动', () => {
    const doc = {
      title: 'A',
      children: [
        { id: 'n1', label: '旧' },
        { id: 'n2', label: '待删' }
      ],
      state: { flag: true }
    };
    const next = applyPatch(doc, [
      { op: 'replace', path: '/title', value: 'B' },
      { op: 'replace', path: '/children/0/label', value: '新' },
      { op: 'remove', path: '/children/1' },
      { op: 'add', path: '/children/1', value: { id: 'n3', label: '追加' } },
      { op: 'add', path: '/state/added', value: 1 }
    ]);
    expect(next).toEqual({
      title: 'B',
      children: [
        { id: 'n1', label: '新' },
        { id: 'n3', label: '追加' }
      ],
      state: { flag: true, added: 1 }
    });
    expect(doc.title).toBe('A');
    expect(doc.children).toHaveLength(2);
  });

  test('转义 token 与 "-" 尾部追加', () => {
    const doc: Record<string, unknown> = { 'a/b~c': 1, list: [1, 2] };
    const next = applyPatch(doc, [
      { op: 'replace', path: '/a~1b~0c', value: 9 },
      { op: 'add', path: '/list/-', value: 3 }
    ]);
    expect(next).toEqual({ 'a/b~c': 9, list: [1, 2, 3] });
  });

  test('路径缺失 / 目标不存在 / 非法下标抛 JsonPatchError', () => {
    const doc = { a: { b: 1 }, list: [1] };
    expect(() => applyPatch(doc, [{ op: 'replace', path: '/a/c', value: 2 }])).toThrow(JsonPatchError);
    expect(() => applyPatch(doc, [{ op: 'replace', path: '/list/5', value: 2 }])).toThrow(JsonPatchError);
    expect(() => applyPatch(doc, [{ op: 'remove', path: '/missing' }])).toThrow(JsonPatchError);
    expect(() => applyPatch(doc, [{ op: 'replace', path: 'no-slash', value: 1 }])).toThrow(JsonPatchError);
    expect(() => applyPatch(doc, [{ op: 'replace', path: '/list/x', value: 1 }])).toThrow(JsonPatchError);
  });
});

describe('parsePatchOps', () => {
  test('接受合法 ops', () => {
    expect(parsePatchOps([{ op: 'remove', path: '/x' }])).toEqual([{ op: 'remove', path: '/x' }]);
    expect(parsePatchOps([{ op: 'replace', path: '/x', value: 1 }])).toHaveLength(1);
    expect(parsePatchOps([])).toEqual([]);
  });

  test('拒绝缺 path / 非法 op / add 缺 value / 非数组', () => {
    expect(() => parsePatchOps([{ op: 'replace', value: 1 }])).toThrow(JsonPatchError);
    expect(() => parsePatchOps([{ op: 'move', path: '/x' }])).toThrow(JsonPatchError);
    expect(() => parsePatchOps([{ op: 'add', path: '/x' }])).toThrow(JsonPatchError);
    expect(() => parsePatchOps([{ op: 'remove', path: '' }])).toThrow(JsonPatchError);
    expect(() => parsePatchOps({ ops: [] })).toThrow(JsonPatchError);
    expect(() => parsePatchOps('nope')).toThrow(JsonPatchError);
    expect(() => parsePatchOps(undefined)).toThrow(JsonPatchError);
  });
});
