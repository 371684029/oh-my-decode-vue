import { http } from './http';
import type { MaterialRef, MaterialVersion } from '../types/designer';

/**
 * 物料版本解析链 (v2.1.0)
 * - 会话缓存：id@version → 版本快照；id → 版本列表
 * - follow 策略：pin（精确锁定）/ minor（同 major 最新）/ patch（同 minor 最新）
 * - 容错：pin 版本缺失 → 回退当前版本；网络失败 → null（渲染占位）
 */

const versionCache = new Map<string, MaterialVersion>();
const listCache = new Map<string, string[]>();

export function clearMaterialCache(): void {
  versionCache.clear();
  listCache.clear();
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/** follow 策略选版本（all 升序；返回 null 表示无满足版本） */
export function pickFollowVersion(ref: MaterialRef, allAsc: string[]): string | null {
  if (!ref.follow || ref.follow === 'pin') return ref.version;
  const [maj, min] = ref.version.split('.').map(Number);
  let best: string | null = null;
  for (const v of allAsc) {
    const [a, b] = v.split('.').map(Number);
    if (ref.follow === 'patch') {
      if (a === maj && b === min) best = v;
    } else if (ref.follow === 'minor') {
      if (a === maj) best = v;
    }
  }
  return best ?? null;
}

/** 解析有效版本号（含 follow 与缺失回退） */
export async function resolveEffectiveVersion(ref: MaterialRef): Promise<string | null> {
  let all = listCache.get(ref.id);
  if (!all) {
    try {
      const resp = await http.get(`/materials/${encodeURIComponent(ref.id)}/versions`);
      const list = (resp.data?.data || []) as Array<{ version: string }>;
      all = list.map((v) => v.version).sort(compareSemver);
      listCache.set(ref.id, all);
    } catch (error) {
      // 版本列表拉取失败会静默降级为「无可用版本」，必须留痕以便定位网络/后端异常
      console.warn(`[materialResolver] 版本列表拉取失败，物料 ${ref.id} 回退为缺失占位:`, error);
      all = [];
    }
  }
  if (all.length === 0) return null;
  const picked = pickFollowVersion(ref, all);
  if (picked && all.includes(picked)) return picked;
  // pin 版本缺失（已归档/删除）→ 回退最高版本（当前版本）
  return all[all.length - 1] ?? null;
}

/** 解析物料版本快照（会话缓存） */
export async function resolveMaterial(ref: MaterialRef): Promise<MaterialVersion | null> {
  const effective = await resolveEffectiveVersion(ref);
  if (!effective) return null;
  const key = `${ref.id}@${effective}`;
  if (versionCache.has(key)) return versionCache.get(key)!;
  try {
    const resp = await http.get(`/materials/${encodeURIComponent(ref.id)}/versions/${effective}`);
    const version = resp.data?.data as MaterialVersion;
    if (version) versionCache.set(key, version);
    return version ?? null;
  } catch (error) {
    // 版本快照拉取失败返回 null（渲染占位），同样不能吞掉异常
    console.warn(`[materialResolver] 版本快照拉取失败 ${ref.id}@${effective}，回退渲染占位:`, error);
    return null;
  }
}

/** 供渲染组件同步使用的状态：解析中 / 缺失标记 */
export function isMaterialMissing(ref: MaterialRef): boolean {
  return !listCache.has(ref.id) || listCache.get(ref.id)!.length === 0;
}
