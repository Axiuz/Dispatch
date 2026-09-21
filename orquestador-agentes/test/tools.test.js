const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const tools = require("../tools");

test("normalizeTools acepta lo válido y rellena lo que falta", () => {
  const list = tools.normalizeTools([
    { id: "eslint", bin: "eslint", name: "ESLint", kind: "lint", args: ["--format", "json", "{file}"], match: ["*.js"] },
    { id: "prettier", bin: "prettier", kind: "format", stdin: true },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].parser, "generic");
  assert.equal(list[1].parser, "none");
  assert.equal(list[1].name, "prettier");
  assert.equal(list[1].stdin, true);
});

test("normalizeTools descarta el binario que es una ruta o una bandera", () => {
  assert.equal(tools.normalizeTools([{ id: "a", bin: "/bin/eslint" }]).length, 0);
  assert.equal(tools.normalizeTools([{ id: "a", bin: "..\\eslint" }]).length, 0);
  assert.equal(tools.normalizeTools([{ id: "a", bin: "-rf" }]).length, 0);
  assert.equal(tools.normalizeTools([{ id: "a", bin: "" }]).length, 0);
});

test("normalizeTools exige el id en minúsculas y sin repetir", () => {
  assert.equal(tools.normalizeTools([{ id: "ESLINT", bin: "eslint" }]).length, 0);
  assert.equal(tools.normalizeTools([{ id: "es lint", bin: "eslint" }]).length, 0);
  const dup = tools.normalizeTools([
    { id: "eslint", bin: "eslint" },
    { id: "eslint", bin: "otro" },
  ]);
  assert.equal(dup.length, 1);
  assert.equal(dup[0].bin, "eslint");
});

test("normalizeTools aplica los topes de argumentos y de patrones", () => {
  const many = Array.from({ length: 60 }, (_, i) => `--f${i}`);
  const [tool] = tools.normalizeTools([{ id: "x", bin: "x", args: many, match: many }]);
  assert.equal(tool.args.length, tools.LIMITS.args);
  assert.equal(tool.match.length, tools.LIMITS.match);
});

test("matchesFile compara contra el nombre, y sin patrones acepta todo", () => {
  const tool = { match: ["*.js", "*.mjs"] };
  assert.ok(tools.matchesFile(tool, "/ruta/larga/app.js"));
  assert.equal(tools.matchesFile(tool, "/ruta/app.py"), false);
  assert.ok(tools.matchesFile({ match: [] }, "lo.que.sea"));
});

test("buildArgs solo sustituye {file} y {dir}", () => {
  const tool = { args: ["--stdin-filepath", "{file}", "--cwd", "{dir}", "--fijo"] };
  assert.deepEqual(tools.buildArgs(tool, { file: "/p/app.js", dir: "/p" }), [
    "--stdin-filepath",
    "/p/app.js",
    "--cwd",
    "/p",
    "--fijo",
  ]);
});

test("parseEslintJson traduce severidades y aguanta un JSON roto", () => {
  const stdout = JSON.stringify([
    {
      filePath: "/p/app.js",
      messages: [
        { severity: 1, line: 3, column: 2, message: "aviso", ruleId: "no-unused" },
        { severity: 2, line: 9, column: 1, message: "error", ruleId: null },
      ],
    },
  ]);
  assert.deepEqual(tools.parseEslintJson(stdout, "/p/otro.js"), [
    { file: "/p/app.js", line: 3, column: 2, severity: "warning", message: "aviso", rule: "no-unused" },
    { file: "/p/app.js", line: 9, column: 1, severity: "error", message: "error", rule: null },
  ]);
  assert.deepEqual(tools.parseEslintJson("no soy json", "/p/app.js"), []);
});

test("parseRuffJson saca fila y columna de location", () => {
  const stdout = JSON.stringify([
    { filename: "/p/app.py", message: "línea larga", code: "E501", location: { row: 12, column: 80 } },
  ]);
  assert.deepEqual(tools.parseRuffJson(stdout, "/p/otro.py"), [
    { file: "/p/app.py", line: 12, column: 80, severity: "warning", message: "línea larga", rule: "E501" },
  ]);
  assert.deepEqual(tools.parseRuffJson("{", "/p/app.py"), []);
});

test("parseOutput con el formato de tsc", () => {
  const out = tools.parseOutput({ parser: "tsc" }, { stdout: "src/app.ts(12,5): error TS2345: mensaje" });
  assert.deepEqual(out, [
    { file: "src/app.ts", line: 12, column: 5, severity: "error", message: "mensaje", rule: "TS2345" },
  ]);
});

test("parseOutput genérico lee archivo, línea, columna y severidad", () => {
  const out = tools.parseOutput({ parser: "generic" }, { stderr: "script.sh:3:10: warning: algo" });
  assert.deepEqual(out, [
    { file: "script.sh", line: 3, column: 10, severity: "warning", message: "algo", rule: null },
  ]);
});

test("parseOutput genérico da la columna 1 cuando la salida no la trae", () => {
  const [hit] = tools.parseOutput({ parser: "generic" }, { stdout: "main.go:7: no se usa x" });
  assert.equal(hit.column, 1);
  assert.equal(hit.message, "no se usa x");
});

test("parseOutput con parser none no devuelve nada", () => {
  assert.deepEqual(tools.parseOutput({ parser: "none" }, { stdout: "a.js:1:1: error: x" }), []);
});

test("absolutize resuelve contra la raíz y tira lo de fuera", () => {
  const root = path.resolve("/proyecto");
  const out = tools.absolutize(
    [
      { file: "src/app.js", line: 1, column: 1, severity: "error", message: "x", rule: null },
      { file: path.resolve("/otro/sitio.js"), line: 2, column: 1, severity: "error", message: "y", rule: null },
    ],
    root
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].file, path.join(root, "src/app.js"));
  assert.equal(out[0].rel, "src/app.js");
});

test("summarize cuenta errores y avisos por separado", () => {
  const counts = tools.summarize([
    { severity: "error" },
    { severity: "warning" },
    { severity: "warning" },
    { severity: "info" },
  ]);
  assert.deepEqual(counts, { errors: 1, warnings: 2 });
});

test("clamp recorta la salida larguísima de una herramienta", () => {
  assert.equal(tools.clamp("x".repeat(50000)).length, tools.LIMITS.outputChars);
});
