// Lee lo declarativo de una extensión de VS Code (un .vsix de Open VSX): su
// package.json, sus temas de color, sus iconos de archivo y sus snippets, y
// traduce un tema al formato de monaco.editor.defineTheme.
// El código de la extensión nunca se ejecuta: aquí no hay extension host.
// Sin estado, para poder probarlo (ver test/vsix.test.js).
const fs = require("fs");
const path = require("path");

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_INCLUDES = 6;
const SERVABLE = new Set([".json", ".svg", ".png", ".jsonc"]);

function idError(id) {
  if (typeof id !== "string" || !id.trim()) return "Falta el id de la extensión";
  const clean = id.trim();
  if (clean.length > 120) return "El id es demasiado largo";
  if (clean.includes("/") || clean.includes("\\") || clean.includes("..")) return "El id no es válido";
  if (!ID_RE.test(clean)) return "El id va como publicador.nombre";
  return null;
}

function parseId(id) {
  const dot = id.indexOf(".");
  return { publisher: id.slice(0, dot), name: id.slice(dot + 1) };
}

// La URL de descarga la da Open VSX, pero se comprueba igual: un redirect a otro
// host o a file:// no puede acabar guardándose como extensión.
function downloadUrlError(url, { host = "open-vsx.org" } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return "La URL de descarga no es válida";
  }
  if (parsed.protocol !== "https:") return "La descarga tiene que ir por https";
  if (parsed.hostname !== host && !parsed.hostname.endsWith(`.${host}`)) {
    return `La descarga no viene de ${host}`;
  }
  return null;
}

function readJson(file) {
  const raw = fs.readFileSync(file, "utf-8");
  // Los temas de VS Code llevan comentarios y comas colgando: es JSONC
  const clean = raw
    .replace(/^\uFEFF/, "")
    .replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\n\r]*/g, (m, str) => str || "")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(clean);
}

// Dentro del .vsix todo cuelga de extension/, que es donde está su package.json.
function packageRoot(dir) {
  const nested = path.join(dir, "extension");
  return fs.existsSync(path.join(nested, "package.json")) ? nested : dir;
}

// Lo que se guarda de un paquete instalado: solo lo declarativo. El código de la
// extensión (main, browser, activationEvents) se ignora a propósito, porque aquí
// no hay extension host que lo ejecute ni queremos que lo haya.
function readManifest(dir) {
  const rootDir = packageRoot(dir);
  const pkg = readJson(path.join(rootDir, "package.json"));
  const contributes = pkg.contributes || {};

  const themes = (contributes.themes || []).map((t, i) => ({
    key: String(t.id || t.label || i),
    label: t.label || t.id || `Tema ${i + 1}`,
    uiTheme: t.uiTheme || "vs-dark",
    path: t.path,
  }));
  const iconThemes = (contributes.iconThemes || []).map((t, i) => ({
    key: String(t.id || i),
    label: t.label || t.id || `Iconos ${i + 1}`,
    path: t.path,
  }));
  const snippets = (contributes.snippets || []).map((s) => ({ language: s.language, path: s.path }));

  return {
    id: `${pkg.publisher}.${pkg.name}`,
    name: pkg.name,
    publisher: pkg.publisher,
    displayName: pkg.displayName || pkg.name,
    description: pkg.description || "",
    version: pkg.version || "",
    icon: pkg.icon || null,
    themes,
    iconThemes,
    snippets,
    grammars: (contributes.grammars || []).length,
    languages: (contributes.languages || []).length,
    // Lo que de verdad se puede aprovechar sin ejecutar nada
    usable: themes.length + iconThemes.length + snippets.length > 0,
  };
}

// Un tema puede heredar de otro por "include": se resuelven en cadena y lo del
// hijo pisa lo del padre, igual que en VS Code.
function loadThemeFile(file, depth = 0) {
  const json = readJson(file);
  if (!json.include || depth >= MAX_INCLUDES) return json;
  const parent = loadThemeFile(path.resolve(path.dirname(file), json.include), depth + 1);
  return {
    ...parent,
    ...json,
    colors: { ...(parent.colors || {}), ...(json.colors || {}) },
    tokenColors: [...(parent.tokenColors || []), ...(json.tokenColors || [])],
  };
}

const hex = (c) => (typeof c === "string" && c.startsWith("#") ? c.slice(1, 7) : null);

// Traduce el tema de VS Code a lo que entiende monaco.editor.defineTheme. Los
// scopes de TextMate valen como nombres de token de Monaco porque Monaco casa
// por prefijo de punto: "comment.line" cae bajo "comment".
function themeToMonaco(theme, { name = "vsix" } = {}) {
  const rules = [];
  for (const entry of theme.tokenColors || []) {
    const scopes = Array.isArray(entry.scope) ? entry.scope : String(entry.scope || "").split(",");
    const settings = entry.settings || {};
    const foreground = hex(settings.foreground);
    if (!foreground && !settings.fontStyle) continue;
    for (const scope of scopes) {
      const token = scope.trim().replace(/\s+/g, ".");
      if (!token) continue;
      const rule = { token };
      if (foreground) rule.foreground = foreground;
      if (settings.fontStyle) rule.fontStyle = settings.fontStyle;
      rules.push(rule);
    }
  }

  const colors = {};
  for (const [key, value] of Object.entries(theme.colors || {})) {
    if (typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value)) colors[key] = value;
  }

  const dark = String(theme.type || "").toLowerCase() !== "light";
  return { name, base: dark ? "vs-dark" : "vs", inherit: true, rules, colors };
}

// El icon theme de VS Code es un índice de nombre/extensión a definición. Se
// aplana a mapas de consulta directa, con las rutas ya relativas a la carpeta de
// la extensión, que es lo que sirve el endpoint de archivos.
function iconThemeIndex(json, { file, root }) {
  const base = path.dirname(file);
  const relFor = (iconPath) => {
    if (!iconPath) return null;
    const abs = path.resolve(base, iconPath);
    const rel = path.relative(root, abs);
    return rel.startsWith("..") ? null : rel.split(path.sep).join("/");
  };

  const defs = {};
  for (const [key, def] of Object.entries(json.iconDefinitions || {})) {
    const rel = relFor(def && def.iconPath);
    if (rel) defs[key] = rel;
  }

  const pick = (map) => {
    const out = {};
    for (const [key, value] of Object.entries(map || {})) {
      if (defs[value]) out[key.toLowerCase()] = defs[value];
    }
    return out;
  };

  return {
    byExt: pick(json.fileExtensions),
    byName: pick(json.fileNames),
    byLang: pick(json.languageIds),
    file: defs[json.file] || null,
    folder: defs[json.folder] || null,
    folderExpanded: defs[json.folderExpanded] || defs[json.folder] || null,
  };
}

function servableError(rel) {
  if (typeof rel !== "string" || !rel.trim()) return "Falta la ruta del archivo";
  if (rel.includes("..") || path.isAbsolute(rel)) return "Esa ruta no vale";
  if (!SERVABLE.has(path.extname(rel).toLowerCase())) return "Solo se sirven .json, .svg y .png de una extensión";
  return null;
}

const CONTENT_TYPES = {
  ".json": "application/json; charset=utf-8",
  ".jsonc": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

module.exports = {
  ID_RE,
  SERVABLE,
  CONTENT_TYPES,
  idError,
  parseId,
  downloadUrlError,
  readJson,
  packageRoot,
  readManifest,
  loadThemeFile,
  themeToMonaco,
  iconThemeIndex,
  servableError,
};
