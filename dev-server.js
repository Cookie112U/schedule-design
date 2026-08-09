const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const preferredPort = Number(process.env.PORT || 5500);
const apiTarget = new URL(process.env.API_TARGET || "http://127.0.0.1:8000");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, headers);
  response.end(body);
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  const cleanPath = decodeURIComponent(requestUrl.pathname);
  const relativePath = cleanPath === "/" ? "index.html" : cleanPath.slice(1);
  const filePath = path.normalize(path.join(root, relativePath));

  if (!filePath.startsWith(root)) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(response, 404, "Not Found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function proxyApi(request, response) {
  const targetUrl = new URL(request.url, apiTarget);
  const proxyClient = apiTarget.protocol === "https:" ? https : http;
  const proxyRequest = proxyClient.request({
    hostname: apiTarget.hostname,
    port: apiTarget.port || (apiTarget.protocol === "https:" ? 443 : 80),
    path: `${targetUrl.pathname}${targetUrl.search}`,
    method: request.method,
    headers: {
      ...request.headers,
      host: apiTarget.host
    }
  }, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(response);
  });

  proxyRequest.on("error", (error) => {
    send(response, 502, JSON.stringify({ detail: `API proxy error: ${error.message}` }), {
      "Content-Type": "application/json; charset=utf-8"
    });
  });

  request.pipe(proxyRequest);
}

function createServer() {
  return http.createServer((request, response) => {
    if (request.url.startsWith("/__schedule_proxy_ready")) {
      send(response, 200, JSON.stringify({ ok: true, apiTarget: apiTarget.origin }), {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      return;
    }

    if (request.url.startsWith("/api/")) {
      proxyApi(request, response);
      return;
    }

    serveStatic(request, response);
  });
}

function listen(port) {
  const server = createServer();
  server.on("error", (error) => {
    if ((error.code === "EADDRINUSE" || error.code === "EACCES") && port < preferredPort + 20) {
      listen(port + 1);
      return;
    }

    console.error(error);
    process.exit(1);
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Frontend: http://127.0.0.1:${port}`);
    console.log(`API proxy: ${apiTarget.origin}`);
  });
}

listen(preferredPort);
