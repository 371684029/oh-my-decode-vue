import { describe, expect, test } from 'vitest';
import {
  applyPatch,
  buildSaveLogDetails,
  createPatch,
  invertPatch,
  parsePatchOps,
  JsonPatchError,
  type JsonPatchOp
} from './jsonPatch';

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

describe('createPatch 逐下标数组 diff（v2.5.0 #5 统一语义）', () => {
  test('数组尾部追加产出 add 下标，裁剪从高下标起 remove', () => {
    expect(createPatch({ list: [1, 2] }, { list: [1, 2, 3] })).toEqual([{ op: 'add', path: '/list/2', value: 3 }]);
    expect(createPatch({ list: [1, 2, 3] }, { list: [1] })).toEqual([
      { op: 'remove', path: '/list/2' },
      { op: 'remove', path: '/list/1' }
    ]);
  });

  test('数组中段值变化产出细粒度 replace，不做整组替换', () => {
    expect(createPatch({ rows: [{ label: '旧' }, { label: 'b' }] }, { rows: [{ label: '新' }, { label: 'b' }] })).toEqual(
      [{ op: 'replace', path: '/rows/0/label', value: '新' }]
    );
  });

  test('对象字段增删照常产出 add / remove', () => {
    expect(createPatch({ a: 1 }, { a: 1, b: 2 })).toEqual([{ op: 'add', path: '/b', value: 2 }]);
    expect(createPatch({ a: 1, b: 2 }, { a: 1 })).toEqual([{ op: 'remove', path: '/b' }]);
  });
});

describe('invertPatch 撤销翻转（apply(apply(before, ops), inverse) ≅ before）', () => {
  const before = {
    title: '旧',
    list: [1, 2],
    rows: [{ label: 'a' }],
    keep: '不动'
  };

  test('混合 ops（对象增删改 + 数组尾部增裁）往返还原', () => {
    const ops: JsonPatchOp[] = [
      { op: 'replace', path: '/title', value: '新' },
      { op: 'add', path: '/list/2', value: 3 },
      { op: 'remove', path: '/list/0' },
      { op: 'add', path: '/extra', value: true },
      { op: 'replace', path: '/rows/0/label', value: 'z' }
    ];
    const after = applyPatch(before, ops);
    const inverse = invertPatch(before, ops);
    expect(applyPatch(after, inverse)).toEqual(before);
  });

  test('add 覆盖已存在的键 → 反向是恢复旧值的 replace', () => {
    const ops: JsonPatchOp[] = [{ op: 'add', path: '/title', value: '覆盖' }];
    const inverse = invertPatch(before, ops);
    expect(inverse).toEqual([{ op: 'replace', path: '/title', value: '旧' }]);
    expect(applyPatch(applyPatch(before, ops), inverse)).toEqual(before);
  });

  test('数组 - 尾部追加 → 反向是显式下标 remove', () => {
    const ops: JsonPatchOp[] = [{ op: 'add', path: '/list/-', value: 9 }];
    const inverse = invertPatch(before, ops);
    expect(inverse).toEqual([{ op: 'remove', path: '/list/2' }]);
    expect(applyPatch(applyPatch(before, ops), inverse)).toEqual(before);
  });
});
