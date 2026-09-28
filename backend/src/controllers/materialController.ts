import { Request, Response } from 'express';
import { materialService } from '../services/materialService';
import { materialVersionService } from '../services/materialVersionService';
import { scanMaterialRefs } from '../services/materialRefScan';
import { upgradeMaterialInstances } from '../services/pageUpgradeService';
import { logDatabase } from '../db/sqlite';
import { materialManifestValidator, materialVersionValidator, formatZodErrors } from '../validation/materialValidation';
import { resolveOperator } from '../middleware/apiKeyAuth';
import { createPatch } from '../utils/jsonPatch';
import { classifyVersionChange } from '../utils/versionClassify';
import type { MaterialManifest, MaterialVersion } from '../types/schema';

/**
 * 物料 Manifest CRUD 控制器 (v2.0.0)
 * 对齐 schemaController 的 try/catch + Zod 校验 + SQLite 审计模式
 */
export class MaterialController {
  async listMaterials(req: Request, res: Response): Promise<void> {
    try {
      const list = await materialService.listMaterials();
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async saveMaterial(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ success: false, message: 'Invalid request body' });
        return;
      }

      const parsed = materialManifestValidator.safeParse(body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: `Material validation failed: ${formatZodErrors(parsed.error)}`
        });
        return;
      }

      const manifest = parsed.data as MaterialManifest;
      // v2.1 黑盒物料（携带契约）→ 目录结构 + 首个版本；v2.0 原子 → 单文件
      if (manifest.kind === 'composite' && manifest.contract) {
        await materialVersionService.registerWithVersion(manifest, manifest.currentVersion || '1.0.0');
      } else {
        await materialService.saveMaterial(manifest);
      }

      logDatabase.addLog({
        page_id: manifest.type,
        action: 'SAVE_MATERIAL',
        operator: resolveOperator(req),
        details: JSON.stringify({
          label: manifest.label,
          kind: manifest.kind,
          nodeCount: manifest.schema?.length || 0,
          blackbox: Boolean(manifest.contract)
        })
      });

      res.json({ success: true, message: 'Material saved successfully', data: { type: manifest.type } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const manifest = await materialService.getMaterial(id);
      if (!manifest) {
        res.status(404).json({ success: false, message: 'Material not found' });
        return;
      }
      res.json({ success: true, data: manifest });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // 引用复核：被引用时阻止，除非 force=true（前端已强确认）
      const refs = await scanMaterialRefs(id);
      if (refs.count > 0 && req.query.force !== 'true') {
        res.status(409).json({
          success: false,
          message: `物料被 ${refs.count} 个实例引用（${refs.pages.length} 个页面），删除后实例将渲染占位`,
          data: { refs }
        });
        return;
      }
      const ok = await materialService.deleteMaterial(id);
      if (!ok) {
        const manifest = await materialVersionService.getManifest(id);
        if (!manifest) {
          res.status(404).json({ success: false, message: 'Delete failed, material not found' });
          return;
        }
      }
      await materialVersionService.deleteMaterial(id);

      logDatabase.addLog({
        page_id: id,
        action: 'DELETE_MATERIAL',
        operator: resolveOperator(req),
        details: JSON.stringify({ type: 'material', refCount: refs.count })
      });

      res.json({ success: true, message: 'Material deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // v2.1.0 版本管理端点
  // ============================================================

  /** 引用统计 */
  async getRefs(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const refs = await scanMaterialRefs(id);
      res.json({ success: true, data: refs });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** 保存草稿（编辑态，不产生版本） */
  async saveDraft(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = materialVersionValidator.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: `Draft validation failed: ${formatZodErrors(parsed.error)}` });
        return;
      }
      await materialVersionService.saveDraft(id, parsed.data as MaterialVersion);
      logDatabase.addLog({
        page_id: id,
        action: 'SAVE_MATERIAL_DRAFT',
        operator: resolveOperator(req),
        details: JSON.stringify({ version: parsed.data.version })
      });
      res.json({ success: true, message: 'Draft saved' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** 丢弃草稿 */
  async discardDraft(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await materialVersionService.discardDraft(id);
      logDatabase.addLog({
        page_id: id,
        action: 'DISCARD_MATERIAL_DRAFT',
        operator: resolveOperator(req),
        details: JSON.stringify({})
      });
      res.json({ success: true, message: 'Draft discarded' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** 发布：draft → 不可变版本（服务端判定建议版本号） */
  async publishVersion(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const parsed = materialVersionValidator.safeParse(body.draft);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: `Draft validation failed: ${formatZodErrors(parsed.error)}` });
        return;
      }
      const result = await materialVersionService.publish(id, parsed.data as MaterialVersion, body.suggestedVersion);
      logDatabase.addLog({
        page_id: id,
        action: 'PUBLISH_MATERIAL_VERSION',
        operator: resolveOperator(req),
        details: JSON.stringify({ version: result.version, bump: result.bump, changelog: result.changelog })
      });
      res.json({ success: true, message: 'Version published', data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** 版本列表（索引元信息） */
  async listVersions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const versions = await materialVersionService.listVersions(id);
      res.json({ success: true, data: versions });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** 指定版本详情 */
  async getVersion(req: Request, res: Response): Promise<void> {
    try {
      const { id, v } = req.params;
      const version = await materialVersionService.getVersion(id, v);
      if (!version) {
        res.status(404).json({ success: false, message: `Version not found: ${id}@${v}` });
        return;
      }
      res.json({ success: true, data: version });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** 两版本差异（契约层 + 结构层） */
  async diffVersions(req: Request, res: Response): Promise<void> {
    try {
      const { id, v } = req.params;
      const base = String(req.query.base || '');
      const current = await materialVersionService.getVersion(id, v);
      const prev = await materialVersionService.getVersion(id, base);
      if (!current || !prev) {
        res.status(404).json({ success: false, message: 'Version not found for diff' });
        return;
      }
      const contractDiff = createPatch(prev.contract, current.contract);
      const schemaDiff = createPatch(prev.schema, current.schema);
      res.json({
        success: true,
        data: {
          base,
          target: v,
          bump: classifyVersionChange(prev, current).bump,
          contractSignatures: { base: prev.contractSignature, target: current.contractSignature },
          contractDiff,
          schemaDiff
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** 回滚：历史版本设为当前（实例不动） */
  async rollback(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { version } = req.body || {};
      if (typeof version !== 'string') {
        res.status(400).json({ success: false, message: 'body.version required' });
        return;
      }
      const result = await materialVersionService.setCurrent(id, version);
      logDatabase.addLog({
        page_id: id,
        action: 'ROLLBACK_MATERIAL',
        operator: resolveOperator(req),
        details: JSON.stringify({ version })
      });
      res.json({ success: true, message: 'Rolled back', data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** 归档版本（被引用需复核，当前版本不可归档） */
  async archiveVersion(req: Request, res: Response): Promise<void> {
    try {
      const { id, v } = req.params;
      const refs = await scanMaterialRefs(id);
      const locked = await materialVersionService.listVersions(id);
      const refsOnVersion = locked.find((m) => m.version === v)?.refCount ?? 0;
      if (refsOnVersion > 0 || (refs.count > 0 && req.query.force !== 'true')) {
        res.status(409).json({
          success: false,
          message: `版本 ${v} 被引用，归档后实例将回退当前版本`,
          data: { refs }
        });
        return;
      }
      await materialVersionService.archiveVersion(id, v);
      logDatabase.addLog({
        page_id: id,
        action: 'ARCHIVE_MATERIAL_VERSION',
        operator: resolveOperator(req),
        details: JSON.stringify({ version: v })
      });
      res.json({ success: true, message: 'Version archived' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** fork：从指定版本派生新物料 */
  async forkMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { fromVersion, newType, label, icon } = req.body || {};
      if (typeof fromVersion !== 'string' || typeof newType !== 'string' || typeof label !== 'string') {
        res.status(400).json({ success: false, message: 'fromVersion/newType/label required' });
        return;
      }
      const manifest = await materialVersionService.fork(id, fromVersion, newType, label, icon || 'Box');
      logDatabase.addLog({
        page_id: id,
        action: 'FORK_MATERIAL',
        operator: resolveOperator(req),
        details: JSON.stringify({ fromVersion, newType })
      });
      res.json({ success: true, message: 'Material forked', data: manifest });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** 批量升级：改写页面中引用某物料旧版本的实例 */
  async upgradeInstances(req: Request, res: Response): Promise<void> {
    try {
      const { materialId, fromVersion, toVersion } = req.body || {};
      if (typeof materialId !== 'string' || typeof fromVersion !== 'string' || typeof toVersion !== 'string') {
        res.status(400).json({ success: false, message: 'materialId/fromVersion/toVersion required' });
        return;
      }
      const results = await upgradeMaterialInstances({ materialId, fromVersion, toVersion });
      logDatabase.addLog({
        page_id: materialId,
        action: 'UPGRADE_MATERIAL_INSTANCES',
        operator: resolveOperator(req),
        details: JSON.stringify({ fromVersion, toVersion, pageCount: results.length })
      });
      res.json({ success: true, data: results });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export const materialController = new MaterialController();
