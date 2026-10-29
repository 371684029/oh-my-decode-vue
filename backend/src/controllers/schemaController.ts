import { Request, Response } from 'express';
import { storageService, toSafeFileId } from '../services/storageService';
import { logDatabase } from '../db/sqlite';
import { PageSchema } from '../types/schema';
import { pageSchemaValidator, formatZodErrors } from '../validation/schemaValidation';
import { resolveOperator } from '../middleware/apiKeyAuth';
import { buildSaveLogDetails, applyPatch, parsePatchOps, JsonPatchError, JsonPatchOp } from '../utils/jsonPatch';
import { parseRestoreIndex } from '../utils/restoreIndex';

export class SchemaController {
  async saveSchema(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ success: false, message: 'Invalid request body' });
        return;
      }

      // Schema 结构强校验：落盘前完整校验，并限制脚本/HTML 字段长度
      const parsed = pageSchemaValidator.safeParse(body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: `Schema validation failed: ${formatZodErrors(parsed.error)}`
        });
        return;
      }

      const schema = parsed.data as PageSchema;
      const { saved, previous } = await storageService.saveVersioned(schema);

      logDatabase.addLog({
        page_id: saved.id,
        action: 'SAVE_SCHEMA',
        operator: resolveOperator(req),
        details: JSON.stringify(
          buildSaveLogDetails({
            title: saved.title,
            nodeCount: saved.children?.length || 0,
            version: saved.meta?.version || '1.0.0',
            prevVersion: saved.meta?.prevVersion,
            previous,
            saved
          })
        )
      });

      res.json({
        success: true,
        message: 'Schema saved successfully',
        data: { id: saved.id, version: saved.meta.version }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * P1-1 增量保存：应用 RFC 6902 子集 patch 到已存 Schema，
   * 落盘前与 POST 同一 Zod 校验，审计记录保存差异 + 客户端提交的 ops。
   */
  async patchSchema(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const type = (req.query.type as 'page' | 'component') || 'page';

      let ops: JsonPatchOp[];
      try {
        ops = parsePatchOps(req.body?.ops);
      } catch (err) {
        const message = err instanceof JsonPatchError ? err.message : 'Invalid request body';
        res.status(400).json({ success: false, message });
        return;
      }

      const existing = await storageService.getSchema(id, type);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Schema not found' });
        return;
      }

      // 空 Patch：无变更，不递增版本、不轮转备份（自测修复 #4 服务端兜底）
      if (ops.length === 0) {
        res.json({
          success: true,
          message: 'No changes to apply',
          unchanged: true,
          data: { id: existing.id, version: existing.meta.version }
        });
        return;
      }

      // 乐观并发（自测修复 #3）：客户端基线版本与已存版本不符 → 409，客户端回退全量 POST
      const baseVersion = req.body?.baseVersion;
      if (typeof baseVersion === 'string' && baseVersion !== existing.meta.version) {
        res.status(409).json({
          success: false,
          code: 'VERSION_CONFLICT',
          message: `Schema version conflict: base ${baseVersion} != stored ${existing.meta.version}`,
          data: { id: existing.id, version: existing.meta.version }
        });
        return;
      }

      let patched: PageSchema;
      try {
        patched = applyPatch(existing, ops);
      } catch (err) {
        const message = err instanceof JsonPatchError ? err.message : 'Failed to apply patch';
        res.status(400).json({ success: false, message });
        return;
      }

      // 身份字段不允许被 patch 改写：文件按 URL id + 已存 type 落盘
      if (patched.id !== toSafeFileId(id) || patched.type !== existing.type) {
        res.status(400).json({ success: false, message: 'Patch must not change schema id or type' });
        return;
      }

      // 与 POST 同一校验器：patch 结果不合法直接 400，不落盘
      const parsed = pageSchemaValidator.safeParse(patched);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: `Schema validation failed: ${formatZodErrors(parsed.error)}`
        });
        return;
      }

      const schema = parsed.data as PageSchema;
      const { saved, previous } = await storageService.saveVersioned(schema);

      logDatabase.addLog({
        page_id: saved.id,
        action: 'PATCH_SCHEMA',
        operator: resolveOperator(req),
        details: JSON.stringify(
          buildSaveLogDetails({
            title: saved.title,
            nodeCount: saved.children?.length || 0,
            version: saved.meta?.version || '1.0.0',
            prevVersion: saved.meta?.prevVersion,
            previous,
            saved,
            incomingOps: ops
          })
        )
      });

      res.json({
        success: true,
        message: 'Schema patched successfully',
        data: { id: saved.id, version: saved.meta.version }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  }

  async getSchema(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const type = (req.query.type as 'page' | 'component') || 'page';

      const schema = await storageService.getSchema(id, type);
      if (!schema) {
        res.status(404).json({ success: false, message: 'Schema not found' });
        return;
      }

      res.json({ success: true, data: schema });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async listSchemas(req: Request, res: Response): Promise<void> {
    try {
      const type = (req.query.type as 'page' | 'component') || 'page';
      const list = await storageService.listSchemas(type);
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteSchema(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const type = (req.query.type as 'page' | 'component') || 'page';

      const ok = await storageService.deleteSchema(id, type);
      if (!ok) {
        res.status(404).json({ success: false, message: 'Delete failed, schema file not found' });
        return;
      }

      logDatabase.addLog({
        page_id: id,
        action: 'DELETE_SCHEMA',
        operator: resolveOperator(req),
        details: JSON.stringify({ type })
      });

      res.json({ success: true, message: 'Schema deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const { pageId } = req.query;
      if (pageId) {
        const logs = logDatabase.getLogsByPageId(String(pageId));
        res.json({ success: true, data: logs });
      } else {
        const logs = logDatabase.getAllLogs();
        res.json({ success: true, data: logs });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** P2-2: 列出 schema 备份代数 */
  async listBackups(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const type = (req.query.type as 'page' | 'component') || 'page';
      const backups = await storageService.listBackups(id, type);
      res.json({ success: true, data: backups });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** P2-2 / P1-4: 从指定备份代恢复 */
  async restoreBackup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const type = (req.query.type as 'page' | 'component') || 'page';
      const index = parseRestoreIndex(req.body, req.query);

      const restored = await storageService.restoreBackup(id, type, index);
      if (!restored) {
        res.status(404).json({ success: false, message: `Backup #${index} not found` });
        return;
      }

      logDatabase.addLog({
        page_id: id,
        action: 'RESTORE_BACKUP',
        operator: resolveOperator(req),
        details: JSON.stringify({ type, backupIndex: index, version: restored.meta?.version })
      });

      res.json({
        success: true,
        message: 'Schema restored from backup',
        data: restored
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export const schemaController = new SchemaController();
