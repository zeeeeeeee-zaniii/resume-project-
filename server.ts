import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleAnalyzeResumeRequest } from './api/analyze-resume';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Security Headers & Privacy Hardening
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  } else {
    app.set('trust proxy', false);
  }

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      status: 'ok',
      service: 'Mihora Resume Intelligence',
      concurrency: { active: 0, queued: 0 },
      timestamp: new Date().toISOString(),
    });
  });

  // AI-Assisted Resume Screening Analysis Endpoint
  app.post('/api/analyze-resume', (req, res) => {
    handleAnalyzeResumeRequest(req, res);
  });

  // In development, mount Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve dist folder
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mihora Resume Intelligence server running on port ${PORT}`);
  });
}

startServer();
