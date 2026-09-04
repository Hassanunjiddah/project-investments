#!/usr/bin/env node
/**
 * Smoke-test the web export: screens stay enabled (signed-in shell), and
 * projects still use the Slot shell marker.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..', 'dist');
const PORT = 3458;

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html';
  if (file.endsWith('.js')) return 'application/javascript';
  if (file.endsWith('.css')) return 'text/css';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

function fetchText(urlPath) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: PORT, path: urlPath }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
    console.error('FAIL: dist/ missing — run expo export first');
    process.exit(1);
  }
  const entry = fs
    .readdirSync(path.join(ROOT, '_expo/static/js/web'))
    .find((f) => f.startsWith('entry-') && f.endsWith('.js'));
  const bundle = fs.readFileSync(path.join(ROOT, '_expo/static/js/web', entry), 'utf8');
  const checks = {
    // Must re-enable screens on web (was enableScreens)(!1) and blanked sign-in).
    enableScreensTrue: bundle.includes('enableScreens)(!0)'),
    enableScreensFalseGone: !bundle.includes('enableScreens)(!1)'),
    noAggressiveAriaCss: !bundle.includes('prism-web-tab-scene-fix'),
    projectCreate: bundle.includes('project-create'),
    projectsShell: bundle.includes('projects-shell'),
  };
  console.log('bundle', checks);
  for (const [k, ok] of Object.entries(checks)) {
    if (!ok) {
      console.error(`FAIL: ${k}`);
      process.exit(1);
    }
  }

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(ROOT, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  try {
    const home = await fetchText('/');
    const projects = await fetchText('/projects');
    const spaOk =
      home.status === 200 &&
      projects.status === 200 &&
      home.body.includes('id="root"') &&
      projects.body.includes(entry);
    console.log('spa', { home: home.status, projects: projects.status, spaOk });
    if (!spaOk) {
      console.error('FAIL: SPA fallback');
      process.exit(1);
    }
    console.log('PASS: signed-in shell restore smoke');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
