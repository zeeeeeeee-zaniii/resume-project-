export default function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    service: 'Mihora Resume Intelligence API',
    status: 'online',
    endpoints: ['/api/health', '/api/analyze-resume'],
    timestamp: new Date().toISOString(),
  });
}
