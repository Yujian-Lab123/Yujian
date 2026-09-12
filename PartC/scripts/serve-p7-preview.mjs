import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.env.P7_PREVIEW_PORT || '4173', 10);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || '/').split('?')[0]);
  const relativePath = pathname === '/'
    ? 'design-qa/p7-motion-preview.html'
    : pathname.replace(/^\/+/, '');
  const filePath = normalize(join(root, relativePath));

  if (!filePath.toLowerCase().startsWith(root.toLowerCase())) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  response.setHeader('Content-Type', mime[extname(filePath)] || 'application/octet-stream');
  createReadStream(filePath)
    .on('error', () => response.writeHead(404).end('Not found'))
    .pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`P7 interactive preview: http://127.0.0.1:${port}`);
  console.log('Press Ctrl+C to stop.');
});
