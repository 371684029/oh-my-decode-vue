import { beforeEach, describe, expect, test } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDesignerStore } from './designerStore';
import type { ComponentNode, MaterialManifest } from '../types/designer';

function node(
  id: string,
  type: string,
  x: number,
  y: number,
  w: number,
  h: number,
  events?: Record<string, any>
): ComponentNode {
  return {
    id,
    type,
    label: type,
    layout: { x, y, w, h, i: id },
    props: {},
    attrs: {},
    style: {},
    events: events || {},
    ...(type === 'pro-container' ? { children: [] } : {})
  };
}

const materialItem = {
  type: 'el-button',
  label: '按钮',
  icon: 'Pointer',
  category: 'element' as const,
  defaultLayout: { w: 2, h: 2 },
  defaultProps: {},
  defaultAttrs: {}
};

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('designerStore 多选 (v2.0.0)', () => {
  test('toggleNodeSelected 单选/追加/移除', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(materialItem, 0, 0);
    store.addNodeFromMaterial(materialItem, 2, 0);
    const [a, b] = store.pageSchema.children;

    store.toggleNodeSelected(a.id, false);
    expect(store.selectedNodeIds).toEqual([a.id]);
    expect(store.selectedNodeId).toBe(a.id);

    store.toggleNodeSelected(b.id, true);
    expect(store.selectedNodeIds.sort()).toEqual([a.id, b.id].sort());
    expect(store.selectedNodeId).toBe(b.id);

    store.toggleNodeSelected(a.id, true);
    expect(store.selectedNodeIds).toEqual([b.id]);
  });

  test('selectNode 会重置多选集为单选', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(materialItem, 0, 0);
    store.addNodeFromMaterial(materialItem, 2, 0);
    const [a, b] = store.pageSchema.children;
    store.toggleNodeSelected(a.id, false);
    store.toggleNodeSelected(b.id, true);
    store.selectNode(a.id);
    expect(store.selectedNodeIds).toEqual([a.id]);
  });
});

describe('designerStore 复合物料实例化 (v2.0.0)', () => {
  const manifest: MaterialManifest = {
    type: 'custom-user-card',
    label: '用户卡片',
    icon: 'Avatar',
    category: 'pro',
    defaultLayout: { w: 4, h: 4 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    schema: [
      node('s1', 'el-button', 0, 0, 2, 2, {
        click: { enabled: true, actions: [{ id: 'act1', type: 'set_state', target: 's2', payload: {} }] }
      }),
      node('s2', 'el-input', 2, 0, 2, 2)
    ],
    summary: ['el-button', 'el-input']
  };

  test('实例化：坐标平移 + id 重写 + 事件 target 重写', () => {
    const store = useDesignerStore();
    store.addCompositeFromMaterial(manifest, 3, 3);

    expect(store.pageSchema.children.length).toBe(2);
    const [btn, input] = store.pageSchema.children;
    expect(btn.type).toBe('el-button');
    expect(input.type).toBe('el-input');
    expect(btn.id).not.toBe('s1');
    expect(input.id).not.toBe('s2');

    // 快照已归一化（0 起点），落点 (3,3) → 直接平移
    expect(btn.layout.x).toBe(3);
    expect(btn.layout.y).toBe(3);
    expect(input.layout.x).toBe(5);
    expect(input.layout.y).toBe(3);

    // 事件 target 指向实例化后的新 id
    const action = btn.events?.click?.actions?.[0];
    expect(action?.target).toBe(input.id);

    // 选中第一个节点
    expect(store.selectedNodeId).toBe(btn.id);
    expect(store.canUndo).toBe(true);
  });

  test('空 schema 返回空且不产生历史', () => {
    const store = useDesignerStore();
    const id = store.addCompositeFromMaterial({ ...manifest, schema: [] }, 0, 0);
    expect(id).toBe('');
    expect(store.pageSchema.children.length).toBe(0);
    expect(store.canUndo).toBe(false);
  });

  test('容器子树的实例化保留嵌套结构', () => {
    const nestedManifest: MaterialManifest = {
      ...manifest,
      type: 'custom-nested',
      schema: [node('p1', 'pro-container', 0, 0, 6, 4, undefined)],
      summary: ['pro-container']
    };
    nestedManifest.schema![0].children = [node('c1', 'el-input', 1, 1, 3, 2)];
    const store = useDesignerStore();
    store.addCompositeFromMaterial(nestedManifest, 1, 1);

    const container = store.pageSchema.children[0];
    expect(container.children?.length).toBe(1);
    const child = container.children![0];
    expect(child.id).not.toBe('c1');
    // 归一化后子节点 (1,1) + 落点 (1,1) = (2,2)
    expect(child.layout.x).toBe(2);
    expect(child.layout.y).toBe(2);
  });
});
