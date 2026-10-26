// 把 build/web 打成单文件 HTML：所有文件 base64 嵌入 VFS，
// 接管 fetch/XMLHttpRequest 从 VFS 应答（file:// 下可离线运行）。
// 用法: node tools/pack-mobile.js  -> dist-mobile/index.html
const fs = require('fs');
const path = require('path');
const SRC = 'build/web';
const OUT = 'dist-mobile';

const files = {};
function walk(d, rel) {
    for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        const r = rel ? rel + '/' + f : f;
        if (fs.statSync(p).isDirectory()) { walk(p, r); }
        else { files[r] = fs.readFileSync(p).toString('base64'); }
    }
}
walk(SRC, '');

// index.html 里的静态 <script src> 直接内联（system/polyfills 等）
let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
html = html.replace(/<script([^>]*?) src="([^"]+)"([^>]*)>\s*<\/script>/g,
    (m, a, src, b) => '<script' + a + b + '>\n' + fs.readFileSync(path.join(SRC, src), 'utf8') + '\n</script>');
html = html.replace(/<script([^>]*?) src="([^"]+)"([^>]*?)><\/script>/g,
    (m, a, src, b) => '<script' + a + b + '>\n' + fs.readFileSync(path.join(SRC, src), 'utf8') + '\n</script>');
html = html.replace(/<link([^>]*?) href="([^"]+\.css)"([^>]*?)\/?>/g,
    (m, a, href, b) => '<style>\n' + fs.readFileSync(path.join(SRC, href), 'utf8') + '\n</style>');

const shim = `
<script>
window.__VFS = ${JSON.stringify(files)};
(function () {
    var VFS = window.__VFS, keys = Object.keys(VFS);
    function key(u) {
        u = ('' + u).replace(/\\\\/g, '/');
        var best = null;
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if ((u === k || u.indexOf('/' + k) === u.length - k.length - 1) && (!best || k.length > best.length)) { best = k; }
        }
        return best;
    }
    function bytes(k) {
        var b = atob(VFS[k]), a = new Uint8Array(b.length);
        for (var i = 0; i < b.length; i++) { a[i] = b.charCodeAt(i); }
        return a;
    }
    var ofetch = window.fetch;
    window.fetch = function (u, o) {
        var k = key(u);
        if (k) { return Promise.resolve(new Response(bytes(k), { status: 200 })); }
        return ofetch(u, o);
    };
    var RX = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
        var x = new RX(), u = '', self = this;
        self.open = function (m, url, a, us, p) { u = url; return x.open(m, url, a, us, p); };
        self.send = function (d) {
            var k = key(u);
            if (!k) { return x.send(d); }
            var data = bytes(k), type = self.responseType;
            Object.defineProperty(self, 'readyState', { value: 4 });
            Object.defineProperty(self, 'status', { value: 200 });
            if (type === 'arraybuffer') { Object.defineProperty(self, 'response', { value: data.buffer }); }
            else if (type === 'blob') { Object.defineProperty(self, 'response', { value: new Blob([data]) }); }
            else {
                var t = new TextDecoder().decode(data);
                Object.defineProperty(self, 'response', { value: type === 'json' ? JSON.parse(t) : t });
                Object.defineProperty(self, 'responseText', { value: t });
            }
            if (self.onreadystatechange) { self.onreadystatechange(); }
            if (self.onload) { self.onload(); }
            if (self.onloadend) { self.onloadend(); }
        };
        ['responseType', 'onreadystatechange', 'onload', 'onloadend', 'onerror', 'onprogress', 'timeout', 'withCredentials'].forEach(function (p) {
            Object.defineProperty(self, p, {
                get: function () { return self['_' + p]; },
                set: function (v) { self['_' + p] = v; },
            });
        });
        self.setRequestHeader = function () {};
        self.getResponseHeader = function () { return null; };
        self.getAllResponseHeaders = function () { return ''; };
        self.abort = function () {};
        self.overrideMimeType = function () {};
    };
})();
</script>`;
html = html.replace(/<script/, shim + '\n<script'); // shim 必须最先执行

if (!fs.existsSync(OUT)) { fs.mkdirSync(OUT, { recursive: true }); }
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('packed ->', path.join(OUT, 'index.html'), (html.length / 1048576).toFixed(1) + 'MB,', Object.keys(files).length, 'files');
