import { handleAnalyzeResumeRequest, getHealthStatus } from '../src/server/analysis-handler';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  const url = req.url || '';

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (url.includes('health') || (req.method === 'GET' && !url.includes('analyze'))) {
    return getHealthStatus(req, res);
  }

  if (url.includes('analyze-resume') || req.method === 'POST') {
    return handleAnalyzeResumeRequest(req, res);
  }

  return res.status(200).json({
    service: 'Mihora Resume Intelligence API',
    status: 'online',
  });
}
