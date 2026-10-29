/** JSON Patch 核心统一在 @lowcode/shared（v2.5.0 #5）；此处保留兼容既有 import 路径的转发。 */
export { applyPatch, createPatch, invertPatch, JsonPatchError, parsePatchOps } from '@lowcode/shared';
export type { JsonPatchOp } from '@lowcode/shared';
