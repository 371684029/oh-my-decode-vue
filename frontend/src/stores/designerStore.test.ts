import { beforeEach, describe, expect, test } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDesignerStore } from '../stores/designerStore';
import type { MaterialItem } from '../types/designer';

const material: MaterialItem = {
  type: 'el-button',
  label: '按钮 (Button)',
  icon: 'Pointer',
  category: 'element',
  defaultLayout: { w: 2, h: 2 },
  defaultProps: { text: '操作按钮', type: 'primary' },
  defaultAttrs: {}
};

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('designerStore 节点操作', () => {
  test('addNodeFromMaterial 添加节点并选中、记录历史', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);

    expect(store.pageSchema.children.length).toBe(1);
    const node = store.pageSchema.children[0];
    expect(node.type).toBe('el-button');
    expect(node.layout.w).toBe(2);
    expect(store.selectedNodeId).toBe(node.id);
    expect(store.isDrawerOpen).toBe(true);
    expect(store.canUndo).toBe(true);
    const canvas = store.pageSchema.layers?.find((layer) => layer.type === 'canvas');
    expect(canvas?.children).toBe(store.pageSchema.children);
  });

  test('addChildToNode 把物料放进容器并可选中', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial({
      ...material,
      type: 'pro-container',
      label: '容器',
      defaultLayout: { w: 12, h: 4 }
    });
    const parentId = store.pageSchema.children[0].id;
    expect(store.addChildToNode(parentId, material)).toBe(true);
    expect(store.pageSchema.children[0].children?.[0].type).toBe('el-button');
    expect(store.selectedNode?.type).toBe('el-button');
    const childId = store.pageSchema.children[0].children?.[0].id;
    if (!childId) throw new Error('missing child');
    store.addChildToNode(parentId, { ...material, label: '第二个' });
    expect(store.moveChild(parentId, childId, 1)).toBe(true);
    expect(store.pageSchema.children[0].children?.[1].id).toBe(childId);
    store.removeNode(childId);
    expect(store.pageSchema.children[0].children?.some((node) => node.id === childId)).toBe(false);
  });

  test('noteSchemaChange 把属性修改前的快照写入撤销栈', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    const before = JSON.stringify(store.pageSchema);
    store.pageSchema.children[0].label = '改名';
    store.noteSchemaChange(before);
    store.flushPendingHistory();
    store.undo();
    expect(store.pageSchema.children[0].label).toBe('按钮 (Button)');
  });

  test('undo/redo 撤销与重做', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    const id = store.pageSchema.children[0].id;

    store.undo();
    expect(store.pageSchema.children.length).toBe(0);
    expect(store.canRedo).toBe(true);

    store.redo();
    expect(store.pageSchema.children.length).toBe(1);
    expect(store.pageSchema.children[0].id).toBe(id);
  });

  test('历史栈上限 30 步', () => {
    const store = useDesignerStore();
    for (let i = 0; i < 35; i++) {
      store.addNodeFromMaterial(material);
    }
    expect(store.historyPast.length).toBe(30);
  });

  test('recordHistory 去重：连续无变化不重复记录', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    store.recordHistory(); // 记录当前状态
    const len = store.historyPast.length;
    store.recordHistory(); // 页面无变化 → 去重跳过
    store.recordHistory();
    expect(store.historyPast.length).toBe(len);
  });

  test('copySelectedNode / pasteNode 复制粘贴生成新 id', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    const originalId = store.pageSchema.children[0].id;

    expect(store.copySelectedNode()).toBe(true);
    expect(store.pasteNode()).toBe(true);

    expect(store.pageSchema.children.length).toBe(2);
    expect(store.pageSchema.children[0].id).toBe(originalId);
    expect(store.pageSchema.children[1].id).not.toBe(originalId);
  });

  test('pasteNode 重写容器子孙 id', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial({
      ...material,
      type: 'pro-container',
      label: '容器',
      defaultLayout: { w: 12, h: 4 }
    });
    const parentId = store.pageSchema.children[0].id;
    store.addChildToNode(parentId, material);
    store.addChildToNode(parentId, { ...material, label: '第二个' });
    store.selectNode(parentId);
    const before = store.pageSchema.children[0].children?.map((node) => node.id) ?? [];
    expect(store.copySelectedNode()).toBe(true);
    expect(store.pasteNode()).toBe(true);
    const pasted = store.pageSchema.children[1];
    const after = pasted.children?.map((node) => node.id) ?? [];
    expect(after).toHaveLength(2);
    expect(new Set([pasted.id, ...after, parentId, ...before]).size).toBe(6);
    expect(after.every((id) => !before.includes(id))).toBe(true);
  });

  test('拖拽手势只在结束时记一步', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    const before = store.historyPast.length;
    store.beginLayoutGesture();
    store.updateNodeLayout([{ i: store.pageSchema.children[0].id, x: 3, y: 1, w: 2, h: 2 }], { history: false });
    store.updateNodeLayout([{ i: store.pageSchema.children[0].id, x: 4, y: 1, w: 2, h: 2 }], { history: false });
    expect(store.historyPast.length).toBe(before);
    store.endLayoutGesture();
    expect(store.historyPast.length).toBe(before + 1);
    store.undo();
    expect(store.pageSchema.children[0].layout.x).toBe(0);
  });

  test('removeNode 删除并清空选中', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    const id = store.pageSchema.children[0].id;

    store.removeNode(id);
    expect(store.pageSchema.children.length).toBe(0);
    expect(store.selectedNodeId).toBeNull();
    expect(store.isDrawerOpen).toBe(false);
  });

  test('moveSelectedNodeBy 方向键微调且不越界', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);

    expect(store.moveSelectedNodeBy(2, 3)).toBe(true);
    const node = store.pageSchema.children[0];
    expect(node.layout.x).toBe(2);
    expect(node.layout.y).toBe(3);

    // 不会移到负坐标
    expect(store.moveSelectedNodeBy(-10, -10)).toBe(true);
    expect(node.layout.x).toBe(0);
    expect(node.layout.y).toBe(0);
  });

  test('updateNodeLayout 记录单次历史', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    const historyBefore = store.historyPast.length;

    store.updateNodeLayout([{ i: store.pageSchema.children[0].id, x: 5, y: 5, w: 2, h: 2 }]);
    expect(store.historyPast.length).toBe(historyBefore + 1);
    expect(store.pageSchema.children[0].layout.x).toBe(5);
  });
});

describe('designerStore 图层管理', () => {
  test('addLayer 三种类型默认 props', () => {
    const store = useDesignerStore();

    const dialogId = store.addLayer('dialog', '业务弹窗');
    expect(store.pageSchema.layers?.length).toBe(2);
    expect(store.activeLayerId).toBe(dialogId);
    expect(store.pageSchema.layers?.find((l) => l.id === dialogId)?.props?.title).toBe('业务弹窗');

    const htmlId = store.addLayer('custom-html', '自定义层');
    const htmlLayer = store.pageSchema.layers?.find((l) => l.id === htmlId);
    expect(htmlLayer?.props?.htmlCode).toContain('自定义 HTML 图层内容');
    expect(htmlLayer?.props?.scriptMounted).toContain('挂载时间');
  });

  test('removeLayer 不允许删除主画布图层', () => {
    const store = useDesignerStore();
    store.addLayer('loading', '加载层');

    store.removeLayer('layer_base_canvas');
    expect(store.pageSchema.layers?.length).toBe(2);
  });

  test('removeLayer 删除后回退主画布激活', () => {
    const store = useDesignerStore();
    const layerId = store.addLayer('loading', '加载层');

    store.removeLayer(layerId);
    expect(store.pageSchema.layers?.length).toBe(1);
    expect(store.activeLayerId).toBe('layer_base_canvas');
  });

  test('toggleLayerVisible 切换显隐并记录历史', () => {
    const store = useDesignerStore();
    const layerId = store.addLayer('dialog', '弹窗');
    const historyBefore = store.historyPast.length;

    expect(store.pageSchema.layers?.find((l) => l.id === layerId)?.visible).toBe(false);
    store.toggleLayerVisible(layerId);
    expect(store.pageSchema.layers?.find((l) => l.id === layerId)?.visible).toBe(true);
    expect(store.historyPast.length).toBe(historyBefore + 1);
  });

  test('updateLayerProps 合并更新', () => {
    const store = useDesignerStore();
    const layerId = store.addLayer('dialog', '弹窗');

    store.updateLayerProps(layerId, { title: '新标题', width: '600px' });
    const layer = store.pageSchema.layers?.find((l) => l.id === layerId);
    expect(layer?.props?.title).toBe('新标题');
    expect(layer?.props?.width).toBe('600px');
  });
});
