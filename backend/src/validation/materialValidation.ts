import { z } from 'zod';
import { componentNodeSchema, formatZodErrors, safeIdSchema } from './schemaValidation';

export { formatZodErrors };

/**
 * 物料 Manifest 落盘强校验 (v2.0.0 / v2.1.0)
 * - type 必须为 custom- 前缀，与内置物料物理隔离
 * - label / summary / schema 节点数 / 嵌套深度 上限约束
 */

const materialTypeSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^custom-[A-Za-z0-9_-]+$/, 'material type must start with "custom-" and contain only letters, numbers, "_" and "-"');

/** 递归计算 schema 树最大嵌套深度（节点层数：叶子 = 1） */
function maxDepth(nodes: any[] | undefined, depth = 1): number {
  if (!nodes || nodes.length === 0) return depth;
  let deepest = depth;
  for (const node of nodes) {
    const childDepth = node?.children ? maxDepth(node.children, depth + 1) : depth;
    deepest = Math.max(deepest, childDepth);
  }
  return deepest;
}

// ============================================================
// v2.1.0 契约校验
// ============================================================

const materialInputSchema = z.object({
  name: z.string().min(1).max(50),
  label: z.string().max(50),
  type: z.enum(['string', 'number', 'boolean', 'expression', 'data']),
  nodeId: safeIdSchema,
  fieldPath: z.string().max(200),
  required: z.boolean(),
  default: z.unknown().optional()
});

const materialOutputSchema = z.object({
  name: z.string().min(1).max(50),
  label: z.string().max(50),
  nodeId: safeIdSchema,
  event: z.string().max(100)
});

export const materialContractSchema = z.object({
  inputs: z.array(materialInputSchema).max(50).default([]),
  outputs: z.array(materialOutputSchema).max(50).default([])
});

export const materialManifestValidator = z
  .object({
    type: materialTypeSchema,
    label: z.string().min(1).max(50),
    icon: z.string().max(100),
    category: z.enum(['pro', 'element', 'layout']),
    defaultLayout: z.object({
      w: z.number(),
      h: z.number()
    }),
    defaultProps: z.record(z.string(), z.unknown()).default({}),
    defaultAttrs: z.record(z.string(), z.unknown()).default({}),
    defaultConfig: z.record(z.string(), z.unknown()).optional(),
    kind: z.enum(['atomic', 'composite']),
    schema: z.array(componentNodeSchema).max(200).optional(),
    summary: z.array(z.string().max(100)).max(50).optional(),
    // v2.1.0 版本管理字段
    contract: materialContractSchema.optional(),
    currentVersion: z.string().max(50).optional(),
    versions: z.record(z.string(), z.unknown()).optional(),
    refCount: z.number().optional()
  })
  .superRefine((manifest, ctx) => {
    const carriesContract = Boolean(manifest.contract);
    // 复合物料：或携带 schema 快照（v2.0 原子注册），或携带契约（v2.1 黑盒注册）
    if (
      manifest.kind === 'composite' &&
      (!manifest.schema || manifest.schema.length === 0) &&
      !carriesContract
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['schema'],
        message: 'composite material must carry a non-empty schema snapshot'
      });
    }
    if (manifest.schema && maxDepth(manifest.schema) > 5) {
      ctx.addIssue({
        code: 'custom',
        path: ['schema'],
        message: 'schema nesting depth exceeds limit of 5'
      });
    }
  });

export type ValidatedMaterialManifest = z.infer<typeof materialManifestValidator>;

// ============================================================
// v2.1.0 版本校验
// ============================================================

export const materialVersionValidator = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'semver required'),
  schema: z.array(componentNodeSchema).max(200),
  contract: materialContractSchema,
  contractSignature: z.string().max(100),
  summary: z.array(z.string().max(100)).max(50).default([]),
  changelog: z.string().max(500).default(''),
  publishedAt: z.string().max(50).default(''),
  releasedBy: z.string().max(100).default('')
});

export type ValidatedMaterialVersion = z.infer<typeof materialVersionValidator>;
