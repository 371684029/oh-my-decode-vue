import { describe, expect, test } from 'vitest';
import {
  contractSignature,
  normalizeNodeIds,
  classifyVersionChange,
  suggestVersion,
  buildChangelog
} from './versionClassify';
import type { MaterialVersion } from '../types/schema';

function node(id: string, type = 'el-button', extra: Record<string, unknown> = {}): any {
  return {
    id,
    type,
    label: type,
    layout: { x: 0, y: 0, w: 2, h: 2, i: id },
    props: {},
    attrs: {},
    style: {},
    events: {},
    ...extra
  };
}

function version(overrides: Partial<MaterialVersion> = {}): MaterialVersion {
  return {
    version: '1.0.0',
    schema: [node('n1')],
    contract: {
      inputs: [{ name: 'title', label: '标题', type: 'string', nodeId: 'n1', fieldPath: 'props.title', required: false }],
      outputs: []
    },
    contractSignature: '',
    summary: ['el-button'],
    changelog: '',
    publishedAt: '2026-09-28T00:00:00.000Z',
    releasedBy: 'tester',
    ...overrides
  };
}

describe('contractSignature', () => {
  test('字段顺序无关：排序后哈希稳定', () => {
    const a = contractSignature({ inputs: [{ name: 'b', type: 'string', nodeId: 'n', fieldPath: 'p', required: false }], outputs: [] });
    const b = contractSignature({ inputs: [{ name: 'b', type: 'string', nodeId: 'n', fieldPath: 'p', required: false }], outputs: [] });
    expect(a).toBe(b);
    // 字段顺序不同也相同
    const c = contractSignature({
      inputs: [
        { name: 'a', type: 'string', nodeId: 'n', fieldPath: 'p', required: false },
        { name: 'b', type: 'string', nodeId: 'n', fieldPath: 'p', required: false }
      ],
      outputs: []
    });
    const d = contractSignature({
      inputs: [
        { name: 'b', type: 'string', nodeId: 'n', fieldPath: 'p', required: false },
        { name: 'a', type: 'string', nodeId: 'n', fieldPath: 'p', required: false }
      ],
      outputs: []
    });
    expect(c).toBe(d);
  });

  test('契约内容变化签名不同', () => {
    const a = contractSignature({ inputs: [{ name: 'title', type: 'string', nodeId: 'n', fieldPath: 'props.title', required: false }], outputs: [] });
    const b = contractSignature({ inputs: [{ name: 'content', type: 'string', nodeId: 'n', fieldPath: 'props.content', required: false }], outputs: [] });
    expect(a).not.toBe(b);
  });
});

describe('normalizeNodeIds', () => {
  test('id 与 layout.i 归一化为 $n 序号', () => {
    const out = normalizeNodeIds([node('a', 'el-button'), node('b', 'pro-container', { children: [node('c', 'el-input')] })]);
    expect(out[0].id).toBe('$n1');
    expect(out[0].layout.i).toBe('$n1');
    expect(out[1].id).toBe('$n2');
    expect(out[1].children[0].id).toBe('$n3');
  });
});

describe('classifyVersionChange', () => {
  test('契约签名变化 → major', () => {
    const prev = version();
    const next = version({
      contract: {
        inputs: [{ name: 'other', label: '其他', type: 'string', nodeId: 'n1', fieldPath: 'props.other', required: false }],
        outputs: []
      }
    });
    expect(classifyVersionChange(prev, next).bump).toBe('major');
  });

  test('新增节点（结构 add）→ minor', () => {
    const prev = version();
    const next = version({ schema: [node('n1'), node('n2', 'el-input')] });
    const result = classifyVersionChange(prev, next);
    expect(result.bump).toBe('minor');
  });

  test('仅值级变化（replace）→ patch', () => {
    const prev = version({ schema: [node('n1', 'el-button', { props: { text: '旧文案' } })] });
    const next = version({ schema: [node('n1', 'el-button', { props: { text: '新文案' } })] });
    expect(classifyVersionChange(prev, next).bump).toBe('patch');
  });

  test('新增配置字段（props key 增）→ minor', () => {
    const prev = version({ schema: [node('n1', 'el-button', { props: { text: '文案' } })] });
    const next = version({ schema: [node('n1', 'el-button', { props: { text: '文案', size: 'large' } })] });
    expect(classifyVersionChange(prev, next).bump).toBe('minor');
  });

  test('无差异 → none', () => {
    const a = version();
    const b = version({ schema: [node('n1')] });
    expect(classifyVersionChange(a, b).bump).toBe('none');
  });
});

describe('suggestVersion / buildChangelog', () => {
  test('版本号推进', () => {
    expect(suggestVersion('1.2.3', 'major')).toBe('2.0.0');
    expect(suggestVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(suggestVersion('1.2.3', 'patch')).toBe('1.2.4');
    expect(suggestVersion('1.2.3', 'none')).toBe('1.2.3');
  });

  test('首次发布与变更摘要', () => {
    const v = version();
    expect(buildChangelog(null, v, 'minor')).toBe('首次发布');
    const prev = version();
    const next = version({ schema: [node('n1'), node('n2', 'el-input')] });
    expect(buildChangelog(prev, next, 'minor')).toContain('结构变更');
  });
});
