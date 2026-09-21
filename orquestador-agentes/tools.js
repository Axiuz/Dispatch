// Cataloga las herramientas locales (eslint, prettier, tsc, ruff…) que el
// servidor ejecuta sobre el archivo abierto. El catálogo está en data/tools.json
// y es quien pone los argumentos: del panel solo llegan un id y una ruta.
// Aquí viven además los parsers que convierten la salida de cada herramienta en
// problemas con archivo, línea, columna y severidad.
// Sin estado, para poder probarlo (ver test/tools.test.js).
const fs = require("fs");
const path = require("path");
const search = require("./search");

const LIMITS = { tools: 40, args: 24, match: 40, problems: 500, outputChars: 20000, timeoutMs: 30000 };
const KINDS = new Set(["lint", "format"]);
const PARSERS = new Set(["eslint-json", "ruff-json", "tsc", "generic", "none"]);
const SEVERITIES = { error: "error", warning: "warning", info: "info" };

const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// El catálogo vive en disco y es la única fuente de los argumentos: el panel
// manda un id y una ruta, nunca una línea de comandos.
function normalizeTools(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];

  for (const entry of list) {
    if (out.length >= LIMITS.tools) break;
    const id = str(entry && entry.id, 40);
    const bin = str(entry && entry.bin, 80);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || seen.has(id)) continue;
    // El binario se busca por nombre: una ruta aquí sería ejecutar lo que sea
    if (!bin || bin.includes("/") || bin.includes("\\") || bin.startsWith("-")) continue;

    const kind = KINDS.has(entry.kind) ? entry.kind : "lint";
    const parser = PARSERS.has(entry.parser) ? entry.parser : kind === "format" ? "none" : "generic";
    const args = (Array.isArray(entry.args) ? entry.args : [])
      .filter((a) => typeof a === "string")
      .slice(0, LIMITS.args)
      .map((a) => a.slice(0, 200));
    const match = (Array.isArray(entry.match) ? entry.match : [])
      .filter((m) => typeof m === "string")
      .slice(0, LIMITS.match);

    seen.add(id);
    out.push({
      id,
      name: str(entry.name, 60) || id,
      description: str(entry.description, 200),
      kind,
      bin,
      args,
      match,
      parser,
      stdin: Boolean(entry.stdin),
      projectWide: Boolean(entry.projectWide),
    });
  }
  return out;
}

function matchesFile(tool, name) {
  if (!tool.match.length) return true;
  const base = path.basename(name);
  return tool.match.some((glob) => search.globToRegExp(glob).test(base));
}

// Primero el binario del propio proyecto (node_modules/.bin), que es el que el
// repo fija; después el del PATH. Sin ninguno, la herramienta sale como no
// disponible en vez de fallar al ejecutarla.
function resolveBin(tool, root, env = process.env) {
  if (root) {
    let dir = root;
    for (let i = 0; i < 6 && dir; i++) {
      const candidate = path.join(dir, "node_modules", ".bin", tool.bin);
      if (isExecutable(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  for (const entry of String(env.PATH || "").split(path.delimiter)) {
    if (!entry) continue;
    const candidate = path.join(entry, tool.bin);
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch (_) {
    return false;
  }
}

// {file} y {dir} son los únicos huecos: lo demás del comando es literal.
function buildArgs(tool, { file, dir }) {
  return tool.args.map((arg) => arg.replace("{file}", file || "").replace("{dir}", dir || ""));
}

const clamp = (text) => String(text || "").slice(0, LIMITS.outputChars);

function parseEslintJson(stdout, fallbackFile) {
  const out = [];
  let data;
  try {
    data = JSON.parse(stdout);
  } catch (_) {
    return out;
  }
  for (const file of Array.isArray(data) ? data : []) {
    for (const m of file.messages || []) {
      out.push({
        file: file.filePath || fallbackFile,
        line: m.line || 1,
        column: m.column || 1,
        severity: m.severity === 1 ? "warning" : "error",
        message: m.message || "",
        rule: m.ruleId || null,
      });
    }
  }
  return out;
}

function parseRuffJson(stdout, fallbackFile) {
  const out = [];
  let data;
  try {
    data = JSON.parse(stdout);
  } catch (_) {
    return out;
  }
  for (const item of Array.isArray(data) ? data : []) {
    out.push({
      file: item.filename || fallbackFile,
      line: (item.location && item.location.row) || 1,
      column: (item.location && item.location.column) || 1,
      severity: "warning",
      message: item.message || "",
      rule: item.code || null,
    });
  }
  return out;
}

// tsc --pretty false: "src/app.ts(12,5): error TS2345: mensaje"
const TSC_RE = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.*)$/;
// gcc y compañía: "archivo:12:5: error: mensaje", con la columna opcional
const GENERIC_RE = /^(.+?):(\d+)(?::(\d+))?:\s*(?:(error|warning|note|info|aviso)\s*:)?\s*(.*)$/i;

function parseLines(text, re, build) {
  const out = [];
  for (const line of String(text || "").split("\n")) {
    const hit = re.exec(line.trim());
    if (hit) out.push(build(hit));
  }
  return out;
}

function parseOutput(tool, { stdout = "", stderr = "", file = null } = {}) {
  const both = `${stdout}\n${stderr}`;
  switch (tool.parser) {
    case "eslint-json":
      return parseEslintJson(stdout, file);
    case "ruff-json":
      return parseRuffJson(stdout, file);
    case "tsc":
      return parseLines(both, TSC_RE, (m) => ({
        file: m[1],
        line: Number(m[2]),
        column: Number(m[3]),
        severity: SEVERITIES[m[4]] || "error",
        message: m[6],
        rule: m[5],
      }));
    case "generic":
      return parseLines(both, GENERIC_RE, (m) => ({
        file: m[1],
        line: Number(m[2]),
        column: Number(m[3] || 1),
        severity: SEVERITIES[String(m[4] || "").toLowerCase()] || "error",
        message: m[5],
        rule: null,
      }));
    default:
      return [];
  }
}

// Las rutas relativas del linter se resuelven contra la carpeta donde corrió, y
// las de fuera del proyecto se descartan: un problema tiene que poder abrirse.
function absolutize(problems, root) {
  const out = [];
  for (const p of problems.slice(0, LIMITS.problems)) {
    const abs = path.isAbsolute(p.file) ? p.file : path.resolve(root, p.file);
    const rel = path.relative(root, abs);
    if (rel.startsWith("..")) continue;
    out.push({ ...p, file: abs, rel: rel.split(path.sep).join("/") });
  }
  return out;
}

const summarize = (problems) => ({
  errors: problems.filter((p) => p.severity === "error").length,
  warnings: problems.filter((p) => p.severity === "warning").length,
});

module.exports = {
  LIMITS,
  normalizeTools,
  matchesFile,
  resolveBin,
  isExecutable,
  buildArgs,
  parseOutput,
  parseEslintJson,
  parseRuffJson,
  absolutize,
  summarize,
  clamp,
};
