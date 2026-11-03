import { beforeEach, describe, expect, test } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDesignerStore } from './designerStore';
import type { ComponentNode, MaterialManifest, PageSchema } from '../types/designer';

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

describe('designerStore 黑盒物料实例化 (v2.1.0)', () => {
  const blackboxManifest: MaterialManifest = {
    type: 'custom-user-card',
    label: '用户卡片',
    icon: 'Avatar',
    category: 'pro',
    defaultLayout: { w: 4, h: 3 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    currentVersion: '2.1.0',
    contract: {
      inputs: [
        { name: 'title', label: '标题', type: 'string', nodeId: 's1', fieldPath: 'props.title', required: true }
      ],
      outputs: [{ name: 'submit', label: '提交', nodeId: 's2', event: 'click' }]
    },
    summary: ['el-button', 'el-input']
  };

  test('addBlackBoxFromMaterial：单节点 materialRef + 布局 + 选中', () => {
    const store = useDesignerStore();
    const id = store.addBlackBoxFromMaterial(blackboxManifest, 3, 5);

    expect(id).toMatch(/^custom-user-card_/);
    expect(store.pageSchema.children.length).toBe(1);
    const created = store.pageSchema.children[0];
    expect(created.id).toBe(id);
    expect(created.type).toBe('custom-user-card');
    expect(created.label).toBe('用户卡片');
    expect(created.layout).toEqual({ x: 3, y: 5, w: 4, h: 3, i: id });
    // 黑盒引用锁定当前版本
    expect(created.materialRef).toEqual({ id: 'custom-user-card', version: '2.1.0', follow: 'pin' });
    expect(created.props).toEqual({});
    expect(created.attrs).toEqual({});
    expect(created.events).toEqual({});
    expect(store.selectedNodeId).toBe(id);
    expect(store.canUndo).toBe(true);
  });

  test('addBlackBoxFromMaterial：缺省 currentVersion 回退 1.0.0', () => {
    const store = useDesignerStore();
    const id = store.addBlackBoxFromMaterial({ ...blackboxManifest, currentVersion: undefined }, 0, 0);
    expect(store.pageSchema.children[0].materialRef?.version).toBe('1.0.0');
    expect(store.pageSchema.children[0].id).toBe(id);
  });
});

describe('designerStore addMaterialSmart 形态分发 (v2.1.0)', () => {
  const blackboxManifest: MaterialManifest = {
    type: 'custom-bb-card',
    label: '黑盒卡片',
    icon: 'Box',
    category: 'pro',
    defaultLayout: { w: 4, h: 3 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    currentVersion: '1.2.0',
    contract: {
      inputs: [
        { name: 'title', label: '标题', type: 'string', nodeId: 's1', fieldPath: 'props.title', required: false }
      ],
      outputs: []
    },
    summary: ['el-button']
  };

  const compositeManifest: MaterialManifest = {
    type: 'custom-user-card',
    label: '用户卡片',
    icon: 'Avatar',
    category: 'pro',
    defaultLayout: { w: 4, h: 4 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    schema: [node('s1', 'el-button', 0, 0, 2, 2), node('s2', 'el-input', 2, 0, 2, 2)],
    summary: ['el-button', 'el-input']
  };

  test('有契约的复合物料走黑盒路径：单 materialRef 节点', () => {
    const store = useDesignerStore();
    const id = store.addMaterialSmart(blackboxManifest, 1, 2);

    expect(id).not.toBe('');
    expect(store.pageSchema.children.length).toBe(1);
    const created = store.pageSchema.children[0];
    expect(created.id).toBe(id);
    expect(created.materialRef).toEqual({ id: 'custom-bb-card', version: '1.2.0', follow: 'pin' });
    expect(created.layout.x).toBe(1);
    expect(created.layout.y).toBe(2);
  });

  test('无契约有快照的复合物料走展开路径：子树实例化', () => {
    const store = useDesignerStore();
    const id = store.addMaterialSmart(compositeManifest, 3, 3);

    expect(id).not.toBe('');
    expect(store.pageSchema.children.length).toBe(2);
    expect(store.pageSchema.children.every((n) => !n.materialRef)).toBe(true);
    const [btn, input] = store.pageSchema.children;
    expect(btn.type).toBe('el-button');
    expect(btn.layout.x).toBe(3);
    expect(input.type).toBe('el-input');
    expect(input.layout.x).toBe(5);
  });

  test('原子物料走普通节点路径：返回空串但节点入画布', () => {
    const store = useDesignerStore();
    const id = store.addMaterialSmart(materialItem, 0, 0);

    expect(id).toBe('');
    expect(store.pageSchema.children.length).toBe(1);
    expect(store.pageSchema.children[0].type).toBe('el-button');
    expect(store.pageSchema.children[0].materialRef).toBeUndefined();
  });
});

describe('designerStore setPageSchema 整页替换 (v2.0.0)', () => {
  test('替换 schema 并重置选中/图层编辑/属性栏', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(materialItem, 0, 0);
    store.openInspector();
    const layerId = store.addLayer('dialog', '弹窗');
    store.enterLayerEdit(layerId);
    expect(store.editingLayerId).toBe(layerId);

    const next: PageSchema = {
      id: 'page_next',
      title: '新页面',
      type: 'page',
      meta: { author: 'tester', description: '替换测试', version: '1.0.0' },
      state: { count: 1 },
      children: [node('n1', 'el-button', 0, 0, 2, 2)]
    };
    store.setPageSchema(next);

    // 整页替换
    expect(store.pageSchema.id).toBe('page_next');
    expect(store.pageSchema.title).toBe('新页面');
    expect(store.pageSchema.state).toEqual({ count: 1 });
    expect(store.pageSchema.children.length).toBe(1);
    expect(store.pageSchema.children[0].id).toBe('n1');
    expect(store.pageSchema.children[0].type).toBe('el-button');
    // shareBaseCanvas 注入主画布图层且与 children 同源
    const base = store.pageSchema.layers?.find((l) => l.type === 'canvas');
    expect(base).toBeTruthy();
    expect(base!.children).toBe(store.pageSchema.children);
    // 重置选中、图层编辑作用域，关闭属性栏
    expect(store.selectedNodeId).toBeNull();
    expect(store.editingLayerId).toBeNull();
    expect(store.isDrawerOpen).toBe(false);
    // 替换前状态已入历史，可撤销
    expect(store.canUndo).toBe(true);
  });
});

describe('designerStore 图层内编辑 enterLayerEdit/exitLayerEdit (v2.0.0)', () => {
  test('enterLayerEdit 设置作用域并清空选中；canvas 图层不可进入', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(materialItem, 0, 0);
    const nodeId = store.pageSchema.children[0].id;
    store.selectNode(nodeId);

    const layerId = store.addLayer('dialog', '弹窗');
    store.enterLayerEdit(layerId);
    expect(store.editingLayerId).toBe(layerId);
    expect(store.activeLayerId).toBe(layerId);
    expect(store.selectedNodeId).toBeNull();
    expect(store.selectedNodeIds).toEqual([]);

    // 作用域切换后添加进入图层 children，主画布不受影响
    store.addBlackBoxFromMaterial(blackboxManifestOf(), 0, 0);
    const layer = store.pageSchema.layers?.find((l) => l.id === layerId);
    expect(layer?.children.length).toBe(1);
    expect(store.pageSchema.children.length).toBe(1);

    // canvas 图层不可进入（no-op，作用域保持不变）
    store.enterLayerEdit('layer_base_canvas');
    expect(store.editingLayerId).toBe(layerId);
    expect(store.activeLayerId).toBe(layerId);
  });

  test('exitLayerEdit 清空作用域回到主画布并清空选中', () => {
    const store = useDesignerStore();
    const layerId = store.addLayer('dialog', '弹窗');
    store.enterLayerEdit(layerId);
    store.addNodeFromMaterial(materialItem, 0, 0);
    expect(store.pageSchema.layers?.find((l) => l.id === layerId)?.children.length).toBe(1);

    store.exitLayerEdit();
    expect(store.editingLayerId).toBeNull();
    expect(store.activeLayerId).toBe('layer_base_canvas');
    expect(store.selectedNodeId).toBeNull();
    expect(store.selectedNodeIds).toEqual([]);
    expect(store.activeChildren).toBe(store.pageSchema.children);

    // 退出后添加回主画布
    store.addNodeFromMaterial(materialItem, 0, 0);
    expect(store.pageSchema.children.length).toBe(1);
    expect(store.pageSchema.layers?.find((l) => l.id === layerId)?.children.length).toBe(1);
  });
});

/** 图层作用域测试用的最小黑盒物料 */
function blackboxManifestOf(): MaterialManifest {
  return {
    type: 'custom-bb-scope',
    label: '作用域黑盒',
    icon: 'Box',
    category: 'pro',
    defaultLayout: { w: 2, h: 2 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    currentVersion: '1.0.0',
    contract: { inputs: [], outputs: [] },
    summary: ['el-button']
  };
}
