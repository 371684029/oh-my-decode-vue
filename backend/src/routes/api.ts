import { Router } from 'express';
import { schemaController } from '../controllers/schemaController';
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

export default router;
