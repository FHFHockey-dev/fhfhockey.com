import type { NextApiRequest, NextApiResponse } from 'next';

interface PipelineStepResponse {
  success: boolean;
  message: string;
  step?: string;
  echo?: Record<string, any>;
}

const ALLOWED_STEPS = new Set(['backfill','train','score','upload']);

function checkAuth(req: NextApiRequest): [boolean,string] {
  const expected = process.env.SKO_PIPELINE_SECRET;
  if (!expected) return [true,'no secret configured'];
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return [false,'missing bearer token'];
  const token = auth.slice(7);
  if (token !== expected) return [false,'invalid token'];
  return [true,'ok'];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PipelineStepResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const [ok,msg] = checkAuth(req);
  if (!ok) return res.status(401).json({ success:false, message: msg });

  let payload: any = {};
  if (typeof req.body === 'string' && req.body) {
    try { payload = JSON.parse(req.body); } catch { payload = {}; }
  } else if (req.body && typeof req.body === 'object') {
    payload = req.body;
  }
  const step = (payload.step || '').trim();
  if (!step) {
    return res.status(400).json({ success:false, message: "Missing 'step' in payload" });
  }
  if (!ALLOWED_STEPS.has(step)) {
    return res.status(400).json({ success:false, message: `Unknown step '${step}'. Allowed: ${Array.from(ALLOWED_STEPS).sort().join(', ')}` });
  }
  const asOfDate = payload.asOfDate || payload.as_of_date;
  const horizon = payload.horizon;
  const seasonCutoff = payload.seasonCutoff || payload.season_cutoff;

  // Placeholder: integrate actual execution logic here.
  return res.status(200).json({
    success: true,
    message: `Accepted step '${step}'`,
    step,
    echo: { asOfDate, horizon, seasonCutoff }
  });
}
