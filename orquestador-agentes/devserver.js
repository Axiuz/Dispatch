// Detecta el package.json de la carpeta abierta y su gestor de paquetes (npm, yarn, pnpm, bun),
// lista los scripts definidos y lanza el elegido como proceso propio.
// Captura su log en vivo y extrae de ahí la URL local que imprime el script.
// Al parar, se lleva el proceso y todos sus hijos. No sirve archivos: eso es preview.js.

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const LIMITS = {
  levels: 8,
  scripts: 60,
  command: 400,
  name: 120,
  log: 400000,
  flushMs: 150,
  killMs: 4000,
  running: 3,
  scan: 4000,
};

const PMS = ["pnpm", "yarn", "npm", "bun"];

const LOCKS = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["package-lock.json", "npm"],
];

const SCRIPT_OK = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,79}$/;
const ANSI_RE = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const URL_RE = /(https?):\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d{2,5})(\/[^\s"'<>)\]]*)?/i;
const PREFERRED = ["dev", "start", "preview", "serve", "develop"];

const servers = new Map();

// Busca la raíz del proyecto subiendo hasta 8 niveles,
// porque la carpeta abierta en el panel suele ser una subcarpeta;
// devuelve esa carpeta o null si no hay package.json en ninguna.
function findPackageRoot(dir, levels = LIMITS.levels) {
  let current = path.resolve(String(dir || ""));
  for (let i = 0; i < levels; i++) {
    try {
      if (fs.existsSync(path.join(current, "package.json"))) return current;
    } catch (_) {
      return null;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function readPackage(root) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

function pmFromManifest(pkg) {
  const declared = String((pkg && pkg.packageManager) || "").trim().toLowerCase();
  const name = /^([a-z]+)(@|$)/.exec(declared);
  return name && PMS.includes(name[1]) ? name[1] : null;
}

// Detecta el gestor de paquetes: primero el declarado en packageManager,
// que es lo que fija el proyecto, y si no está, por el lockfile que haya.
// Sin ninguna de las dos pistas, npm.
function detectPm(root, pkg) {
  const declared = pmFromManifest(pkg === undefined ? readPackage(root) : pkg);
  if (declared) return declared;
  for (const [file, pm] of LOCKS) {
    try {
      if (fs.existsSync(path.join(root, file))) return pm;
    } catch (_) {
      break;
    }
  }
  return "npm";
}

// Extrae los scripts del package.json validando el nombre con un patrón:
// descarta los que no pasan y recorta el comando al tope,
// porque el nombre acaba en la línea de comandos.
function parseScripts(pkg) {
  const raw = (pkg && pkg.scripts) || {};
  if (typeof raw !== "object") return [];
  const out = [];
  for (const [name, command] of Object.entries(raw)) {
    if (out.length >= LIMITS.scripts) break;
    if (!SCRIPT_OK.test(name)) continue;
    out.push({ name, command: String(command || "").slice(0, LIMITS.command) });
  }
  return out;
}

// Elige el script por orden de preferencia: dev, start, preview, serve, develop.
// Si ninguno está, devuelve el primero del listado, o null si no hay scripts.
function pickDefault(scripts) {
  const names = (scripts || []).map((s) => s.name);
  for (const wanted of PREFERRED) {
    if (names.includes(wanted)) return wanted;
  }
  return names[0] || null;
}

// Valida el nombre del script antes de que llegue al gestor:
// rechaza el que empieza por guion, que el gestor leería como una bandera suya,
// y devuelve el mensaje de error o null si el nombre vale.
function scriptError(name) {
  const text = String(name || "").trim();
  if (!text) return "Falta el script que lanzar";
  if (text.startsWith("-")) return "Un script no puede empezar por '-'";
  if (!SCRIPT_OK.test(text)) return "Ese nombre de script no es válido";
  return null;
}

function pmArgs(pm, script) {
  return pm === "yarn" ? [script] : ["run", script];
}

function binDirs(env = process.env) {
  const home = os.homedir();
  return [
    ...String(env.PATH || "").split(path.delimiter).filter(Boolean),
    path.dirname(process.execPath),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    path.join(home, "Library", "pnpm"),
    path.join(home, ".local", "share", "pnpm"),
    path.join(home, ".bun", "bin"),
    path.join(home, ".volta", "bin"),
    path.join(home, ".yarn", "bin"),
  ];
}

// Busca el binario del gestor (npm, pnpm, yarn, bun) en las rutas habituales:
// no basta con el PATH porque el servidor no hereda el shell de login del usuario.
// Devuelve la ruta completa o null si no está instalado.
function findBin(pm, env = process.env) {
  const name = PMS.includes(String(pm)) ? String(pm) : "npm";
  const seen = new Set();
  for (const dir of binDirs(env)) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    const full = path.join(dir, name);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      if (fs.statSync(full).isFile()) return full;
    } catch (_) {}
  }
  return null;
}

// Prepara el entorno del script: apaga el color (NO_COLOR, FORCE_COLOR, TERM=dumb)
// para que el log salga limpio, y BROWSER=none para que el dev server no abra
// una pestaña en el navegador. El binario elegido va al frente del PATH.
function envFor(env, bin) {
  const next = { ...env, TERM: "dumb", NO_COLOR: "1", FORCE_COLOR: "0", BROWSER: "none" };
  const dir = bin ? path.dirname(bin) : "";
  if (dir) next.PATH = `${dir}${path.delimiter}${env.PATH || ""}`;
  return next;
}

function stripAnsi(text) {
  return String(text || "").replace(ANSI_RE, "");
}

// Saca del log la URL local que imprime el script, solo si es de esta máquina.
// Reescribe 0.0.0.0 como localhost porque el iframe no puede cargar 0.0.0.0,
// y completa la barra final cuando el script no la trae.
function findUrl(text) {
  const hit = URL_RE.exec(stripAnsi(text));
  if (!hit) return null;
  const host = hit[2].toLowerCase() === "0.0.0.0" ? "localhost" : hit[2];
  return `${hit[1].toLowerCase()}://${host}:${hit[3]}${hit[4] || "/"}`;
}

// Arma lo que el panel necesita para pintar la fila de control antes de arrancar nada:
// la raíz, el nombre del proyecto, el gestor, los scripts y cuál sale elegido.
function info(dir) {
  const root = findPackageRoot(dir);
  if (!root) return null;
  const pkg = readPackage(root);
  if (!pkg) return null;
  const scripts = parseScripts(pkg);
  return {
    root,
    name: String(pkg.name || path.basename(root)).slice(0, LIMITS.name),
    pm: detectPm(root, pkg),
    scripts,
    defaultScript: pickDefault(scripts),
  };
}

function view(job, { log = false } = {}) {
  return {
    path: job.root,
    pm: job.pm,
    script: job.script,
    pid: job.pid,
    running: job.running,
    url: job.url,
    startedAt: job.startedAt,
    stoppedAt: job.stoppedAt,
    exitCode: job.exitCode,
    error: job.error,
    ...(log ? { log: job.log } : {}),
  };
}

function flushNow(job) {
  if (job.flush) clearTimeout(job.flush);
  job.flush = null;
  if (!job.pending) return;
  const lines = job.pending;
  job.pending = "";
  job.onEvent({ phase: "log", path: job.root, lines });
}

// Quita los códigos de color al entrar, no al pintar, para que el panel no los enseñe
// y para que la búsqueda de URL vea el texto limpio. El log sale en ráfagas de 150 ms,
// salvo cuando aparece la URL: esa se manda al momento.
function push(job, raw) {
  const text = stripAnsi(raw);
  job.log = (job.log + text).slice(-LIMITS.log);
  job.pending += text;

  if (!job.url) {
    const url = findUrl(text) || findUrl(job.log.slice(-LIMITS.scan));
    if (url) {
      job.url = url;
      flushNow(job);
      job.onEvent({ phase: "url", ...view(job) });
      return;
    }
  }

  if (job.flush) return;
  job.flush = setTimeout(() => flushNow(job), LIMITS.flushMs);
}

// Mata el grupo entero con el pid en negativo, y si eso falla, al hijo directo:
// "npm run dev" arranca a su vez otro proceso (vite, next) y matar solo al padre
// dejaría el puerto ocupado.
function killGroup(job, signal) {
  if (!job.pid) return;
  try {
    process.kill(-job.pid, signal);
  } catch (_) {
    try {
      job.child.kill(signal);
    } catch (_) {}
  }
}

// Cierra el job una sola vez: guarda el código de salida, vacía lo que quedaba
// en el buffer del log y avisa del exit. Vale igual para un cierre normal
// que para un error del proceso.
function finish(job, code) {
  if (!job.running) return;
  job.running = false;
  job.exitCode = code;
  job.stoppedAt = new Date().toISOString();
  clearTimeout(job.killTimer);
  flushNow(job);
  job.onEvent({ phase: "exit", ...view(job) });
}

const runningCount = () => [...servers.values()].filter((j) => j.running).length;

// Lanza el script en su propio grupo de procesos (detached), uno por carpeta y tres
// en total, porque cada uno es un proceso vivo con su RAM. El nombre se valida y
// además tiene que existir en el package.json: va a la línea de comandos.
function start({ root, script, env = process.env, onEvent = () => {} } = {}) {
  const dir = String(root || "");
  const existing = servers.get(dir);
  if (existing && existing.running) return { ok: false, output: "Ya hay un script en marcha en esa carpeta" };
  if (runningCount() >= LIMITS.running) {
    return { ok: false, output: `Ya hay ${LIMITS.running} scripts en marcha: para uno antes de lanzar otro` };
  }

  const bad = scriptError(script);
  if (bad) return { ok: false, output: bad };

  const pkg = readPackage(dir);
  if (!pkg) return { ok: false, output: "Esa carpeta no tiene package.json" };
  const scripts = parseScripts(pkg);
  if (!scripts.some((s) => s.name === script)) return { ok: false, output: `El package.json no tiene el script "${script}"` };

  const pm = detectPm(dir, pkg);
  const bin = findBin(pm, env);
  if (!bin) return { ok: false, output: `No encuentro ${pm} en el sistema` };

  let child;
  try {
    child = spawn(bin, pmArgs(pm, script), {
      cwd: dir,
      env: envFor(env, bin),
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    return { ok: false, output: err.message };
  }

  const job = {
    root: dir,
    pm,
    script,
    bin,
    child,
    pid: child.pid,
    running: true,
    url: null,
    log: "",
    pending: "",
    flush: null,
    killTimer: null,
    stopping: false,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    exitCode: null,
    error: null,
    onEvent,
  };
  servers.set(dir, job);

  const onData = (chunk) => push(job, String(chunk));
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("error", (err) => {
    job.error = err.message;
    push(job, `\n${err.message}\n`);
    finish(job, null);
  });
  child.on("close", (code) => finish(job, code));

  onEvent({ phase: "start", ...view(job) });
  return { ok: true, state: view(job) };
}

// Para el script de esa carpeta: SIGTERM al grupo y SIGKILL a los 4 segundos
// si no se fue. Un job ya parado solo se borra del mapa.
function stop(root) {
  const job = servers.get(String(root || ""));
  if (!job) return false;
  if (!job.running) {
    servers.delete(job.root);
    return true;
  }
  job.stopping = true;
  killGroup(job, "SIGTERM");
  clearTimeout(job.killTimer);
  job.killTimer = setTimeout(() => killGroup(job, "SIGKILL"), LIMITS.killMs);
  return true;
}

function state(root) {
  const job = servers.get(String(root || ""));
  return job ? view(job, { log: true }) : null;
}

const list = () => [...servers.values()].map((job) => view(job));

// Lo llama server.js al recibir SIGTERM, para que ningún script
// sobreviva al orquestador.
function stopAll() {
  for (const job of servers.values()) {
    if (job.running) killGroup(job, "SIGTERM");
  }
}

module.exports = {
  LIMITS,
  PMS,
  findPackageRoot,
  readPackage,
  pmFromManifest,
  detectPm,
  parseScripts,
  pickDefault,
  scriptError,
  pmArgs,
  binDirs,
  findBin,
  envFor,
  stripAnsi,
  findUrl,
  info,
  start,
  stop,
  state,
  list,
  stopAll,
};
