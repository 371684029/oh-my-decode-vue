import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api';
import { PORT, HOST, CORS_ORIGIN } from './config';

const app = express();

const allowedOrigins = CORS_ORIGIN.split(',')
  .map((item) => item.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins
  })
);
app.use(express.json({ limit: '2mb' }));

app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, HOST, () => {
  console.log(`[Backend Server] Server running at http://${HOST}:${PORT}`);
});
