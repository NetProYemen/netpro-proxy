const express = require('express');
const cors    = require('cors');
const https   = require('https');
const http    = require('http');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (_, res) => res.json({ status: 'NetPro Proxy OK', version: '2.0' }));

app.all('/mikrotik*', (req, res) => {
  const { host, user, pass, port } = req.query;
  if (!host || !user || !pass) return res.status(400).json({ error: 'host, user, pass required' });

  const endpoint  = req.path.replace('/mikrotik', '') || '/system/resource';
  const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  // دائماً HTTP port 80 — MikroTik www service
  const targetPort = Number(port) || 80;
  const targetUrl  = `http://${cleanHost}:${targetPort}/rest${endpoint}`;

  console.log(`[Proxy] ${req.method} ${targetUrl}`);

  const auth = Buffer.from(`${user}:${pass}`).toString('base64');

  const options = {
    method:  req.method,
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    timeout: 12000,
  };

  const proxyReq = http.request(targetUrl, options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', c => data += c);
    proxyRes.on('end', () => {
      res.status(proxyRes.statusCode).set('Content-Type','application/json');
      try { res.json(JSON.parse(data)); } catch { res.send(data); }
    });
  });

  proxyReq.on('error', e => {
    console.error('[Error]', e.message);
    res.status(502).json({ error: e.message, url: targetUrl });
  });
  proxyReq.on('timeout', () => { proxyReq.destroy(); res.status(504).json({ error: 'timeout' }); });
  if (req.method !== 'GET' && req.body) proxyReq.write(JSON.stringify(req.body));
  proxyReq.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy v2 on port ${PORT}`));
