// Tests del módulo de Gradle. Se ejecutan con:  node --test test/gradle.test.js
// Sin dependencias: runner integrado de Node.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { taskError, taskFor, parseModules, parseProblems, errorSummary, findGradleRoot, findApks, LIMITS } = require("../gradle");

function tempDir() {
  return fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "gradle-"));
}

test("taskError acepta 'assembleDebug' y ':app:assembleDebug'", () => {
  assert.equal(taskError("assembleDebug"), null);
  assert.equal(taskError(":app:assembleDebug"), null);
});

test("taskError rechaza la tarea vacía", () => {
  assert.equal(taskError(""), "Falta la tarea de Gradle");
});

test("taskError rechaza una tarea que empieza por guion", () => {
  assert.equal(taskError("--stacktrace"), "Una tarea no puede empezar por '-'");
});

test("taskError rechaza una tarea con espacios", () => {
  assert.equal(taskError("assemble Debug"), "Ese nombre de tarea no es válido");
});

test("taskError rechaza una tarea de más de 80 caracteres", () => {
  assert.equal(taskError("a".repeat(81)), "Ese nombre de tarea no es válido");
});

test("taskFor sin módulo devuelve 'assembleDebug'", () => {
  assert.equal(taskFor({ variant: "debug" }), "assembleDebug");
});

test("taskFor con el módulo 'app' devuelve ':app:assembleDebug'", () => {
  assert.equal(taskFor({ module: "app" }), ":app:assembleDebug");
});

test("taskFor con el módulo ':core' no duplica los dos puntos", () => {
  assert.equal(taskFor({ module: ":core" }), ":core:assembleDebug");
});

test("una tarea explícita gana sobre el módulo y la variante", () => {
  assert.equal(taskFor({ module: "app", variant: "release", task: "installDebug" }), "installDebug");
});

test("la variante 'release' da 'assembleRelease'", () => {
  assert.equal(taskFor({ variant: "release" }), "assembleRelease");
});

test("una variante con espacios no produce tarea", () => {
  assert.equal(taskFor({ variant: "deb ug" }), "");
});

test("un módulo que no pasa el validador tampoco produce tarea", () => {
  assert.equal(taskFor({ module: "-app" }), "");
});

test("parseModules saca los include de un settings.gradle.kts", () => {
  assert.deepEqual(parseModules('include(":app")\ninclude(":core")'), [":app", ":core"]);
});

test("parseModules no repite un módulo que aparece dos veces", () => {
  assert.deepEqual(parseModules('include(":app")\ninclude(":app")'), [":app"]);
});

test("parseModules devuelve lista vacía con texto vacío", () => {
  assert.deepEqual(parseModules(""), []);
});

test("un error de Kotlin sale con archivo, línea y columna", () => {
  assert.deepEqual(parseProblems("e: file:///U/App.kt:12:5 Unresolved reference: foo"), [
    { file: "/U/App.kt", line: 12, column: 5, severity: "error", message: "Unresolved reference: foo", rule: null },
  ]);
});

test("un aviso de Kotlin sale como warning", () => {
  assert.deepEqual(parseProblems("w: file:///U/App.kt:10:3 Parámetro sin usar"), [
    { file: "/U/App.kt", line: 10, column: 3, severity: "warning", message: "Parámetro sin usar", rule: null },
  ]);
});

test("el formato viejo de Kotlin, con la posición entre paréntesis, también se lee", () => {
  assert.deepEqual(parseProblems("e: /U/Old.kt: (3, 1): Unresolved reference"), [
    { file: "/U/Old.kt", line: 3, column: 1, severity: "error", message: "Unresolved reference", rule: null },
  ]);
});

test("un error de javac sale con columna 1", () => {
  assert.deepEqual(parseProblems("/U/A.java:9: error: cannot find symbol"), [
    { file: "/U/A.java", line: 9, column: 1, severity: "error", message: "cannot find symbol", rule: null },
  ]);
});

test("una línea cualquiera del log no es un problema", () => {
  assert.deepEqual(parseProblems("> Task :app:assembleDebug\nBUILD SUCCESSFUL in 37s"), []);
});

test("errorSummary devuelve la línea que sigue a 'What went wrong'", () => {
  const output = "FAILURE: Build failed with an exception.\n\n* What went wrong:\nExecution failed for task ':app:compileDebugKotlin'.";
  assert.equal(errorSummary(output), "Execution failed for task ':app:compileDebugKotlin'.");
});

test("sin salida, errorSummary lo dice en vez de devolver vacío", () => {
  assert.equal(errorSummary(""), "Gradle no dijo nada");
});

test("un resumen larguísimo se corta con puntos suspensivos", () => {
  const output = `* What went wrong:\n${"a".repeat(LIMITS.summary + 10)}`;
  assert.equal(errorSummary(output), `${"a".repeat(LIMITS.summary - 1)}…`);
});

test("findGradleRoot sube desde una subcarpeta hasta el gradlew", () => {
  const root = tempDir();
  try {
    fs.writeFileSync(path.join(root, "gradlew"), "");
    const deep = path.join(root, "app", "src", "main");
    fs.mkdirSync(deep, { recursive: true });
    assert.equal(findGradleRoot(deep), root);
    assert.equal(findGradleRoot(root), root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("una carpeta sin gradlew no tiene raíz de Gradle", () => {
  const root = tempDir();
  try {
    assert.equal(findGradleRoot(root), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("findApks encuentra el APK de un módulo y lo devuelve con su fecha", () => {
  const root = tempDir();
  try {
    const out = path.join(root, "app", "build", "outputs", "apk", "debug");
    fs.mkdirSync(out, { recursive: true });
    const apk = path.join(out, "app-debug.apk");
    fs.writeFileSync(apk, "");

    const found = findApks(root);
    assert.equal(found.length, 1);
    assert.equal(found[0].path, apk);
    assert.equal(typeof found[0].mtimeMs, "number");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("un APK anterior al build no cuenta: 'since' lo deja fuera", () => {
  const root = tempDir();
  try {
    const out = path.join(root, "app", "build", "outputs", "apk", "debug");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "app-debug.apk"), "");
    assert.deepEqual(findApks(root, { since: Date.now() + 10000 }), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
