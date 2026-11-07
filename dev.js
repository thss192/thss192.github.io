// dev.js - 零依赖的本地开发服务器 (绝对可靠的刷新版)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const crypto = require("crypto");

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".woff": "font/woff"
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  
  let filePath = path.join(ROOT, decodeURIComponent(urlPath));
  
  if (!path.extname(filePath)) {
    filePath += ".html";
  }
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const fallbackPath = path.join(ROOT, decodeURIComponent(urlPath), "index.html");
        fs.readFile(fallbackPath, (err2, data2) => {
          if (!err2) {
            serveFile(req, res, fallbackPath, data2);
            return;
          }
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("404 Not Found");
        });
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    serveFile(req, res, filePath, data);
  });
});

function serveFile(req, res, filePath, data) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  
  if (ext === ".html") {
    let html = data.toString("utf8");
    const reloadScript = `
      <script>
        (function() {
          // 使用随机时间戳防止浏览器缓存 WebSocket
          const ws = new WebSocket('ws://' + location.host);
          ws.onmessage = function(e) {
            if (e.data === 'reload') {
              console.log('🔄 正在刷新页面...');
              window.location.reload();
            }
          };
        })();
      </script>
    `;
    html = html.replace("</body>", reloadScript + "</body>");
    data = Buffer.from(html, "utf8");
  }

  res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" });
  res.end(data);
}

// WebSocket 机制
let wsClients = [];
server.on("upgrade", (req, socket) => {
  if (req.headers.upgrade.toLowerCase() !== "websocket") return socket.destroy();
  const acceptKey = req.headers["sec-websocket-key"];
  const hash = crypto.createHash("sha1").update(acceptKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + hash + "\r\n\r\n");
  wsClients.push(socket);
  socket.on("close", () => { wsClients = wsClients.filter(s => s !== socket); });
  socket.on("error", () => { wsClients = wsClients.filter(s => s !== socket); });
});

function broadcastReload() {
  console.log("📡 正在通知浏览器刷新...");
  wsClients = wsClients.filter(socket => {
    try {
      if (socket.destroyed) return false;
      const msg = Buffer.from("reload");
      const frame = Buffer.concat([Buffer.from([0x81, msg.length]), msg]);
      socket.write(frame);
      return true;
    } catch (e) { return false; }
  });
}

server.listen(PORT, () => {
  console.log(`\n🚦 本地开发服务器已启动: http://localhost:${PORT}`);
});

function runGenerate(callback) {
  console.log("🔄 正在编译文章索引...");
  // 延迟 100ms 等待文件写入完成
  setTimeout(() => {
    exec("node scripts/generate-index.js", (err, stdout, stderr) => {
      if (err) {
        console.error("❌ 索引生成失败:", stderr);
      } else {
        console.log(`✅ 索引同步完成`);
      }
      if (callback) callback();
    });
  }, 100);
}

runGenerate();

// ======= 终极监听：只要变了就触发 =======
let isProcessing = false;
const ALLOWED_EXTS = [".html", ".css", ".js", ".md", ".json"];
const IGNORE_DIRS = [".git", "node_modules", "images", "libs"];
const IGNORE_FILES = ["dev.js", "start.bat"];

fs.watch(ROOT, { recursive: true }, (eventType, filename) => {
  if (!filename || isProcessing) return;

  const pathParts = filename.split(path.sep);
  if (pathParts.some(part => IGNORE_DIRS.includes(part))) return;
  if (IGNORE_FILES.includes(path.basename(filename))) return;
  
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) return;

  // 如果正在处理上一次，就跳过
  isProcessing = true;
  console.log(`\n📝 检测到变动: ${filename} (${eventType})`);

  if (ext === ".md") {
    runGenerate(() => {
      // 延迟发送给浏览器，防止与编辑器冲突
      setTimeout(() => {
        broadcastReload();
        // 2秒后解锁，允许下一次监听
        setTimeout(() => { isProcessing = false; }, 2000);
      }, 200);
    });
  } else {
    // 其他文件直接刷新
    broadcastReload();
    setTimeout(() => { isProcessing = false; }, 1000);
  }
});