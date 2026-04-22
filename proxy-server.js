const express = require('express');
const axios   = require('axios');
const cors    = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// ══ Proxy لـ MikroTik REST API ══
app.all('/mikrotik/*', async (req, res) => {
  const { host, user, pass } = req.query;
  if(!host||!user||!pass) return res.status(400).json({error:'host, user, pass مطلوبة'});

  const isCloud = host.includes('.mynetname.net')||host.includes('.cloud');
  const proto   = isCloud ? 'https' : 'http';
  const path    = req.path.replace('/mikrotik','');
  const url     = `${proto}://${host}/rest${path}`;

  try {
    const resp = await axios({
      method:  req.method,
      url,
      auth:    { username: user, password: pass },
      data:    req.method!=='GET' ? req.body : undefined,
      timeout: 10000,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });
    res.json(resp.data);
  } catch(e) {
    const status = e.response?.status||500;
    const msg    = e.response?.data||e.message;
    res.status(status).json({ error: msg });
  }
});

app.get('/', (_,res) => res.json({ status:'NetPro MikroTik Proxy ✅' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Proxy running on port ${PORT}`));
