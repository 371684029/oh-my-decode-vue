import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api';
import { PORT } from './config';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Backend Server] Server running at http://localhost:${PORT}`);
});
