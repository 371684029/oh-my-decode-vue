import type { MaterialItem, MaterialManifest } from '@lowcode/shared';
import { MATERIAL_REGISTRY } from './materials';
import { http } from '../utils/http';

/**
 * 运行时物料注册表 (v2.0.0)
 * - 内置物料 = 静态种子，只读，不可覆盖
 * - 用户物料 = 运行时注册，type 强制 custom- 前缀，与内置命名空间物理隔离
 */

const builtin = MATERIAL_REGISTRY as readonly MaterialItem[];

/** 用户物料（深拷贝存储，防外部修改污染注册表） */
const custom = new Map<string, MaterialManifest>();

export function registerMaterial(m: MaterialManifest): { ok: true } | { ok: false; reason: string } {
  if (!m || m.kind !== 'composite') {
    return { ok: false, reason: '仅复合物料 (kind: composite) 可动态注册' };
  }
  if (!m.type || !m.type.startsWith('custom-')) {
    return { ok: false, reason: '用户物料 type 必须以 custom- 前缀开头' };
  }
  if (builtin.some((item) => item.type === m.type)) {
    return { ok: false, reason: `内置物料已占用 type: ${m.type}，不可覆盖` };
  }
  if (!m.schema || m.schema.length === 0) {
    // v2.1 黑盒物料：schema 存于后端版本文件，manifest 只带契约 + 当前版本号
    if (!m.contract || !m.currentVersion) {
      return { ok: false, reason: '复合物料必须携带非空 schema 快照（或黑盒契约 + 当前版本号）' };
    }
  }
  custom.set(m.type, JSON.parse(JSON.stringify(m)));
  return { ok: true };
}

export function unregisterMaterial(type: string): boolean {
  return custom.delete(type);
}

export function listCustomMaterials(): MaterialManifest[] {
  return [...custom.values()];
}

export function getMaterial(type: string): MaterialManifest | undefined {
  return custom.get(type);
}

export function hasMaterial(type: string): boolean {
  return custom.has(type);
}

export function isCustomType(type: string): boolean {
  return type.startsWith('custom-') && custom.has(type);
}

/** 物料面板完整清单：内置 + 用户 */
export function listAllMaterials(): MaterialItem[] {
  return [...builtin, ...custom.values()];
}

/** 清空运行时注册（测试/会话重置用） */
export function resetMaterialRegistry(): void {
  custom.clear();
}

/** 启动时从后端加载已持久化的自定义物料（刷新页面后面板不丢失） */
export async function loadMaterialsFromBackend(): Promise<{ loaded: number; failed: string[] }> {
  const failed: string[] = [];
  try {
    const resp = await http.get('/materials');
    const list = (resp.data?.data || []) as MaterialManifest[];
    let loaded = 0;
    for (const manifest of list) {
      if (manifest.kind !== 'composite') continue;
      const reg = registerMaterial(manifest);
      if (!reg.ok) failed.push(manifest.type);
      else loaded++;
    }
    return { loaded, failed };
  } catch {
    return { loaded: 0, failed: ['后端不可达，物料面板仅显示内置物料'] };
  }
}
