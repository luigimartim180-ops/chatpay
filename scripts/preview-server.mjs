import http from 'node:http';
import { makeRequest, redisCommand } from '../test/harness.js';

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 4173);
const DOMAIN = 'swarm-preview.test';
const PREVIEW_BANNER = '<div role="status" style="position:sticky;top:0;z-index:99999;padding:10px 16px;background:#fa0;color:#171717;font:600 13px system-ui;text-align:center">PREVIEW LOCAL · dados simulados · sem chamadas a provedores ou produção</div>';

const started = await makeRequest('POST', '/start', {
  domain: DOMAIN,
  brand: 'ChatPay AI Swarm',
  email: 'preview@example.test'
});
const startedBody = await started.json();
if (started.status !== 200 || !startedBody.token) {
  throw new Error('Não foi possível criar a sessão local de preview.');
}
const previewToken = startedBody.token;
const agents = [
  ['classifyIntent', 128], ['qualifyLead', 83], ['objectionHandler', 74],
  ['craftReply', 121], ['proofGenerator', 66], ['timingOptimizer', 48],
  ['competitorAnalyzer', 18], ['upsellArchitect', 11], ['upsellAfterPaid', 9],
  ['scheduleRecovery', 27], ['sendUpsell', 6]
];
const lastRun = new Date().toISOString();
redisCommand('HSET', 'agent:runs:' + DOMAIN, ...agents.flatMap(([name, count]) => [name, String(count)]));
redisCommand('HSET', 'agent:last:' + DOMAIN, ...agents.flatMap(([name]) => [name, lastRun]));

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('Request body exceeds local preview limit.');
    chunks.push(chunk);
  }
  if (!size) return undefined;
  const text = Buffer.concat(chunks).toString('utf8');
  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (contentType === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(text));
  }
  return JSON.parse(text);
}

function makeLocalPath(rawUrl) {
  const url = new URL(rawUrl || '/', 'http://preview.local');
  if (url.pathname === '/dash') {
    if (!url.searchParams.has('token')) url.searchParams.set('token', previewToken);
    url.searchParams.set('mode', 'demo');
  }
  return url.pathname + url.search;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://preview.local');
  if (url.pathname === '/healthz') {
    return sendJson(res, 200, { mode: 'local-preview', demo: true, externalProviders: false });
  }
  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/dash?token=' + encodeURIComponent(previewToken) + '&mode=demo', 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (url.pathname === '/dash' && (url.searchParams.get('mode') !== 'demo' || !url.searchParams.has('token'))) {
    if (!url.searchParams.has('token')) url.searchParams.set('token', previewToken);
    url.searchParams.set('mode', 'demo');
    res.writeHead(302, { Location: url.pathname + url.search, 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Midas-Key'
    });
    return res.end();
  }

  try {
    const path = makeLocalPath(req.url);
    const body = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await readBody(req);
    const safeHeaders = Object.fromEntries(Object.entries(req.headers)
      .filter(([name, value]) => value !== undefined && !['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'].includes(name.toLowerCase()))
      .map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : String(value)]));
    const response = await makeRequest(req.method || 'GET', path, body, safeHeaders);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    let payload = Buffer.from(await response.arrayBuffer());
    if (url.pathname === '/dash' && contentType.includes('text/html')) {
      let html = payload.toString('utf8');
      html = html.replace(/<body([^>]*)>/i, `<body$1>${PREVIEW_BANNER}`);
      payload = Buffer.from(html, 'utf8');
    }
    const headers = Object.fromEntries(response.headers.entries());
    headers['cache-control'] = 'no-store';
    res.writeHead(response.status, headers);
    res.end(req.method === 'HEAD' ? undefined : payload);
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500;
    sendJson(res, status, { error: status === 400 ? 'JSON inválido' : 'preview_local_error' });
    console.error('Preview request failed:', url.pathname, error.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ChatPay local preview listening on http://${HOST}:${PORT}`);
  console.log('Demo data only. Provider calls, Telegram, Redis and production are not connected.');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
