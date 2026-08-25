const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.PORT || 10000);
const API_HOST = '127.0.0.1';
const API_PORT = 4010;
const distRoot = path.join(__dirname, 'frontend-dist');
const browserRoot = path.join(distRoot, 'browser');
const staticRoot = fs.existsSync(path.join(browserRoot, 'index.html')) ? browserRoot : distRoot;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(data);
  });
}

function proxyApi(req, res) {
  const apiPath = req.url.replace(/^\/api/, '') || '/';
  const proxyReq = http.request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: apiPath,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'Mock API unavailable' }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const requestUrl = req.url || '/';

  if (requestUrl === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (requestUrl.startsWith('/api')) {
    proxyApi(req, res);
    return;
  }

  const normalized = decodeURIComponent(requestUrl.split('?')[0]).replace(/^\/+/, '');
  const candidatePath = path.join(staticRoot, normalized);
  const safePath = path.normalize(candidatePath);
  if (!safePath.startsWith(path.normalize(staticRoot))) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  if (normalized && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    sendFile(safePath, res);
    return;
  }

  sendFile(path.join(staticRoot, 'index.html'), res);
});

server.listen(PORT, '0.0.0.0');
