import { Request, Response } from 'express';
import { storageService } from '../services/storageService';
import { logDatabase } from '../db/sqlite';
import { PageSchema } from '../types/schema';
import { pageSchemaValidator, formatZodErrors } from '../validation/schemaValidation';
import { resolveOperator } from '../middleware/apiKeyAuth';
import { buildSaveLogDetails } from '../utils/jsonPatch';
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
