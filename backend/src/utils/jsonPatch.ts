/** JSON Patch 核心统一在 @lowcode/shared（v2.5.0 #5）；本文件仅保留后端审计细节构造。 */
import { createPatch, type JsonPatchOp } from '@lowcode/shared';

export { applyPatch, createPatch, invertPatch, JsonPatchError, parsePatchOps } from '@lowcode/shared';
export type { JsonPatchOp } from '@lowcode/shared';

export function buildSaveLogDetails(input: {
  title: string;
  nodeCount: number;
  version: string;
  prevVersion?: string;
  previous: unknown | null;
  saved: unknown;
  /** 增量保存时客户端提交的原始 patch ops，一并记入审计 */
  incomingOps?: JsonPatchOp[];
}): Record<string, unknown> {
  let details: Record<string, unknown>;
  if (!input.previous) {
    details = {
      title: input.title,
      nodeCount: input.nodeCount,
      version: input.version,
      prevVersion: null,
      initial: true
    };
  } else {
    const patch = createPatch(input.previous, input.saved);
    const truncated = patch.length > 200;
    details = {
      title: input.title,
      nodeCount: input.nodeCount,
      version: input.version,
      prevVersion: input.prevVersion ?? null,
      initial: false,
      truncated,
      patch: truncated ? patch.slice(0, 200) : patch
    };
  }
  if (input.incomingOps) {
    details.incomingOps = input.incomingOps;
  }
  return details;
}
