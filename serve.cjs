const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let port = 8080;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) port = parseInt(args[i + 1]);
}

const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  let fp = path.join('dist', url === '/' ? 'autofilm-landing.html' : url);
  if (!fs.existsSync(fp)) fp = path.join('dist', 'autofilm-landing.html');
  const ext = path.extname(fp);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'text/html' });
  res.end(fs.readFileSync(fp));
}).listen(port, () => console.log(`Serving on :${port}`));
