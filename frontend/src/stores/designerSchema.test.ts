import { describe, expect, test } from 'vitest';
import type { ComponentNode, PageSchema } from '../types/designer';
import {
  entrySize,
  generateUniqueId,
  rewriteActionTargets,
  rewriteNodeIds,
  shareBaseCanvas,
  stripSharedCanvasLayer,
  toHistoryDoc,
  type HistoryEntry
} from './designerSchema';

const emptyNodeFields = {
  label: '',
  props: {},
  attrs: {},
  style: {},
  events: {} as ComponentNode['events']
};

function minimalPage(children: ComponentNode[] = []): PageSchema {
  return {
    id: 'page_test',
    title: 't',
    type: 'page',
    meta: { author: 'test', description: 'test', version: '1.0.0' },
    state: {},
    children,
    layers: [
      {
        id: 'layer_base_canvas',
        name: 'Base',
        type: 'canvas',
        visible: true,
        zIndex: 1,
        children: []
      }
    ]
  };
}

describe('designerSchema', () => {
  test('shareBaseCanvas 链接主画布 children 与 canvas 图层', () => {
    const schema = shareBaseCanvas(minimalPage());
    const base = schema.layers!.find((l) => l.type === 'canvas')!;
    expect(base.children).toBe(schema.children);
  });

  test('stripSharedCanvasLayer 清空 canvas 图层 children 副本', () => {
    const schema = minimalPage([
      { id: 'n1', type: 'el-button', layout: { x: 0, y: 0, w: 1, h: 1, i: 'n1' }, ...emptyNodeFields }
    ]);
    shareBaseCanvas(schema);
    const doc = structuredClone(schema) as PageSchema;
    shareBaseCanvas(doc);
    stripSharedCanvasLayer(doc);
    const base = doc.layers!.find((l) => l.type === 'canvas')!;
    expect(base.children).toEqual([]);
    expect(doc.children.length).toBe(1);
  });

  test('toHistoryDoc 剥离共享 canvas children', () => {
    const schema = shareBaseCanvas(minimalPage());
    schema.children.push({
      id: 'n1',
      type: 'el-button',
      layout: { x: 0, y: 0, w: 1, h: 1, i: 'n1' },
      ...emptyNodeFields
    });
    const hist = toHistoryDoc(schema);
    expect(hist.layers!.find((l) => l.type === 'canvas')?.children).toEqual([]);
  });

  test('rewriteNodeIds 重写子树并重映射 layout.i', () => {
    const root: ComponentNode = {
      id: 'old',
      type: 'pro-container',
      layout: { x: 0, y: 0, w: 4, h: 2, i: 'old' },
      ...emptyNodeFields,
      children: [
        {
          id: 'child',
          type: 'el-button',
          layout: { x: 0, y: 0, w: 1, h: 1, i: 'child' },
          ...emptyNodeFields
        }
      ]
    };
    const clone = structuredClone(root);
    const idMap = rewriteNodeIds(clone, (t) => `new_${t}`);
    expect(idMap.get('old')).toBeDefined();
    expect(idMap.get('child')).toBeDefined();
    expect(clone.id).not.toBe('old');
    expect(clone.layout.i).toBe(clone.id);
  });

  test('rewriteActionTargets 按 idMap 更新事件 target', () => {
    const node: ComponentNode = {
      id: 'btn',
      type: 'el-button',
      layout: { x: 0, y: 0, w: 1, h: 1, i: 'btn' },
      label: '',
      props: {},
      attrs: {},
      style: {},
      events: {
        click: {
          enabled: true,
          actions: [{ id: 'a1', type: 'show_message', target: 'dlg_old' }]
        }
      }
    };
    const map = new Map([['dlg_old', 'dlg_new']]);
    rewriteActionTargets(node, map);
    expect(node.events?.click?.actions?.[0].target).toBe('dlg_new');
  });

  test('entrySize 为 ops + inverse 序列化长度之和', () => {
    const entry: HistoryEntry = {
      ops: [{ op: 'replace', path: '/title', value: 'x' }],
      inverse: [{ op: 'replace', path: '/title', value: 'y' }]
    };
    expect(entrySize(entry)).toBeGreaterThan(0);
  });

  test('generateUniqueId 前缀保留且每次不同', () => {
    const a = generateUniqueId('node');
    const b = generateUniqueId('node');
    expect(a.startsWith('node_')).toBe(true);
    expect(a).not.toBe(b);
  });
});