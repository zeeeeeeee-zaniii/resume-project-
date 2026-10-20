export * from '../../api/analyze-resume';

export function getHealthStatus(_req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    status: 'ok',
    service: 'Mihora Resume Intelligence',
    concurrency: {
      active: 0,
      queued: 0,
    },
    timestamp: new Date().toISOString(),
  });
}
