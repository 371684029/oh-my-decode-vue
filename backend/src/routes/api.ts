import { Router } from 'express';
import { schemaController } from '../controllers/schemaController';

const router = Router();

router.get('/schemas', (req, res) => schemaController.listSchemas(req, res));
router.get('/schemas/:id', (req, res) => schemaController.getSchema(req, res));
router.post('/schemas', (req, res) => schemaController.saveSchema(req, res));
router.delete('/schemas/:id', (req, res) => schemaController.deleteSchema(req, res));
router.get('/logs', (req, res) => schemaController.getLogs(req, res));

export default router;
