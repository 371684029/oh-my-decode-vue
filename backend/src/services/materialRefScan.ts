import fs from 'fs/promises';
import path from 'path';
import { STORAGE_PAGES_DIR } from '../config';
import type { ComponentNode } from '../types/schema';

/** 递归收集节点（含 children） */
function walkNodes(nodes: ComponentNode[], out: ComponentNode[]): void {
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) walkNodes(n.children, out);
  }
}

export interface MaterialRefScanResult {
  count: number;
  pages: Array<{ id: string; title: string; count: number }>;
}

/**
 * 引用计数扫描 (v2.1.0)
 * 遍历 backend/storage/pages/*.json，统计引用某物料 id 的黑盒实例数。
 * 删除物料 / 归档版本前实时复核（计数只作提示，删除以实时扫描为准）。
 */
export async function scanMaterialRefs(materialId: string): Promise<MaterialRefScanResult> {
  let total = 0;
  const pages: Array<{ id: string; title: string; count: number }> = [];
  try {
    const files = await fs.readdir(STORAGE_PAGES_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await fs.readFile(path.join(STORAGE_PAGES_DIR, file), 'utf-8');
        const schema = JSON.parse(content);
        const nodes: ComponentNode[] = [];
        walkNodes(schema.children || [], nodes);
        for (const layer of schema.layers || []) walkNodes(layer.children || [], nodes);
        const count = nodes.filter((n) => n.materialRef?.id === materialId).length;
        if (count > 0) {
          total += count;
          pages.push({ id: schema.id, title: schema.title, count });
        }
      } catch {
        // 忽略破损文件
      }
    }
  } catch {
    // 目录不存在
  }
  return { count: total, pages };
}
