const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript' };

http.createServer((request, response) => {
  const requested = request.url === '/' ? 'index.html' : request.url.split('?')[0].replace(/^\//, '');
  const file = path.resolve(root, requested);
  if (!file.startsWith(root) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': `${types[path.extname(file)] || 'application/octet-stream'}; charset=utf-8` });
  fs.createReadStream(file).pipe(response);
}).listen(4300, '0.0.0.0', () => console.log('Dashboard preview: http://127.0.0.1:4300'));
