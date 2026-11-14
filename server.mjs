import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL(".", import.meta.url));
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const hostIndex = args.indexOf("--host");
const port = Number(
  portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 4173,
);
const host = hostIndex >= 0 ? args[hostIndex + 1] : "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const relative = path === "/" ? "index.html" : path.replace(/^\/+/, "");
    // Serve application assets only. Keep documents, test logs and source notes private.
    if (
      !(
        relative === "index.html" ||
        relative === "styles.css" ||
        /^(assets|src)\//.test(relative)
      )
    )
      throw new Error("Not found");
    const target = resolve(root, relative);
    if (
      !target.startsWith(resolve(root) + sep) ||
      !(await stat(target)).isFile()
    )
      throw new Error("Not found");
    res.writeHead(200, {
      "Content-Type": types[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    res.end(await readFile(target));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});
server.listen(port, host, () =>
  console.log(
    `Satris is ready at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`,
  ),
);
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
