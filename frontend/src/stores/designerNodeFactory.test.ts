import { describe, expect, test } from 'vitest';
import type { MaterialItem } from '../types/designer';
import { createNodeFromMaterial } from './designerNodeFactory';

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
});