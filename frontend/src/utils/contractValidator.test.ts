import { describe, it, expect, beforeEach } from 'vitest';
import { validateComponentProps, getOutputPayloadHints } from './contractValidator';
import { registerMaterial, resetMaterialRegistry } from '../registry/materialRegistry';
import type { ComponentNode } from '../types/designer';

const nodeOf = (patch: Partial<ComponentNode>): Pick<ComponentNode, 'type' | 'props' | 'config'> =>
  ({ type: 'pro-table', props: {}, config: {}, ...patch }) as Pick<ComponentNode, 'type' | 'props' | 'config'>;

describe('validateComponentProps', () => {
  beforeEach(() => resetMaterialRegistry());

  it('内置类型通过完整配置时不报', () => {
    const issues = validateComponentProps(
      nodeOf({
        type: 'pro-table',
        props: { border: true, stripe: false, size: 'default' },
        config: { columns: [{ prop: 'id' }], pagination: { enabled: true }, actions: [] }
      })
    );
    expect(issues).toEqual([]);
  });

  it('类型不符时给出含「期望类型」的警告', () => {
    const issues = validateComponentProps(
      nodeOf({
        type: 'pro-table',
        props: { border: 'yes' },
        config: { columns: 'bad' }
      })
    );
    const border = issues.find((i) => i.name === 'border');
    const columns = issues.find((i) => i.name === 'columns');
    expect(border?.message).toContain('期望类型 boolean');
    expect(columns?.message).toContain('期望类型 array');
  });

  it('必填缺失给出警告（无「期望类型」字样，供上层与 missingFields 去重）', () => {
    const issues = validateComponentProps(nodeOf({ type: 'pro-form', props: {}, config: {} }));
    const items = issues.find((i) => i.name === 'items');
    expect(items?.message).toContain('必填');
    expect(items?.message).not.toContain('期望类型');
  });

  it('整段 {{ }} 表达式值跳过类型检查', () => {
    const issues = validateComponentProps(
      nodeOf({ type: 'el-switch', props: { value: '{{ state.on }}' } })
    );
    expect(issues).toEqual([]);
  });

  it('未知类型与未登记字段不报', () => {
    const issues = validateComponentProps(
      nodeOf({ type: 'mystery-widget', props: { anything: 1 } })
    );
    expect(issues).toEqual([]);
    const elIssues = validateComponentProps(nodeOf({ type: 'el-button', props: { custom: [] } }));
    expect(elIssues).toEqual([]);
  });

  it('黑盒 custom-* 按物料契约 inputs 校验必填与类型', () => {
    const reg = registerMaterial({
      type: 'custom-user-card',
      label: '用户卡',
      icon: 'User',
      category: 'pro',
      kind: 'composite',
      defaultLayout: { w: 4, h: 2 },
      defaultProps: {},
      defaultAttrs: {},
      schema: [
        {
          id: 'seed-1',
          type: 'el-button',
          label: '按钮',
          layout: { x: 0, y: 0, w: 2, h: 2, i: 'seed-1' },
          props: {},
          attrs: {},
          style: {},
          events: {}
        }
      ],
      contract: {
        inputs: [
          { name: 'title', label: '标题', type: 'string', nodeId: 'seed-1', fieldPath: 'props.text', required: true },
          { name: 'count', label: '数量', type: 'number', nodeId: 'seed-1', fieldPath: 'props.count', required: false }
        ],
        outputs: [{ name: 'click', label: '点击', nodeId: 'seed-1', event: 'click' }]
      },
      currentVersion: '1.0.0'
    });
    expect(reg.ok).toBe(true);

    const missing = validateComponentProps(nodeOf({ type: 'custom-user-card', props: {} }));
    expect(missing.map((i) => i.name)).toEqual(['title']);

    const badType = validateComponentProps(
      nodeOf({ type: 'custom-user-card', props: { title: 'ok', count: 'three' } })
    );
    expect(badType.find((i) => i.name === 'count')?.message).toContain('期望类型 number');

    const ok = validateComponentProps(
      nodeOf({ type: 'custom-user-card', props: { title: 'ok', count: 3 } })
    );
    expect(ok).toEqual([]);
  });
});

describe('getOutputPayloadHints', () => {
  beforeEach(() => resetMaterialRegistry());

  it('内置类型返回事件出口 payload 提示', () => {
    const table = getOutputPayloadHints('pro-table');
    expect(table.map((h) => h.name)).toEqual(['view', 'delete']);
    expect(table[0].samplePaths).toContain('event.row');

    const form = getOutputPayloadHints('pro-form');
    expect(form[0].name).toBe('submit');
    expect(form[0].payloadSchema?.type).toBe('object');

    const btn = getOutputPayloadHints('el-button');
    expect(btn[0].name).toBe('click');
    expect(btn[0].samplePaths).toEqual([]);
  });

  it('未知类型返回空数组', () => {
    expect(getOutputPayloadHints('mystery-widget')).toEqual([]);
  });

  it('黑盒 custom-* 按契约 outputs 返回（输出名命中 payload 语义）', () => {
    registerMaterial({
      type: 'custom-report',
      label: '报表',
      icon: 'Grid',
      category: 'pro',
      kind: 'composite',
      defaultLayout: { w: 6, h: 4 },
      defaultProps: {},
      defaultAttrs: {},
      schema: [
        {
          id: 'seed-1',
          type: 'pro-table',
          label: '表格',
          layout: { x: 0, y: 0, w: 6, h: 4, i: 'seed-1' },
          props: {},
          attrs: {},
          style: {},
          events: {}
        }
      ],
      contract: {
        inputs: [],
        outputs: [
          { name: 'view', label: '查看', nodeId: 'seed-1', event: 'view' },
          { name: 'export', label: '导出', nodeId: 'seed-1', event: 'export' }
        ]
      },
      currentVersion: '1.0.0'
    });

    const hints = getOutputPayloadHints('custom-report');
    expect(hints.map((h) => h.name)).toEqual(['view', 'export']);
    expect(hints[0].samplePaths).toContain('event.row');
    expect(hints[1].samplePaths).toEqual([]);
    expect(hints[1].label).toBe('导出');
  });
});
