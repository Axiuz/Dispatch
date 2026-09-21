// Levanta un servidor HTTP estático en la carpeta de un proyecto para
// previsualizarla dentro del panel. Un cambio en un .css intercambia las hojas
// de estilo sin recargar; cualquier otro cambio recarga la página entera.
// Filtra archivos ocultos y node_modules para no publicar un .env por descuido.
// Solo acepta conexiones locales: escucha en 127.0.0.1 y rechaza Host u Origin
// externos. Tope de tres servidores vivos a la vez.

const express = require("express");
const fs = require("fs");
const path = require("path");
const safepath = require("./safepath");

const MAX_SERVERS = 3;
const WATCH_DEBOUNCE_MS = 150;
const LIVE_PATH = "/__live";
const MAX_LISTING = 500;

const servers = new Map();

const LIVE_SNIPPET = `<script>
(function () {
  var source = new EventSource("${LIVE_PATH}");
  source.addEventListener("change", function (e) {
    if (e.data !== "css") return location.reload();
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var url = new URL(link.href, location.href);
      url.searchParams.set("__live", Date.now());
      link.href = url.href;
    });
  });
})();
</script>`;

function hiddenSegment(rel) {
  return String(rel || "")
    .split("/")
    .filter(Boolean)
    .some((seg) => seg.startsWith(".") || safepath.SKIP_DIRS.has(seg));
}

function liveKind(file) {
  return /\.css$/i.test(String(file || "")) ? "css" : "reload";
}

function injectReload(html, snippet = LIVE_SNIPPET) {
  const text = String(html || "");
  const at = text.toLowerCase().lastIndexOf("</body>");
  if (at === -1) return text + snippet;
  return text.slice(0, at) + snippet + text.slice(at);
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function directoryListing(dirRel, entries) {
  const base = dirRel ? `/${dirRel}` : "";
  const rows = entries
    .slice(0, MAX_LISTING)
    .map((e) => {
      const name = e.dir ? `${e.name}/` : e.name;
      return `<li><a href="${escapeHtml(`${base}/${e.name}`)}">${escapeHtml(name)}</a></li>`;
    })
    .join("");
  return (
    `<!doctype html><meta charset="utf-8"><title>${escapeHtml(base || "/")}</title>` +
    `<style>body{font:14px ui-monospace,monospace;margin:32px;background:#111;color:#ddd}` +
    `a{color:#e8b339;text-decoration:none}a:hover{text-decoration:underline}li{margin:3px 0}</style>` +
    `<h1>${escapeHtml(base || "/")}</h1><ul>${rows || "<li>(vacío)</li>"}</ul>`
  );
}

function readEntries(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith(".") && !safepath.SKIP_DIRS.has(e.name))
    .map((e) => ({ name: e.name, dir: e.isDirectory() }))
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
}

function localGuard(entry) {
  return (req, res, next) => {
    const port = entry.port;
    const allowed = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
    const host = req.get("host");
    const origin = req.get("origin");
    const hostOk = allowed.has(host);
    const originOk = !origin || allowed.has(origin.replace(/^https?:\/\//, ""));
    if (hostOk && originOk) return next();
    res.status(403).type("text").send("Solo se aceptan peticiones locales");
  };
}

function sendChange(entry, kind) {
  for (const res of entry.clients) res.write(`event: change\ndata: ${kind}\n\n`);
}

function watch(entry) {
  let timer = null;
  let kind = "css";
  try {
    entry.watcher = fs.watch(entry.root, { recursive: true }, (_event, filename) => {
      const name = String(filename || "");
      if (!name || hiddenSegment(name)) return;
      if (liveKind(name) !== "css") kind = "reload";
      clearTimeout(timer);
      timer = setTimeout(() => {
        sendChange(entry, kind);
        kind = "css";
      }, WATCH_DEBOUNCE_MS);
    });
  } catch (_) {
    entry.watcher = null;
  }
}

// Resuelve la ruta relativa contra la raíz del proyecto y descarta los archivos
// ocultos. Los .html salen con el script de recarga inyectado; una carpeta se
// sirve por su index.html o, si no lo tiene, como listado.
function serveFile(entry) {
  return (req, res) => {
    let rel = "";
    try {
      rel = decodeURIComponent(req.path).replace(/^\/+/, "");
    } catch (_) {
      return res.status(400).type("text").send("Ruta no válida");
    }
    if (hiddenSegment(rel)) return res.status(404).type("text").send("No encontrado");

    const abs = safepath.resolveInsideRoots(path.join(entry.root, rel), [entry.root]);
    if (!abs) return res.status(404).type("text").send("No encontrado");

    let stat = null;
    try {
      stat = fs.statSync(abs);
    } catch (_) {
      return res.status(404).type("text").send("No encontrado");
    }

    res.set("Cache-Control", "no-store");

    if (stat.isDirectory()) {
      const index = path.join(abs, "index.html");
      if (fs.existsSync(index)) return sendHtml(res, index);
      if (!req.path.endsWith("/")) return res.redirect(`${req.path}/`);
      try {
        return res.type("html").send(directoryListing(rel.replace(/\/$/, ""), readEntries(abs)));
      } catch (err) {
        return res.status(500).type("text").send(err.message);
      }
    }

    if (/\.html?$/i.test(abs)) return sendHtml(res, abs);
    res.sendFile(abs, { dotfiles: "deny" }, (err) => {
      if (err && !res.headersSent) res.status(404).type("text").send("No encontrado");
    });
  };
}

// Inyecta el script de recarga antes de mandar el HTML. Si el archivo no se
// puede leer, se responde 500 con el motivo.
function sendHtml(res, file) {
  try {
    res.type("html").send(injectReload(fs.readFileSync(file, "utf-8")));
  } catch (err) {
    res.status(500).type("text").send(err.message);
  }
}

function liveStream(entry) {
  return (req, res) => {
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.flushHeaders();
    res.write(": hola\n\n");
    entry.clients.add(res);
    req.on("close", () => entry.clients.delete(res));
  };
}

const view = (entry) => ({
  path: entry.root,
  port: entry.port,
  url: entry.url,
  startedAt: entry.startedAt,
  clients: entry.clients.size,
});

const list = () => [...servers.values()].map(view);

const get = (root) => (servers.has(root) ? view(servers.get(root)) : null);

// El puerto lo da el sistema (listen 0) para no chocar con lo que ya tengas
// levantado, y el middleware se registra antes de escuchar: así no entra ninguna
// petición sin pasar por el guardia de Host y Origin.
function start(root) {
  const existing = servers.get(root);
  if (existing) {
    existing.touchedAt = Date.now();
    return Promise.resolve(view(existing));
  }

  return new Promise((resolve, reject) => {
    const entry = { root, port: 0, clients: new Set(), startedAt: new Date().toISOString(), touchedAt: Date.now() };
    const app = express();
    app.use(localGuard(entry));
    app.get(LIVE_PATH, liveStream(entry));
    app.use(serveFile(entry));

    const http = app.listen(0, "127.0.0.1", () => {
      entry.port = http.address().port;
      entry.url = `http://127.0.0.1:${entry.port}/`;
      watch(entry);
      servers.set(root, entry);
      trim();
      resolve(view(entry));
    });
    entry.http = http;
    http.on("error", reject);
  });
}

function stop(root) {
  const entry = servers.get(root);
  if (!entry) return false;
  servers.delete(root);
  try {
    entry.watcher?.close();
  } catch (_) {}
  for (const res of entry.clients) res.end();
  entry.clients.clear();
  entry.http.close();
  return true;
}

// Con más servidores de la cuenta se para el que lleva más tiempo sin usarse.
function trim() {
  while (servers.size > MAX_SERVERS) {
    const oldest = [...servers.values()].sort((a, b) => a.touchedAt - b.touchedAt)[0];
    stop(oldest.root);
  }
}

const stopAll = () => [...servers.keys()].forEach(stop);

function localUrlError(url) {
  const text = String(url || "").trim();
  let parsed = null;
  try {
    parsed = new URL(text);
  } catch (_) {
    return "No parece una URL";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "Solo se abren URLs http o https";
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsed.hostname)) {
    return "Solo se abren direcciones de esta máquina";
  }
  return null;
}

module.exports = {
  hiddenSegment,
  liveKind,
  injectReload,
  directoryListing,
  localUrlError,
  list,
  get,
  start,
  stop,
  stopAll,
  LIVE_SNIPPET,
  LIVE_PATH,
  MAX_SERVERS,
};
