const express = require('express');
const cors    = require('cors');
const https   = require('https');
const http    = require('http');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (_, res) => res.json({ status: 'NetPro Proxy OK', version: '1.0' }));

app.all('/mikrotik*', (req, res) => {
  const { host, user, pass } = req.query;
  if (!host || !user || !pass) return res.status(400).json({ error: 'host, user, pass required' });

  const endpoint  = req.path.replace('/mikrotik', '') || '/system/resource';
  const isCloud   = host.includes('.mynetname.net') || host.includes('.cloud');
  const proto     = isCloud ? 'https' : 'http';
  const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const targetUrl = `${proto}://${cleanHost}/rest${endpoint}`;

  console.log(`[Proxy] ${req.method} ${targetUrl}`);

  const auth = Buffer.from(`${user}:${pass}`).toString('base64');
  const lib  = proto === 'https' ? https : http;

  const options = {
    method: req.method,
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    rejectUnauthorized: false,
    timeout: 12000,
  };

  const proxyReq = lib.request(targetUrl, options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', c => data += c);
    proxyRes.on('end', () => {
      res.status(proxyRes.statusCode).set('Content-Type','application/json');
      try { res.json(JSON.parse(data)); } catch { res.send(data); }
    });
  });

  proxyReq.on('error', e => res.status(502).json({ error: e.message }));
  proxyReq.on('timeout', () => { proxyReq.destroy(); res.status(504).json({ error: 'timeout' }); });
  if (req.method !== 'GET' && req.body) proxyReq.write(JSON.stringify(req.body));
  proxyReq.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy on port ${PORT}`));
