import { Request, Response } from 'express';
import { errorMessage } from '@lowcode/shared';
import { storageService } from '../services/storageService';
import { logDatabase } from '../db/sqlite';
import { PageSchema } from '../types/schema';
import { pageSchemaValidator, formatZodErrors } from '../validation/schemaValidation';
import { resolveOperator } from '../middleware/apiKeyAuth';
import { buildSaveLogDetails, parsePatchOps, JsonPatchError, JsonPatchOp } from '../utils/jsonPatch';
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
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: errorMessage(err) ?? '服务器内部错误' });
    }
  }

  /**
   * P1-1 增量保存：应用 RFC 6902 子集 patch 到已存 Schema。
   * v2.6.0: 读-校验-应用-写全部在写队列内完成（patchAndSave），消除并发 TOCTOU 竞态。
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

      // 空 Patch：无变更，不递增版本、不轮转备份（自测修复 #4 服务端兜底）
      if (ops.length === 0) {
        const existing = await storageService.getSchema(id, type);
        if (!existing) {
          res.status(404).json({ success: false, message: 'Schema not found' });
          return;
        }
        res.json({
          success: true,
          message: 'No changes to apply',
          unchanged: true,
          data: { id: existing.id, version: existing.meta.version }
        });
        return;
      }

      const baseVersion = req.body?.baseVersion;
      const result = await storageService.patchAndSave(
        id,
        type,
        ops,
        typeof baseVersion === 'string' ? baseVersion : undefined,
        (patched) => {
          const parsed = pageSchemaValidator.safeParse(patched);
          return parsed.success ? null : `Schema validation failed: ${formatZodErrors(parsed.error)}`;
        }
      );

      if (!result.ok) {
        if (result.code === 'NOT_FOUND') {
          res.status(404).json({ success: false, message: result.message });
        } else if (result.code === 'VERSION_CONFLICT') {
          res.status(409).json({
            success: false,
            code: 'VERSION_CONFLICT',
            message: result.message,
            data: { id, version: result.version }
          });
        } else {
          res.status(400).json({ success: false, message: result.message });
        }
        return;
      }

      const { saved, previous } = result;

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
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: errorMessage(err) ?? '服务器内部错误' });
    }
  }

  async listSchemas(req: Request, res: Response): Promise<void> {
    try {
      const type = (req.query.type as 'page' | 'component') || 'page';
      const list = await storageService.listSchemas(type);
      res.json({ success: true, data: list });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: errorMessage(err) ?? '服务器内部错误' });
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
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: errorMessage(err) ?? '服务器内部错误' });
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
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: errorMessage(err) ?? '服务器内部错误' });
    }
  }

  /** P2-2: 列出 schema 备份代数 */
  async listBackups(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const type = (req.query.type as 'page' | 'component') || 'page';
      const backups = await storageService.listBackups(id, type);
      res.json({ success: true, data: backups });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: errorMessage(err) ?? '服务器内部错误' });
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
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: errorMessage(err) ?? '服务器内部错误' });
    }
  }
}

export const schemaController = new SchemaController();
