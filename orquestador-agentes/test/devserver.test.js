// Tests del módulo del dev server. Se ejecutan con:  node --test test/devserver.test.js
// Sin dependencias: runner integrado de Node.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  scriptError,
  pmArgs,
  pickDefault,
  parseScripts,
  pmFromManifest,
  detectPm,
  findPackageRoot,
  stripAnsi,
  findUrl,
  envFor,
  info,
  LIMITS,
} = require("../devserver");

function tempDir() {
  return fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "devserver-"));
}

function project(pkg, extra = {}) {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg));
  for (const [name, body] of Object.entries(extra)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

test("scriptError acepta los nombres que usa un package.json", () => {
  assert.equal(scriptError("dev"), null);
  assert.equal(scriptError("build:css"), null);
  assert.equal(scriptError("start_app"), null);
  assert.equal(scriptError("test-e2e"), null);
});

test("scriptError rechaza el script vacío", () => {
  assert.equal(scriptError(""), "Falta el script que lanzar");
  assert.equal(scriptError("   "), "Falta el script que lanzar");
});

test("scriptError rechaza un script que empieza por guion", () => {
  assert.equal(scriptError("--inspect"), "Un script no puede empezar por '-'");
});

test("scriptError rechaza un script con espacios dentro", () => {
  assert.equal(scriptError("mi script"), "Ese nombre de script no es válido");
  assert.equal(scriptError("dev && rm -rf /"), "Ese nombre de script no es válido");
});

test("scriptError recorta los espacios de los lados", () => {
  assert.equal(scriptError("  dev  "), null);
});

test("pmArgs usa 'run' salvo en yarn", () => {
  assert.deepEqual(pmArgs("yarn", "dev"), ["dev"]);
  assert.deepEqual(pmArgs("pnpm", "dev"), ["run", "dev"]);
  assert.deepEqual(pmArgs("npm", "dev"), ["run", "dev"]);
  assert.deepEqual(pmArgs("bun", "dev"), ["run", "dev"]);
});

test("pickDefault prefiere dev sobre start", () => {
  assert.equal(pickDefault([{ name: "start" }, { name: "dev" }]), "dev");
});

test("pickDefault cae en start cuando no hay dev", () => {
  assert.equal(pickDefault([{ name: "build" }, { name: "start" }]), "start");
});

test("pickDefault devuelve el primero cuando ninguno es de los preferidos", () => {
  assert.equal(pickDefault([{ name: "build" }, { name: "lint" }]), "build");
});

test("pickDefault devuelve null sin scripts", () => {
  assert.equal(pickDefault([]), null);
  assert.equal(pickDefault(), null);
});

test("parseScripts saca nombre y comando", () => {
  const scripts = parseScripts({ scripts: { dev: "vite", "build:css": "sass src", "test-e2e": "playwright test" } });
  assert.deepEqual(scripts, [
    { name: "dev", command: "vite" },
    { name: "build:css", command: "sass src" },
    { name: "test-e2e", command: "playwright test" },
  ]);
});

test("parseScripts descarta los nombres que no pasan el validador", () => {
  const scripts = parseScripts({ scripts: { "mi script": "cmd", "--flag": "cmd", ok: "cmd" } });
  assert.deepEqual(scripts, [{ name: "ok", command: "cmd" }]);
});

test("parseScripts respeta el tope de scripts", () => {
  const raw = {};
  for (let i = 0; i < LIMITS.scripts + 10; i++) raw[`s${i}`] = "cmd";
  assert.equal(parseScripts({ scripts: raw }).length, LIMITS.scripts);
});

test("parseScripts corta el comando largo", () => {
  const long = "x".repeat(LIMITS.command + 50);
  const [script] = parseScripts({ scripts: { dev: long } });
  assert.equal(script.command.length, LIMITS.command);
});

test("parseScripts tolera un package.json sin scripts", () => {
  assert.deepEqual(parseScripts(null), []);
  assert.deepEqual(parseScripts({}), []);
  assert.deepEqual(parseScripts({ scripts: "nada" }), []);
});

test("pmFromManifest lee el campo packageManager", () => {
  assert.equal(pmFromManifest({ packageManager: "pnpm@9.1.0" }), "pnpm");
  assert.equal(pmFromManifest({ packageManager: "yarn" }), "yarn");
  assert.equal(pmFromManifest({ packageManager: "deno@1.0.0" }), null);
  assert.equal(pmFromManifest(undefined), null);
});

test("detectPm saca el gestor del lockfile", () => {
  assert.equal(detectPm(project({}, { "pnpm-lock.yaml": "" })), "pnpm");
  assert.equal(detectPm(project({}, { "yarn.lock": "" })), "yarn");
  assert.equal(detectPm(project({}, { "bun.lockb": "" })), "bun");
  assert.equal(detectPm(project({}, { "package-lock.json": "{}" })), "npm");
});

test("detectPm cae en npm sin lockfile", () => {
  assert.equal(detectPm(project({})), "npm");
});

test("detectPm hace caso a packageManager antes que al lockfile", () => {
  const dir = project({ packageManager: "pnpm@9.1.0" }, { "package-lock.json": "{}" });
  assert.equal(detectPm(dir), "pnpm");
});

test("findPackageRoot encuentra la carpeta con package.json", () => {
  const dir = project({ name: "web" });
  assert.equal(findPackageRoot(dir), fs.realpathSync(dir));
});

test("findPackageRoot sube desde una subcarpeta", () => {
  const dir = project({ name: "web" });
  const deep = path.join(dir, "src", "components");
  fs.mkdirSync(deep, { recursive: true });
  assert.equal(findPackageRoot(deep), fs.realpathSync(dir));
});

test("findPackageRoot devuelve null cuando no hay package.json", () => {
  const dir = tempDir();
  assert.equal(findPackageRoot(dir, 1), null);
});

test("stripAnsi quita los colores y deja el texto", () => {
  assert.equal(stripAnsi("\u001b[32m>\u001b[39m  Local: listo"), ">  Local: listo");
});

test("findUrl saca la URL que imprime Vite", () => {
  assert.equal(findUrl("  >  Local:   http://localhost:5173/"), "http://localhost:5173/");
});

test("findUrl completa la barra final cuando no la trae", () => {
  assert.equal(findUrl("> Network: http://127.0.0.1:3000"), "http://127.0.0.1:3000/");
});

test("findUrl reescribe 0.0.0.0 como localhost", () => {
  assert.equal(findUrl("Listening on http://0.0.0.0:8080/app"), "http://localhost:8080/app");
});

test("findUrl atraviesa los colores de la consola", () => {
  assert.equal(findUrl("\u001b[36m  Local: \u001b[1mhttp://localhost:4200/\u001b[0m"), "http://localhost:4200/");
});

test("findUrl mantiene https", () => {
  assert.equal(findUrl("ready on https://localhost:4443/"), "https://localhost:4443/");
});

test("findUrl ignora una URL que no es de esta máquina", () => {
  assert.equal(findUrl("docs en https://vitejs.dev/guide/"), null);
});

test("findUrl devuelve null cuando la línea no trae URL", () => {
  assert.equal(findUrl("compiled successfully"), null);
  assert.equal(findUrl(""), null);
});

test("envFor apaga el color y el navegador, y pone el binario al frente del PATH", () => {
  const env = envFor({ PATH: "/usr/bin" }, "/opt/homebrew/bin/pnpm");
  assert.equal(env.NO_COLOR, "1");
  assert.equal(env.FORCE_COLOR, "0");
  assert.equal(env.TERM, "dumb");
  assert.equal(env.BROWSER, "none");
  assert.equal(env.PATH, `/opt/homebrew/bin${path.delimiter}/usr/bin`);
});

test("info describe el proyecto que se puede lanzar", () => {
  const dir = project({ name: "web", scripts: { build: "vite build", dev: "vite" } }, { "pnpm-lock.yaml": "" });
  const found = info(dir);
  assert.equal(found.root, fs.realpathSync(dir));
  assert.equal(found.name, "web");
  assert.equal(found.pm, "pnpm");
  assert.equal(found.defaultScript, "dev");
  assert.deepEqual(
    found.scripts.map((s) => s.name),
    ["build", "dev"]
  );
});

test("info devuelve null en una carpeta sin package.json", () => {
  assert.equal(info(tempDir()), null);
});
