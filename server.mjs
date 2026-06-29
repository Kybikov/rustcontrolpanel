import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("dist");
const port = Number(process.env.PORT || 3000);
const apiBaseUrl = process.env.API_BASE_URL || "";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0]);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const target = resolve(join(root, normalized));
  return target.startsWith(root) ? target : root;
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    send(res, 400, "bad request\n");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/healthz") {
    send(res, 200, "ok\n", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  if (url.pathname === "/config.js") {
    send(
      res,
      200,
      `window.__RUST_CONTROL_CONFIG__ = ${JSON.stringify({ API_BASE_URL: apiBaseUrl })};\n`,
      {
        "Cache-Control": "no-store",
        "Content-Type": "text/javascript; charset=utf-8",
      },
    );
    return;
  }

  const target = safePath(url.pathname);
  const filePath = existsSync(target) && statSync(target).isFile() ? target : join(root, "index.html");
  const ext = extname(filePath);

  try {
    const headers = {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
    };
    if (ext !== ".html") {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    }
    res.writeHead(200, headers);
    createReadStream(filePath).pipe(res);
  } catch {
    const index = await readFile(join(root, "index.html"));
    send(res, 200, index, { "Content-Type": "text/html; charset=utf-8" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Rust Control Panel listening on 0.0.0.0:${port}`);
});
