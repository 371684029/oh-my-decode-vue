import type { PageSchema } from '../types/designer';
import { planSchemaSave } from './frontendApi';
import type { JsonPatchOp } from './jsonPatch';

/**
 * 保存编排（v2.4.0 自测修复 #2/#3/#4）：
 * - #2 基线以「提交时快照」为准：调用方传入已冻结的 submitted，返回的 baseline 为深拷贝，
 *   请求在途期间的后续编辑不会被吸收进基线。
 * - #3 PATCH 携带 baseVersion（乐观并发）；409 版本冲突或任意 PATCH 失败一次 → 回退全量 POST。
 * - #4 无变更（空 ops）→ 跳过保存，不产生版本递增与备份轮转。
 */

/** 保存接口返回的服务端元信息（版本递增由后端完成） */
export interface SaveResponseMeta {
  version?: string;
}

export interface SaveDeps {
  post: (schema: PageSchema) => Promise<SaveResponseMeta>;
  patch: (id: string, ops: JsonPatchOp[], baseVersion: string) => Promise<SaveResponseMeta>;
}

export interface SaveOutcome {
  mode: 'skip' | 'patch' | 'full';
  /** 下一次增量保存的基线：提交时快照 + 服务端版本回填 */
  baseline: PageSchema;
}

function cloneSchema(schema: PageSchema): PageSchema {
  return JSON.parse(JSON.stringify(schema)) as PageSchema;
}

/** 基线 = 提交快照的深拷贝 + 服务端递增后的版本号回填 */
function withServerVersion(submitted: PageSchema, meta: SaveResponseMeta | undefined): PageSchema {
  const next = cloneSchema(submitted);
  if (meta?.version && meta.version !== next.meta.version) {
    next.meta.prevVersion = next.meta.version;
    next.meta.version = meta.version;
  }
  return next;
}

/**
 * 保存编排：按 planSchemaSave 的决策提交，返回（或跳过）下一次增量保存的基线。
 * 仅当最终的全量 POST 也失败时抛出错误（由调用方展示）。
 */
export async function saveSchemaWithFallback(
  submitted: PageSchema,
  lastSaved: PageSchema | null,
  deps: SaveDeps
): Promise<SaveOutcome> {
  const plan = planSchemaSave(lastSaved, submitted);
  if (plan.mode === 'skip') {
    return { mode: 'skip', baseline: lastSaved ? cloneSchema(lastSaved) : cloneSchema(submitted) };
  }
  if (plan.mode === 'patch') {
    try {
      const meta = await deps.patch(plan.id, plan.ops, plan.baseVersion);
      return { mode: 'patch', baseline: withServerVersion(submitted, meta) };
    } catch {
      // 409 版本冲突（并发保存 / 还原覆盖）或 PATCH 任意失败一次：都回退全量 POST
    }
  }
  const meta = await deps.post(submitted);
  return { mode: 'full', baseline: withServerVersion(submitted, meta) };
}
