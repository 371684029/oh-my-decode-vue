import { Router } from 'express';
import { schemaController } from '../controllers/schemaController';
import { materialController } from '../controllers/materialController';
import { apiKeyAuth } from '../middleware/apiKeyAuth';

const router = Router();

// 全路由启用 X-Api-Key 认证（环境变量 API_KEY 配置后生效）
router.use(apiKeyAuth);

router.get('/schemas', (req, res) => schemaController.listSchemas(req, res));
router.get('/schemas/:id', (req, res) => schemaController.getSchema(req, res));
router.post('/schemas', (req, res) => schemaController.saveSchema(req, res));
router.delete('/schemas/:id', (req, res) => schemaController.deleteSchema(req, res));
router.get('/logs', (req, res) => schemaController.getLogs(req, res));
router.get('/schemas/:id/backups', (req, res) => schemaController.listBackups(req, res));
router.post('/schemas/:id/restore', (req, res) => schemaController.restoreBackup(req, res));

// 物料 Manifest CRUD (v2.0.0)
router.get('/materials', (req, res) => materialController.listMaterials(req, res));
router.post('/materials', (req, res) => materialController.saveMaterial(req, res));
router.get('/materials/:id', (req, res) => materialController.getMaterial(req, res));
router.delete('/materials/:id', (req, res) => materialController.deleteMaterial(req, res));

// 物料版本管理 (v2.1.0)
router.get('/materials/:id/refs', (req, res) => materialController.getRefs(req, res));
router.put('/materials/:id/draft', (req, res) => materialController.saveDraft(req, res));
router.delete('/materials/:id/draft', (req, res) => materialController.discardDraft(req, res));
router.post('/materials/:id/versions', (req, res) => materialController.publishVersion(req, res));
router.get('/materials/:id/versions', (req, res) => materialController.listVersions(req, res));
router.get('/materials/:id/versions/:v', (req, res) => materialController.getVersion(req, res));
router.get('/materials/:id/versions/:v/diff', (req, res) => materialController.diffVersions(req, res));
router.post('/materials/:id/rollback', (req, res) => materialController.rollback(req, res));
router.delete('/materials/:id/versions/:v', (req, res) => materialController.archiveVersion(req, res));
router.post('/materials/:id/fork', (req, res) => materialController.forkMaterial(req, res));
router.post('/pages/upgrade-material', (req, res) => materialController.upgradeInstances(req, res));

export default router;
