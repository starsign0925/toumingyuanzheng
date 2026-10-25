// 极简静态服务器：node serve.js <root> <port>
// 无 Node 环境下可用编辑器执行：ELECTRON_RUN_AS_NODE=1 CocosCreator.exe serve.js build/web 8787
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2]);
const port = parseInt(process.argv[3] || '8787', 10);
const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.bin': 'application/octet-stream',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain',
};
http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') { p = '/index.html'; }
    const file = path.join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (e, d) => {
        if (e) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(d);
    });
}).listen(port, () => console.log('serving ' + root + ' on http://localhost:' + port));
