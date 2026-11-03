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

describe('applyPatch 边界语义（v2.7.0 M2 #5）', () => {
  test('根路径 "" 的 add / replace 整文档替换，返回值与入参解耦', () => {
    const value = { nested: { n: 1 }, list: [1] };
    const replaced = applyPatch({ a: 1 } as unknown, [{ op: 'replace', path: '', value } as JsonPatchOp]);
    expect(replaced).toEqual(value);
    const added = applyPatch({ a: 1 } as unknown, [{ op: 'add', path: '', value: [1, 2] } as JsonPatchOp]);
    expect(added).toEqual([1, 2]);

    // 深拷贝：改写返回值不回渗 op.value
    (replaced as { nested: { n: number } }).nested.n = 99;
    expect(value.nested.n).toBe(1);
    expect(replaced).not.toBe(value);
  });

  test('根路径 "" 的 remove 无意义，拒绝整文档删除', () => {
    expect(() => applyPatch({ a: 1 } as unknown, [{ op: 'remove', path: '' } as JsonPatchOp])).toThrow(
      /Cannot remove the whole document/
    );
  });

  test('空 ops 返回深拷贝且不复用引用', () => {
    const doc = { a: 1, nested: { b: 2 } };
    const empty = applyPatch(doc, []);
    expect(empty).toEqual(doc);
    expect(empty).not.toBe(doc);
    (empty as typeof doc).nested.b = 99;
    expect(doc.nested.b).toBe(2);
  });

  test('末段落到标量：目标不是容器', () => {
    expect(() => applyPatch({ a: 5 }, [{ op: 'replace', path: '/a/b', value: 1 }])).toThrow(
      /Patch target is not a container: \/a\/b/
    );
    expect(() => applyPatch({ s: 'text' }, [{ op: 'add', path: '/s/x', value: 1 }])).toThrow(
      /Patch target is not a container/
    );
  });

  test('中段落到标量：路径穿越非容器', () => {
    expect(() => applyPatch({ a: 5 }, [{ op: 'add', path: '/a/b/c', value: 1 }])).toThrow(
      /Patch path traverses a non-container: \/a\/b\/c/
    );
    expect(() => applyPatch({ a: null }, [{ op: 'remove', path: '/a/b/c' }])).toThrow(
      /traverses a non-container/
    );
  });

  test('add 下标 > length 越界拒绝；=== length 视为尾部追加', () => {
    expect(() => applyPatch({ list: [1, 2] }, [{ op: 'add', path: '/list/5', value: 9 }])).toThrow(
      /Patch index out of bounds: \/list\/5/
    );
    // index === length 合法，等价于尾部追加
    expect(applyPatch({ list: [1, 2] }, [{ op: 'add', path: '/list/2', value: 3 }])).toEqual({ list: [1, 2, 3] });
  });

  test('数组 replace 越界报「目标缺失」，与 add 的「下标越界」区分', () => {
    expect(() => applyPatch({ list: [1, 2] }, [{ op: 'replace', path: '/list/5', value: 9 }])).toThrow(
      /Patch replace target missing: \/list\/5/
    );
  });

  test('"-" 误用于 remove / replace 均报目标缺失（仅 add 支持追加）', () => {
    expect(() => applyPatch({ list: [1, 2] }, [{ op: 'remove', path: '/list/-' }])).toThrow(
      /Patch remove target missing: \/list\/-/
    );
    expect(() => applyPatch({ list: [1, 2] }, [{ op: 'replace', path: '/list/-', value: 9 }])).toThrow(
      /Patch replace target missing: \/list\/-/
    );
    // add 用 "-" 是合法尾部追加
    expect(applyPatch({ list: [1, 2] }, [{ op: 'add', path: '/list/-', value: 3 }])).toEqual({ list: [1, 2, 3] });
  });

  test('前导零下标非法（RFC 6902 只接受 0 / [1-9][0-9]*）', () => {
    expect(() => applyPatch({ list: [1, 2] }, [{ op: 'replace', path: '/list/01', value: 9 }])).toThrow(
      /Invalid array index in patch path: \/list\/01/
    );
    expect(() => applyPatch({ list: [1, 2] }, [{ op: 'add', path: '/list/00', value: 9 }])).toThrow(
      /Invalid array index/
    );
  });

  test('对象 remove 缺失键与 replace 缺失键分别报错', () => {
    expect(() => applyPatch({ a: 1 }, [{ op: 'remove', path: '/missing' }])).toThrow(
      /Patch remove target missing: \/missing/
    );
    expect(() => applyPatch({ a: 1 }, [{ op: 'replace', path: '/missing', value: 2 }])).toThrow(
      /Patch replace target missing: \/missing/
    );
  });
});

describe('invertPatch 错误路径（v2.7.0 M2 #5）', () => {
  test('remove / replace 打在缺失路径上 → Patch path not found', () => {
    expect(() => invertPatch({ a: 1 }, [{ op: 'remove', path: '/missing' }])).toThrow(
      /Patch path not found: \/missing/
    );
    expect(() => invertPatch({ a: 1 }, [{ op: 'replace', path: '/missing', value: 2 }])).toThrow(
      /Patch path not found: \/missing/
    );
  });

  test('add 走 "/-" 但父级不是数组 → Invalid array append path', () => {
    expect(() => invertPatch({ a: 5 }, [{ op: 'add', path: '/a/-', value: 1 }])).toThrow(
      /Invalid array append path: \/a\/-/
    );
  });

  test('根路径 add 的反向是恢复旧文档的 replace，往返还原', () => {
    const before = { a: 1 };
    const ops: JsonPatchOp[] = [{ op: 'add', path: '', value: { b: 2 } } as JsonPatchOp];
    const inverse = invertPatch(before, ops);
    expect(inverse).toEqual([{ op: 'replace', path: '', value: { a: 1 } }]);
    expect(applyPatch(applyPatch(before, ops), inverse)).toEqual(before);
  });

  test('invertPatch 逐条用渐进文档求旧值，后续 op 看到前面 op 的结果', () => {
    const before = { list: [1, 2, 3] };
    const ops: JsonPatchOp[] = [
      { op: 'remove', path: '/list/0' },
      { op: 'remove', path: '/list/0' }
    ];
    const inverse = invertPatch(before, ops);
    expect(inverse).toEqual([
      { op: 'add', path: '/list/0', value: 2 },
      { op: 'add', path: '/list/0', value: 1 }
    ]);
    expect(applyPatch(applyPatch(before, ops), inverse)).toEqual(before);
  });
});

describe('parsePatchOps 根路径拒绝（v2.7.0 M2 #5）', () => {
  test('applyPatch 接受根路径，parsePatchOps 在网络边界拒绝整文档覆盖', () => {
    const ops = [{ op: 'replace', path: '', value: { hijacked: true } }] as JsonPatchOp[];
    // 实现层支持根路径（RFC 6902 空指针）
    expect(applyPatch({ a: 1 } as unknown, ops)).toEqual({ hijacked: true });
    // 但网络输入防线不放行：外部 PATCH 不得整文档覆盖
    expect(() => parsePatchOps(ops)).toThrow(JsonPatchError);
    expect(() => parsePatchOps([{ op: 'add', path: '', value: [1] }])).toThrow(JsonPatchError);
    expect(() => parsePatchOps([{ op: 'remove', path: '' }])).toThrow(JsonPatchError);
  });
});
