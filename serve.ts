// A tiny static server for game/ (Node 22, standard library only), so the
// entry can be played locally without a build step: `node serve.ts` serves
// game/ on http://localhost:8080. Development convenience, not a web server.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const requested = portIndex === -1 ? 8080 : Number(args[portIndex + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

createServer((request, response) => {
  const url = decodeURIComponent((request.url ?? '/').split('?')[0]);
  const file = resolve(join(root, normalize(url).replace(/^(\.\.(\/|\\|$))+/, '')));
  if (!file.startsWith(root + sep) && file !== root) {
    response.writeHead(403);
    response.end('forbidden');
    return;
  }
  const target = file === root ? join(root, 'index.html') : file;
  try {
    const stat = statSync(target);
    if (!stat.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'Content-Type': MIME[extname(target)] ?? 'application/octet-stream' });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
}).listen(port, () => {
  console.log(`Amber Swan Heist at http://localhost:${port}`);
});
