import { describe, expect, test } from 'vitest';
import type { MaterialItem, MaterialManifest } from '../types/designer';
import {
  createBlackBoxNode,
  createLayer,
  createNodeFromMaterial,
  instantiateCompositeSnapshot
} from './designerNodeFactory';

const buttonMaterial: MaterialItem = {
  type: 'el-button',
  label: '按钮',
  icon: 'Pointer',
  category: 'element',
  defaultLayout: { w: 2, h: 2 },
  defaultProps: { text: '点我' },
  defaultAttrs: {}
};

describe('designerNodeFactory', () => {
  test('createNodeFromMaterial 生成布局与默认 props', () => {
    const node = createNodeFromMaterial(buttonMaterial, 3, 5);
    expect(node.type).toBe('el-button');
    expect(node.layout.x).toBe(3);
    expect(node.layout.y).toBe(5);
    expect(node.layout.w).toBe(2);
    expect(node.id).toBe(node.layout.i);
    expect(node.props?.text).toBe('点我');
  });

  test('createNodeFromMaterial pro-table 带默认 view 消息链', () => {
    const table: MaterialItem = {
      ...buttonMaterial,
      type: 'pro-table',
      label: '表格',
      defaultLayout: { w: 12, h: 8 }
    };
    const node = createNodeFromMaterial(table, 0, 0);
    expect(node.events?.view?.enabled).toBe(true);
    expect(node.events?.view?.actions?.length).toBeGreaterThan(0);
  });

  test('createBlackBoxNode 带 materialRef 与默认 pin 版本', () => {
    const manifest: MaterialManifest = {
      ...buttonMaterial,
      type: 'custom-box',
      kind: 'composite',
      currentVersion: '2.1.0'
    };
    const node = createBlackBoxNode(manifest, 1, 2);
    expect(node.materialRef).toEqual({
      id: 'custom-box',
      version: '2.1.0',
      follow: 'pin'
    });
    expect(node.layout.x).toBe(1);
  });

  test('instantiateCompositeSnapshot 平移并重写 id', () => {
    const manifest: MaterialManifest = {
      ...buttonMaterial,
      type: 'custom-snap',
      kind: 'composite',
      schema: [
        {
          id: 'a',
          type: 'el-button',
          label: 'A',
          layout: { x: 2, y: 3, w: 2, h: 2, i: 'a' },
          props: {},
          attrs: {},
          style: {},
          events: {}
        }
      ]
    };
    const nodes = instantiateCompositeSnapshot(manifest, 10, 10);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).not.toBe('a');
    expect(nodes[0].layout.x).toBe(10);
    expect(nodes[0].layout.y).toBe(10);
  });

  test('instantiateCompositeSnapshot 空 schema 返回空数组', () => {
    const manifest: MaterialManifest = {
      ...buttonMaterial,
      type: 'custom-empty',
      kind: 'composite',
      schema: []
    };
    expect(instantiateCompositeSnapshot(manifest, 0, 0)).toEqual([]);
  });

  test('createLayer 按类型决定 visible 与默认 props', () => {
    const dialog = createLayer('dialog', '弹窗', 'layer_d', 20);
    expect(dialog.visible).toBe(false);
    expect(dialog.props?.title).toBe('弹窗');
    const loading = createLayer('loading', '', 'layer_l', 30);
    expect(loading.visible).toBe(false);
    const html = createLayer('custom-html', 'H', 'layer_h', 40);
    expect(html.visible).toBe(true);
    expect(html.props?.htmlCode).toContain('custom-card');
  });
});