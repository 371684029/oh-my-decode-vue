import fs from 'fs/promises';
import path from 'path';
import { STORAGE_PAGES_DIR } from '../config';
import { storageService } from './storageService';
import type { ComponentNode, PageSchema } from '../types/schema';

function walkNodes(nodes: ComponentNode[], out: ComponentNode[]): void {
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) walkNodes(n.children, out);
  }
}

function collectAllNodes(schema: PageSchema): ComponentNode[] {
  const out: ComponentNode[] = [];
  walkNodes(schema.children || [], out);
  for (const layer of schema.layers || []) walkNodes(layer.children || [], out);
  return out;
}

export interface UpgradeResult {
  pageId: string;
  updated: number;
  failed?: string;
}

/**
 * 批量升级 (v2.1.0)
 * 扫描页面，把引用某物料 fromVersion 的黑盒实例改写为 toVersion。
 * 逐页走 storageService.saveVersioned 落盘（版本递增 + 审计）。
 * follow 非 pin 的实例跳过（由解析层自动跟随）。
 */
export async function upgradeMaterialInstances(opts: {
  materialId: string;
  fromVersion: string;
  toVersion: string;
}): Promise<UpgradeResult[]> {
  const { materialId, fromVersion, toVersion } = opts;
  const results: UpgradeResult[] = [];
  let files: string[] = [];
  try {
    files = await fs.readdir(STORAGE_PAGES_DIR);
  } catch {
    return results;
  }

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await fs.readFile(path.join(STORAGE_PAGES_DIR, file), 'utf-8');
      const schema = JSON.parse(content) as PageSchema;
      const nodes = collectAllNodes(schema);
      let updated = 0;
      for (const node of nodes) {
        const ref = node.materialRef;
        if (!ref || ref.id !== materialId) continue;
        if (ref.version !== fromVersion) continue;
        if (ref.follow && ref.follow !== 'pin') continue; // follow 实例由解析层自动跟随
        ref.version = toVersion;
        updated++;
      }
      if (updated > 0) {
        await storageService.saveVersioned(schema);
        results.push({ pageId: schema.id, updated });
      }
    } catch (err: any) {
      results.push({ pageId: file.replace(/\.json$/, ''), updated: 0, failed: err?.message || '读取失败' });
    }
  }
  return results;
}
