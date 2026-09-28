import { beforeEach, describe, expect, test } from 'vitest';
import {
  registerMaterial,
  unregisterMaterial,
  listCustomMaterials,
  getMaterial,
  hasMaterial,
  isCustomType,
  listAllMaterials,
  resetMaterialRegistry
} from './materialRegistry';
import type { MaterialManifest } from '../types/designer';

function sampleManifest(type = 'custom-user-card'): MaterialManifest {
  return {
    type,
    label: '用户卡片',
    icon: 'Avatar',
    category: 'pro',
    defaultLayout: { w: 6, h: 4 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    schema: [
      {
        id: 'n1',
        type: 'el-card',
        label: '卡片',
        layout: { x: 0, y: 0, w: 6, h: 4, i: 'n1' },
        props: {},
        attrs: {},
        style: {},
        events: {}
      }
    ],
    summary: ['el-card']
  };
}

beforeEach(() => {
  resetMaterialRegistry();
});

describe('materialRegistry 运行时注册表', () => {
  test('注册 → 列表/读取/查重', () => {
    expect(registerMaterial(sampleManifest()).ok).toBe(true);
    expect(listCustomMaterials().map((m) => m.type)).toEqual(['custom-user-card']);
    expect(getMaterial('custom-user-card')?.label).toBe('用户卡片');
    expect(hasMaterial('custom-user-card')).toBe(true);
    expect(isCustomType('custom-user-card')).toBe(true);
  });

  test('拒绝非 composite、非 custom- 前缀、与内置冲突', () => {
    expect(registerMaterial({ ...sampleManifest(), kind: 'atomic' }).ok).toBe(false);
    expect(registerMaterial({ ...sampleManifest('pro-table') }).ok).toBe(false);
    expect(registerMaterial({ ...sampleManifest('el-button') }).ok).toBe(false);
    expect(registerMaterial({ ...sampleManifest(), schema: [] }).ok).toBe(false);
  });

  test('注册为深拷贝，外部修改不影响注册表', () => {
    const manifest = sampleManifest();
    registerMaterial(manifest);
    manifest.label = '被外部污染';
    expect(getMaterial('custom-user-card')?.label).toBe('用户卡片');
  });

  test('注销与内置只读', () => {
    registerMaterial(sampleManifest());
    expect(unregisterMaterial('custom-user-card')).toBe(true);
    expect(unregisterMaterial('custom-user-card')).toBe(false);
    expect(hasMaterial('custom-user-card')).toBe(false);
    // 内置物料不会出现在自定义列表
    expect(listAllMaterials().some((m) => m.type === 'el-button')).toBe(true);
    expect(listCustomMaterials()).toEqual([]);
  });
});
