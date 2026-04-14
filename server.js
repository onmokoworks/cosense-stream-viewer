import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3456;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API proxy: /api/stream/:projectName
  if (url.pathname.startsWith("/api/stream/")) {
    const projectName = url.pathname.replace("/api/stream/", "");
    if (!projectName || projectName.includes("/")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid project name" }));
      return;
    }

    try {
      const apiUrl = `https://scrapbox.io/api/stream/${encodeURIComponent(projectName)}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        res.writeHead(response.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Scrapbox API returned ${response.status}` }));
        return;
      }
      const data = await response.json();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const ext = filePath.substring(filePath.lastIndexOf("."));
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  try {
    const content = await readFile(join(__dirname, "public", filePath));
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`Cosense Stream Viewer running at http://localhost:${PORT}`);
});
