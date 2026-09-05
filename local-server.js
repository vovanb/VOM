const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data, null, 2));
}

function safePath(relativePath) {
  const resolved = path.resolve(ROOT, relativePath);
  if (!resolved.startsWith(ROOT)) {
    throw new Error("Unsafe path");
  }
  return resolved;
}

function slugify(value) {
  return String(value || "artwork")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "artwork";
}

function extensionFromName(name, fallback = ".jpg") {
  const ext = path.extname(String(name || "")).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : fallback;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 120 * 1024 * 1024) {
      throw new Error("Upload is too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readArtworks() {
  const file = safePath("assets/artworks.json");
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function writeArtworks(artworks) {
  const file = safePath("assets/artworks.json");
  await fs.writeFile(file, `${JSON.stringify(artworks, null, 2)}\n`, "utf8");
}

async function writeDataUrl(filePath, dataUrl) {
  const match = /^data:[^;]+;base64,(.+)$/u.exec(dataUrl || "");
  if (!match) {
    throw new Error("Invalid image upload");
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(match[1], "base64"));
}

async function saveArtwork(payload) {
  const artworks = await readArtworks();
  const existingId = payload.existingId ? slugify(payload.existingId) : "";
  const requestedId = slugify(payload.artwork?.id || payload.artwork?.title?.en || payload.artwork?.title?.uk);
  const id = requestedId;
  const artworkDir = `assets/artworks/${id}`;
  const files = payload.files || {};
  const artwork = {
    ...payload.artwork,
    id
  };

  if (files.main?.dataUrl) {
    const ext = extensionFromName(files.main.name);
    const relative = `${artworkDir}/main${ext}`;
    await writeDataUrl(safePath(relative), files.main.dataUrl);
    artwork.image = relative.replaceAll("\\", "/");
  } else if (!artwork.image) {
    throw new Error("Main image is required for new artwork");
  }

  if (Array.isArray(files.pieces) && files.pieces.length) {
    artwork.pieces = [];
    for (let index = 0; index < files.pieces.length; index += 1) {
      const file = files.pieces[index];
      const ext = extensionFromName(file.name);
      const relative = `${artworkDir}/pieces/${String(index + 1).padStart(2, "0")}${ext}`;
      await writeDataUrl(safePath(relative), file.dataUrl);
      artwork.pieces.push(relative.replaceAll("\\", "/"));
    }
  } else if (!Array.isArray(artwork.pieces)) {
    delete artwork.pieces;
  }

  if (Array.isArray(files.history) && files.history.length) {
    artwork.history = [];
    for (let index = 0; index < files.history.length; index += 1) {
      const file = files.history[index];
      const ext = extensionFromName(file.name);
      const relative = `${artworkDir}/history/${String(index + 1).padStart(2, "0")}${ext}`;
      await writeDataUrl(safePath(relative), file.dataUrl);
      artwork.history.push(relative.replaceAll("\\", "/"));
    }
  } else if (!Array.isArray(artwork.history)) {
    delete artwork.history;
  }

  const withoutOld = artworks.filter((item) => item.id !== existingId && item.id !== id);
  withoutOld.push(artwork);
  await writeArtworks(withoutOld);
  return artwork;
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/artworks" && req.method === "GET") {
    sendJson(res, 200, { artworks: await readArtworks() });
    return;
  }

  if (url.pathname === "/api/artworks" && req.method === "POST") {
    const payload = JSON.parse(await readBody(req));
    const artwork = await saveArtwork(payload);
    sendJson(res, 200, { ok: true, artwork });
    return;
  }

  sendJson(res, 404, { error: "Unknown API route" });
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = safePath(`.${pathname}`);
  const data = await fs.readFile(filePath);
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, error.code === "ENOENT" ? 404 : 500, { error: error.message || "Server error" });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Local editor server: http://127.0.0.1:${PORT}/`);
  console.log(`Admin editor:        http://127.0.0.1:${PORT}/admin.html`);
});
