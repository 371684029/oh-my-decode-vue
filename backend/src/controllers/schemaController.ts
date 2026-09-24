import { Request, Response } from 'express';
import { storageService, bumpVersion } from '../services/storageService';
import { logDatabase } from '../db/sqlite';
import { PageSchema } from '../types/schema';
import { pageSchemaValidator, formatZodErrors } from '../validation/schemaValidation';
import { resolveOperator } from '../middleware/apiKeyAuth';

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

      // P1-4 版本化：读取既有版本，递增并记录上一版本
      const existing = await storageService.getSchema(schema.id, schema.type);
      let prevVersion: string | undefined;
      if (existing?.meta?.version) {
        prevVersion = existing.meta.version;
        schema.meta = schema.meta ?? { author: '', description: '', version: '1.0.0' };
        schema.meta.prevVersion = prevVersion;
        schema.meta.version = bumpVersion(prevVersion);
      } else {
        schema.meta = schema.meta ?? { author: '', description: '', version: '1.0.0' };
        schema.meta.version = schema.meta.version || '1.0.0';
      }

      await storageService.saveSchema(schema);

      // 记录 SQLite 操作日志 (包含更细化的 Schema 快照概要)
      logDatabase.addLog({
        page_id: schema.id,
        action: 'SAVE_SCHEMA',
        operator: resolveOperator(req),
        details: JSON.stringify(
          {
            title: schema.title,
            nodeCount: schema.children?.length || 0,
            version: schema.meta?.version || '1.0.0',
            prevVersion: prevVersion ?? null,
            childrenSummary: schema.children?.map((c) => ({ id: c.id, type: c.type, label: c.label, layout: c.layout }))
          },
          null,
          2
        )
      });

      res.json({
        success: true,
        message: 'Schema saved successfully',
        data: { id: schema.id, version: schema.meta.version }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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
      const index = Number(req.query.backup ?? req.body?.backup ?? 1);

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
        data: { id, version: restored.meta?.version }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export const schemaController = new SchemaController();
