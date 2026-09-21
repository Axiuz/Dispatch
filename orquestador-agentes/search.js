// Busca texto en los archivos de un proyecto. No hay ripgrep en la máquina, así
// que el recorrido es propio: hasta 300 archivos con acierto, 2000 coincidencias
// o 10 segundos, y nada de binarios ni de archivos de más de 2 MB.
// Devuelve una entrada por línea, no una por coincidencia.
// Sin estado, para poder probarlo (ver test/search.test.js).
const fs = require("fs");
const path = require("path");
const safepath = require("./safepath");

const LIMITS = {
  files: 4000,
  hitFiles: 300,
  matches: 2000,
  perFile: 40,
  fileBytes: safepath.MAX_FILE_BYTES,
  lineChars: 400,
  contextChars: 120,
  queryChars: 400,
  ms: 10000,
};

const EXTRA_SKIP = new Set([".DS_Store", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"]);

function queryError(q) {
  if (typeof q !== "string" || !q.trim()) return "Escribe qué buscar";
  if (q.length > LIMITS.queryChars) return "La búsqueda es demasiado larga";
  return null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Devuelve un RegExp global, o lanza si el usuario escribió una expresión rota:
// el mensaje de V8 es lo que se le enseña, que dice más que un "regex inválida".
function buildMatcher(query, { regex = false, caseSensitive = false, word = false } = {}) {
  let source = regex ? query : escapeRe(query);
  if (word) source = `\\b(?:${source})\\b`;
  return new RegExp(source, caseSensitive ? "g" : "gi");
}

// El glob del filtro es el de VS Code recortado: *, ?, ** y {a,b}. Se compara
// contra la ruta relativa, así que "src/**/*.js" funciona igual que "*.js".
function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        out += "(?:.*)";
        i++;
        if (glob[i + 1] === "/") i++;
      } else out += "[^/]*";
    } else if (c === "?") out += "[^/]";
    else if (c === "{") out += "(?:";
    else if (c === "}") out += ")";
    else if (c === ",") out += "|";
    else out += escapeRe(c);
  }
  return new RegExp(`^${out}$`, "i");
}

function makeFilter(globs) {
  const list = (globs || "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .map(globToRegExp);
  if (!list.length) return () => true;
  return (rel) => list.some((re) => re.test(rel) || re.test(path.basename(rel)));
}

// Recorta la línea alrededor de la primera coincidencia: una línea minificada
// de 20 000 caracteres no puede viajar entera al panel.
function trimLine(text, start, end) {
  if (text.length <= LIMITS.lineChars) return { text, start, end };
  const from = Math.max(0, start - LIMITS.contextChars);
  const to = Math.min(text.length, from + LIMITS.lineChars);
  const cut = text.slice(from, to);
  return {
    text: (from ? "…" : "") + cut + (to < text.length ? "…" : ""),
    start: start - from + (from ? 1 : 0),
    end: Math.min(end - from + (from ? 1 : 0), cut.length + 1),
  };
}

// Busca dentro de un texto ya leído. Separado del recorrido para poder probarlo
// sin tocar el disco.
function searchText(text, matcher, { perFile = LIMITS.perFile } = {}) {
  const out = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length && out.length < perFile; i++) {
    const raw = lines[i].replace(/\r$/, "");
    matcher.lastIndex = 0;
    const hit = matcher.exec(raw);
    if (!hit) continue;
    // Una expresión que casa el vacío avanzaría sin fin: se cuenta una vez
    const end = hit.index + (hit[0].length || 1);
    out.push({ line: i + 1, ...trimLine(raw, hit.index, end) });
  }
  return out;
}

function walk(root, { filter, onFile, deadline }) {
  const stack = [root];
  let seen = 0;
  while (stack.length) {
    if (Date.now() > deadline) return { seen, timedOut: true };
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!safepath.SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) stack.push(full);
        continue;
      }
      if (!entry.isFile() || EXTRA_SKIP.has(entry.name)) continue;
      const rel = path.relative(root, full);
      if (!filter(rel)) continue;
      if (++seen > LIMITS.files) return { seen, timedOut: false, capped: true };
      if (onFile(full, rel) === false) return { seen, timedOut: false, capped: true };
    }
  }
  return { seen, timedOut: false };
}

// Busca en todo el proyecto. Devuelve los aciertos agrupados por archivo, y
// `truncated` cuando se quedó corta por tope o por tiempo: el panel lo dice en
// vez de fingir que no había más.
function searchTree(root, query, options = {}) {
  const started = Date.now();
  const matcher = buildMatcher(query, options);
  const filter = makeFilter(options.include);
  const results = [];
  let matches = 0;
  let capped = false;

  const run = walk(root, {
    filter,
    deadline: started + LIMITS.ms,
    onFile(full, rel) {
      let st;
      try {
        st = fs.statSync(full);
      } catch (_) {
        return;
      }
      if (st.size > LIMITS.fileBytes) return;

      let buf;
      try {
        buf = fs.readFileSync(full);
      } catch (_) {
        return;
      }
      if (safepath.looksBinary(buf)) return;

      const lines = searchText(buf.toString("utf-8"), matcher);
      if (!lines.length) return;

      results.push({ path: full, rel, name: path.basename(full), dir: path.dirname(rel), lines });
      matches += lines.length;
      if (results.length >= LIMITS.hitFiles || matches >= LIMITS.matches) {
        capped = true;
        return false;
      }
    },
  });

  return {
    root,
    query,
    files: results.length,
    matches,
    scanned: run.seen,
    truncated: Boolean(capped || run.timedOut || run.capped),
    timedOut: Boolean(run.timedOut),
    elapsedMs: Date.now() - started,
    results,
  };
}

module.exports = { LIMITS, queryError, buildMatcher, globToRegExp, makeFilter, trimLine, searchText, searchTree };
