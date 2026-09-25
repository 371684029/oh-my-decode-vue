import { z } from 'zod';

/**
 * Schema 落盘强校验 (Zod)
 * 在写入本地 .json 文件前对 PageSchema 结构做完整校验，
 * 并对自定义脚本/HTML 字段做长度上限约束，防止异常/超大负载落盘。
 */

/** 文件名与生成标识符：拒绝路径分隔符与 `..` */
const safeIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, 'only letters, numbers, "_" and "-" are allowed');

const layoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  i: safeIdSchema
});

// 自引用节点 schema（嵌套容器 children）
const actionNodeSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['reload_data', 'open_dialog', 'close_dialog', 'toggle_loading', 'show_message', 'set_state']),
  target: z.string().max(200).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  when: z.string().max(500).optional()
});

const eventRuleSchema = z.object({
  enabled: z.boolean(),
  actions: z.array(actionNodeSchema).default([])
});

const apiBindingSchema = z.object({
  url: z.string().min(1).max(2000),
  method: z.enum(['GET', 'POST']).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  autoFetch: z.boolean().optional(),
  responsePath: z.string().max(500).optional(),
  totalProp: z.string().max(500).optional(),
  example: z.unknown().optional()
});

const componentNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: safeIdSchema,
    type: z.string().min(1).max(100),
    label: z.string().max(200),
    layout: layoutSchema,
    props: z.record(z.string(), z.unknown()).default({}),
    attrs: z.record(z.string(), z.unknown()).default({}),
    config: z.record(z.string(), z.unknown()).optional(),
    style: z.record(z.string(), z.unknown()).default({}),
    events: z.record(z.string(), eventRuleSchema).default({}),
    apiBinding: apiBindingSchema.optional(),
    visibleWhen: z.string().max(500).optional(),
    children: z.array(componentNodeSchema).optional()
  })
);

const layerPropsSchema = z.object({
  title: z.string().max(200).optional(),
  width: z.string().max(50).optional(),
  loadingText: z.string().max(500).optional(),
  htmlCode: z.string().max(50000).optional(),
  cssCode: z.string().max(50000).optional(),
  scriptMounted: z.string().max(20000).optional(),
  scriptUpdated: z.string().max(20000).optional(),
  scriptUnmounted: z.string().max(20000).optional()
});

const layerConfigSchema = z.object({
  id: safeIdSchema,
  name: z.string().max(200),
  type: z.enum(['canvas', 'dialog', 'loading', 'custom-html']),
  visible: z.boolean(),
  zIndex: z.number(),
  props: layerPropsSchema.optional(),
  children: z.array(componentNodeSchema).default([])
});

export const pageSchemaValidator = z.object({
  id: safeIdSchema,
  title: z.string().max(200),
  type: z.enum(['page', 'component']),
  meta: z.object({
    author: z.string().max(200),
    description: z.string().max(2000),
    version: z.string().max(50),
    prevVersion: z.string().max(50).optional()
  }),
  state: z.record(z.string(), z.unknown()).default({}),
  children: z.array(componentNodeSchema).default([]),
  layers: z.array(layerConfigSchema).optional()
});

export type ValidatedPageSchema = z.infer<typeof pageSchemaValidator>;

/** 将 zod 校验错误格式化为可读字符串 */
export function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
}
