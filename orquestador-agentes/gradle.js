// Compila un proyecto de Android con el wrapper del propio repo (./gradlew) y
// deja el APK listo para instalar en el emulador. Una compilación a la vez:
// cada una son minutos y RAM, y dos a la vez no van más rápido.
// El log se manda en vivo por SSE al panel, que es lo único que se ve mientras
// tanto. El JDK y el SDK entran por el entorno (JAVA_HOME, ANDROID_HOME)
// porque el orquestador no hereda el shell del usuario.
// La tarea se valida antes y se llama con spawn y argumentos fijos, nunca por
// la shell. Los parseos —módulos, APKs, errores del compilador y el resumen del
// fallo— son funciones puras, para poder probarlos (ver test/gradle.test.js).

const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const LIMITS = {
  levels: 8,
  modules: 60,
  log: 400000,
  line: 2000,
  apkDepth: 6,
  apkEntries: 4000,
  apks: 40,
  problems: 300,
  summary: 200,
  runMs: 25 * 60 * 1000,
  stallMs: 5 * 60 * 1000,
  flushMs: 150,
};

const TASK_OK = /^:?[A-Za-z0-9][A-Za-z0-9:._-]{0,79}$/;
const VARIANT_OK = /^[A-Za-z0-9][A-Za-z0-9]{0,39}$/;
const MODULE_OK = /^:?[A-Za-z0-9][A-Za-z0-9:._-]{0,79}$/;

const STUDIO_JBR = [
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
  "/Applications/Android Studio Preview.app/Contents/jbr/Contents/Home",
];

const CAUSE = /^(\*\s*What went wrong:|FAILURE:|error:|e:)\s*/i;

// Busca el directorio raíz de Gradle subiendo por carpetas padre, porque el
// panel suele mostrar una subcarpeta del proyecto. Si no encuentra gradlew, no
// se puede compilar.
function findGradleRoot(dir, levels = LIMITS.levels) {
  let current = path.resolve(String(dir || ""));
  for (let i = 0; i < levels; i++) {
    try {
      if (fs.existsSync(path.join(current, "gradlew"))) return current;
    } catch (_) {
      return null;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

// Busca la ruta de Java en orden de prioridad: JAVA_HOME, JDK de Android Studio,
// y luego /usr/libexec/java_home; el entorno del orquestador no hereda el shell
// del usuario, así que se necesita esta lógica para evitar errores en Mac.
function javaHome(env = process.env) {
  const configured = String(env.JAVA_HOME || "").trim();
  if (configured && fs.existsSync(path.join(configured, "bin", "java"))) return configured;
  for (const candidate of STUDIO_JBR) {
    if (fs.existsSync(path.join(candidate, "bin", "java"))) return candidate;
  }
  try {
    const found = execFileSync("/usr/libexec/java_home", [], { encoding: "utf-8", timeout: 4000 }).trim();
    if (found && fs.existsSync(path.join(found, "bin", "java"))) return found;
  } catch (_) {}
  return null;
}

function parseModules(text) {
  const out = [];
  const seen = new Set();
  const re = /['"](:[A-Za-z0-9][A-Za-z0-9:._-]*)['"]/g;
  let hit;
  while ((hit = re.exec(String(text || "")))) {
    const name = hit[1];
    if (seen.has(name) || out.length >= LIMITS.modules) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function readModules(root) {
  for (const name of ["settings.gradle.kts", "settings.gradle"]) {
    try {
      const file = path.join(root, name);
      if (fs.existsSync(file)) return parseModules(fs.readFileSync(file, "utf-8"));
    } catch (_) {}
  }
  return [];
}

// Lo que salga de aquí va a la línea de comandos de Gradle: una tarea que
// empiece por guion la leería como una bandera suya.
function taskError(task) {
  const t = String(task || "").trim();
  if (!t) return "Falta la tarea de Gradle";
  if (t.startsWith("-")) return "Una tarea no puede empezar por '-'";
  if (!TASK_OK.test(t)) return "Ese nombre de tarea no es válido";
  return null;
}

function capitalize(text) {
  const t = String(text || "");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

// Genera la tarea de Gradle válida a partir del módulo y variante; si no se
// especifica, devuelve una tarea como "assembleDebug" o "assembleRelease".
// Devuelve cadena vacía si los parámetros no son válidos.
function taskFor({ module: mod = "", variant = "debug", task = "" } = {}) {
  const explicit = String(task || "").trim();
  if (explicit) return explicit;
  const v = String(variant || "debug").trim();
  if (!VARIANT_OK.test(v)) return "";
  const m = String(mod || "").trim();
  if (!m) return `assemble${capitalize(v)}`;
  if (!MODULE_OK.test(m)) return "";
  const prefix = m.startsWith(":") ? m : `:${m}`;
  return `${prefix}:assemble${capitalize(v)}`;
}

// Recorre las carpetas de APK con un tope de profundidad y entradas para evitar
// recorrer discos enteros.
function walkApks(dir, depth, budget, out) {
  if (depth < 0 || budget.left <= 0) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const entry of entries) {
    if (budget.left-- <= 0) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".")) continue;
      walkApks(full, depth - 1, budget, out);
    } else if (entry.name.toLowerCase().endsWith(".apk")) {
      try {
        out.push({ path: full, mtimeMs: fs.statSync(full).mtimeMs });
      } catch (_) {}
    }
  }
}

// Busca APKs en build/outputs/apk, evitando rutas que cambian entre versiones de
// AGP; usa 'since' para filtrar solo los más recientes.
function findApks(root, { since = 0, depth = LIMITS.apkDepth } = {}) {
  const out = [];
  const budget = { left: LIMITS.apkEntries };
  let modules = [];
  try {
    modules = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => path.join(root, e.name));
  } catch (_) {}

  for (const base of [root, ...modules]) {
    walkApks(path.join(base, "build", "outputs", "apk"), depth, budget, out);
  }
  return out
    .filter((a) => a.mtimeMs >= since)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, LIMITS.apks);
}

// Los tres formatos que traen línea y columna: Kotlin viejo
// ("e: /App.kt: (12, 5): msg"), Kotlin nuevo ("e: file:///App.kt:12:5 msg") y
// javac ("/A.java:12: error: msg").
const KOTLIN_OLD_RE = /^([ew]):\s+(?:file:\/\/)?(.+?):\s*\((\d+),\s*(\d+)\):\s*(.*)$/;
const KOTLIN_RE = /^([ew]):\s+file:\/\/(.+?):(\d+):(\d+)[:\s]\s*(.*)$/;
const JAVAC_RE = /^(.+?):(\d+):\s*(error|warning|warnung|aviso):\s*(.*)$/i;

// Analiza texto de errores del compilador, soporta ambos formatos de Kotlin
// (viejo y nuevo) y errores de javac.
function parseProblems(text) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    if (out.length >= LIMITS.problems) break;
    const line = raw.trim();
    const kotlin = KOTLIN_RE.exec(line) || KOTLIN_OLD_RE.exec(line);
    if (kotlin) {
      out.push({
        file: kotlin[2],
        line: Number(kotlin[3]),
        column: Number(kotlin[4]),
        severity: kotlin[1] === "e" ? "error" : "warning",
        message: kotlin[5],
        rule: null,
      });
      continue;
    }
    const javac = JAVAC_RE.exec(line);
    if (javac && /\.(java|kt|kts|xml)$/i.test(javac[1])) {
      out.push({
        file: javac[1],
        line: Number(javac[2]),
        column: 1,
        severity: /error/i.test(javac[3]) ? "error" : "warning",
        message: javac[4],
        rule: null,
      });
    }
  }
  return out;
}

// Extrae la línea que sigue a '* What went wrong:' como causa principal del
// error; si no está, toma la última línea relevante.
function errorSummary(output) {
  const lines = String(output || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return "Gradle no dijo nada";

  const at = lines.findIndex((l) => /^\*\s*What went wrong:/i.test(l));
  const picked = at >= 0 && lines[at + 1] ? lines[at + 1] : lines.find((l) => CAUSE.test(l)) || lines[lines.length - 1];
  const line = picked.replace(CAUSE, "");
  return line.length > LIMITS.summary ? `${line.slice(0, LIMITS.summary - 1)}…` : line;
}

// Detecta si gradlew es ejecutable; si no, llama a /bin/sh para ejecutarlo, como
// ocurre al clonar repositorios sin permisos.
function wrapperCommand(root) {
  const wrapper = path.join(root, "gradlew");
  try {
    fs.accessSync(wrapper, fs.constants.X_OK);
    return { bin: wrapper, prefix: [] };
  } catch (_) {
    return { bin: "/bin/sh", prefix: [wrapper] };
  }
}

// Configura el entorno de Gradle para que el log sea legible línea a línea en el
// panel, fuerza consola plana y ajusta JAVA_HOME y ANDROID_HOME.
function buildEnv(env, home, sdk) {
  const next = { ...env, TERM: "dumb", GRADLE_OPTS: [env.GRADLE_OPTS, "-Dorg.gradle.console=plain"].filter(Boolean).join(" ") };
  if (home) {
    next.JAVA_HOME = home;
    next.PATH = `${path.join(home, "bin")}${path.delimiter}${env.PATH || ""}`;
  }
  if (sdk) {
    next.ANDROID_HOME = sdk;
    next.ANDROID_SDK_ROOT = sdk;
  }
  return next;
}

function create({ env = process.env, onEvent = () => {}, sdk = null } = {}) {
  let current = null;
  const sdkFor = () => (typeof sdk === "function" ? sdk() : sdk) || "";

  const info = (root) => ({
    root,
    modules: readModules(root),
    java: javaHome(env),
    wrapper: Boolean(root && fs.existsSync(path.join(root, "gradlew"))),
  });

  function detect(dir) {
    const root = findGradleRoot(dir);
    return root ? info(root) : null;
  }

  function state() {
    if (!current) return null;
    return {
      id: current.id,
      root: current.root,
      task: current.task,
      startedAt: current.startedAt,
      running: current.running,
      ok: current.ok,
      apk: current.apk,
      summary: current.summary,
      problems: current.problems,
      log: current.log,
      phase: current.phase,
    };
  }

  const running = () => Boolean(current && current.running);

  // Acumula el texto del log y lo envía en ráfagas de 150 ms para evitar saturar
  // el panel con eventos SSE.
  function push(job, text) {
    job.log = (job.log + text).slice(-LIMITS.log);
    job.pending += text;
    if (job.flush) return;
    job.flush = setTimeout(() => {
      const lines = job.pending;
      job.pending = "";
      job.flush = null;
      if (lines) onEvent({ id: job.id, phase: "log", lines });
    }, LIMITS.flushMs);
  }

  // Forza el envío inmediato del log acumulado si hay datos pendientes, evitando
  // que se acumulen en el buffer.
  function flushNow(job) {
    if (job.flush) clearTimeout(job.flush);
    job.flush = null;
    if (job.pending) {
      onEvent({ id: job.id, phase: "log", lines: job.pending });
      job.pending = "";
    }
  }

  // Se ejecuta al finalizar la compilación; protege el estado con job.done para
  // evitar llamadas duplicadas y limpia temporizadores de inactividad.
  function finish(job, { ok, summary }) {
    if (job.done) return;
    job.done = true;
    job.running = false;
    job.ok = ok;
    job.phase = "built";
    clearTimeout(job.stall);
    clearTimeout(job.cap);
    flushNow(job);

    job.problems = parseProblems(job.log);
    job.summary = ok ? summary || "Compilado" : summary || errorSummary(job.log);
    if (ok) {
      const apks = findApks(job.root, { since: job.startedMs - 1000 });
      job.apk = apks.length ? apks[0].path : null;
      if (!job.apk) {
        const all = findApks(job.root);
        job.apk = all.length ? all[0].path : null;
      }
    }
    onEvent({ id: job.id, phase: "built", ok, apk: job.apk, summary: job.summary, problems: job.problems });
    job.resolve({ ok, apk: job.apk, summary: job.summary, problems: job.problems, log: job.log });
  }

  // Reinicia el reloj de inactividad con cada chunk de salida para mantener viva
  // una compilación lenta, evitando que se cierre por inactividad.
  function start({ id, root, task, extraArgs = [] } = {}) {
    if (running()) return { ok: false, output: "Ya hay una compilación en curso" };
    const bad = taskError(task);
    if (bad) return { ok: false, output: bad };
    if (!root || !fs.existsSync(path.join(root, "gradlew"))) return { ok: false, output: "Esa carpeta no tiene gradlew" };

    const home = javaHome(env);
    if (!home) return { ok: false, output: "No encuentro un JDK. Instala Android Studio o exporta JAVA_HOME" };

    const { bin, prefix } = wrapperCommand(root);
    const args = [...prefix, task, "--console=plain", ...extraArgs];

    let child;
    try {
      child = spawn(bin, args, { cwd: root, env: buildEnv(env, home, sdkFor()), stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      return { ok: false, output: err.message };
    }

    const job = {
      id,
      root,
      task,
      child,
      startedAt: new Date().toISOString(),
      startedMs: Date.now(),
      running: true,
      done: false,
      phase: "running",
      ok: null,
      apk: null,
      summary: null,
      problems: [],
      log: "",
      pending: "",
      flush: null,
      cancelled: false,
    };
    current = job;
    job.promise = new Promise((resolve) => {
      job.resolve = resolve;
    });

    const rearm = () => {
      clearTimeout(job.stall);
      job.stall = setTimeout(() => {
        job.cancelled = "Gradle se quedó callado demasiado tiempo";
        kill(job);
      }, LIMITS.stallMs);
    };
    job.cap = setTimeout(() => {
      job.cancelled = "La compilación pasó del tope de tiempo";
      kill(job);
    }, LIMITS.runMs);
    rearm();

    const onData = (chunk) => {
      rearm();
      push(job, String(chunk));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    child.on("error", (err) => finish(job, { ok: false, summary: err.message }));
    child.on("close", (code) => {
      if (job.cancelled) return finish(job, { ok: false, summary: job.cancelled });
      finish(job, { ok: code === 0, summary: code === 0 ? "Compilado" : null });
    });

    onEvent({ id: job.id, phase: "start", root, task, startedAt: job.startedAt });
    return { ok: true, id: job.id, task, root, promise: job.promise };
  }

  function kill(job) {
    try {
      job.child.kill("SIGTERM");
    } catch (_) {}
    setTimeout(() => {
      try {
        if (!job.done) job.child.kill("SIGKILL");
      } catch (_) {}
    }, 4000);
  }

  function cancel() {
    if (!running()) return { ok: false, output: "No hay ninguna compilación en curso" };
    current.cancelled = "Cancelada";
    kill(current);
    return { ok: true, output: "Cancelando…" };
  }

  function note(text) {
    if (!current) return;
    push(current, `\n${text}\n`);
    flushNow(current);
  }

  function setResult(patch) {
    if (!current) return;
    Object.assign(current, patch);
  }

  return { detect, info, state, running, start, cancel, note, setResult };
}

module.exports = {
  LIMITS,
  create,
  findGradleRoot,
  javaHome,
  parseModules,
  readModules,
  taskError,
  taskFor,
  findApks,
  parseProblems,
  errorSummary,
  wrapperCommand,
  buildEnv,
};
